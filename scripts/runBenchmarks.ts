import { promises as fs } from "fs";
import path from "path";
import { performance } from "perf_hooks";
import {
  imagesDiff,
  pixelmatchDiff,
  looksSameDiff,
} from "../src/imagesDiff";      // ⬅️ ajuste se o caminho mudar

type Result = {
  category: string;
  pair: string;
  algo: string;
  times: number[];
};

const CATEGORIES = ["iguais", "pouca_dif", "muita_dif"];
const ITERATIONS = 10;                 // repetições p/ suavizar variação
const BASE_DIR = path.resolve("imagens_teste");

async function loadBuffer(fp: string) {
  return fs.readFile(fp);
}

async function run() {
  const results: Result[] = [];

  for (const cat of CATEGORIES) {
    const dir = path.join(BASE_DIR, cat);
    const files = (await fs.readdir(dir)).filter(f => f.endsWith("_1.png"));

    for (const f1 of files) {
      const base = f1.replace("_1.png", "");
      const f2 = `${base}_2.png`;
      const buf1 = await loadBuffer(path.join(dir, f1));
      const buf2 = await loadBuffer(path.join(dir, f2));

      // Lista de algoritmos síncronos
      const syncAlgos: [string, (a: Buffer, b: Buffer) => boolean][] = [
        ["imagesDiff", (a, b) => imagesDiff(a, b, 1000, 10)],
        ["pixelmatch", (a, b) => pixelmatchDiff(a, b, 0.1)],
      ];

      // Lista de algoritmos assíncronos (Promise)
      const asyncAlgos: [string, (a: Buffer, b: Buffer) => Promise<boolean>][] =
        [
          ["looksSame", (a, b) => looksSameDiff(a, b, 5)]
        ];

      // Rodar síncronos
      for (const [name, fn] of syncAlgos) {
        const times: number[] = [];
        for (let i = 0; i < ITERATIONS; i++) {
          const t0 = performance.now();
          fn(buf1, buf2);
          times.push(performance.now() - t0);
        }
        results.push({ category: cat, pair: base, algo: name, times });
      }

      // Rodar assíncronos
      for (const [name, fn] of asyncAlgos) {
        const times: number[] = [];
        for (let i = 0; i < ITERATIONS; i++) {
          const t0 = performance.now();
          await fn(buf1, buf2);
          times.push(performance.now() - t0);
        }
        results.push({ category: cat, pair: base, algo: name, times });
      }
    }
  }

  // Agregar
  const summary: Record<
    string,
    { min: number; max: number; avg: number; samples: number }
  > = {};

  for (const r of results) {
    const key = `${r.category}:${r.algo}`;
    const min = Math.min(...r.times);
    const max = Math.max(...r.times);
    const avg = r.times.reduce((s, v) => s + v, 0) / r.times.length;
    if (!summary[key]) {
      summary[key] = { min, max, avg, samples: r.times.length };
    } else {
      const s = summary[key];
      s.min = Math.min(s.min, min);
      s.max = Math.max(s.max, max);
      s.avg = (s.avg * s.samples + avg * r.times.length) / (s.samples + r.times.length);
      s.samples += r.times.length;
    }
  }

  await fs.writeFile(
    path.resolve("results", "bench.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log("🏁  Benchmark concluído — veja results/bench.json");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
