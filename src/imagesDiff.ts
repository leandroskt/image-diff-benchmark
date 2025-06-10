// src/compare.ts
import { createHash } from "crypto";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import looksSame from "looks-same";


/* ------------------ Seu algoritmo ------------------ */

export function getHash(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("hex");
}

/**
 * Compara dois buffers PNG; retorna true se forem diferentes
 * acima do limiar definido.
 */
export function imagesDiff(
  buffer1: Buffer,
  buffer2: Buffer,
  pixelDiffThreshold: number,
  tolerance = 10,
): boolean {
  const hash1 = getHash(buffer1);
  const hash2 = getHash(buffer2);
  if (hash1 === hash2) return false;

  const img1 = PNG.sync.read(buffer1);
  const img2 = PNG.sync.read(buffer2);
  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error("As imagens possuem dimensões diferentes.");
  }
  if (img1.data.equals(img2.data)) return false;

  let diffCount = 0;
  const d1 = img1.data;
  const d2 = img2.data;
  for (let i = 0; i < d1.length; i += 4) {
    const avg =
      (Math.abs(d1[i] - d2[i]) +
        Math.abs(d1[i + 1] - d2[i + 1]) +
        Math.abs(d1[i + 2] - d2[i + 2])) /
      3;
    if (avg > tolerance && ++diffCount >= pixelDiffThreshold) return true;
  }
  return false;
}

/* ------------------ Competidores ------------------ */

/** Pixelmatch — retorna true se houver qualquer pixel diferente */
export function pixelmatchDiff(
  buffer1: Buffer,
  buffer2: Buffer,
  threshold = 0.1,
): boolean {
  const img1 = PNG.sync.read(buffer1);
  const img2 = PNG.sync.read(buffer2);
  const diff = pixelmatch(
    img1.data,
    img2.data,
    undefined,
    img1.width,
    img1.height,
    { threshold },
  );
  return diff > 0;
}

/** looks-same (promessa) */
export async function looksSameDiff(
  buffer1: Buffer,
  buffer2: Buffer,
  tolerance = 5,
): Promise<boolean> {
  const { equal } = await looksSame(buffer1, buffer2, {
    strict: false,
    tolerance,
  });
  return !equal;
}

