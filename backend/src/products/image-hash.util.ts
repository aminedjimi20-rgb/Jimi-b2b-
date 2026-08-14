import Jimp from 'jimp';

/**
 * Difference hash (dHash) — a cheap, dependency-light perceptual hash:
 * shrink to 9x8 grayscale, compare each pixel to its right neighbor,
 * pack the 64 booleans into a hex string. Similar-looking photos (same
 * product, different angle/lighting) end up with a small Hamming
 * distance between their hashes, so this powers "search by photo"
 * without any ML model or external service (see docs/ARCHITECTURE.md §8
 * — Phase 1 approach; swappable for CLIP + pgvector later without
 * changing the public API, since only this file computes/compares hashes).
 */
export async function computeImageHash(buffer: Buffer): Promise<string> {
  const image = await Jimp.read(buffer);
  image.resize(9, 8).greyscale();

  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = Jimp.intToRGBA(image.getPixelColor(x, y)).r;
      const right = Jimp.intToRGBA(image.getPixelColor(x + 1, y)).r;
      bits += left < right ? '1' : '0';
    }
  }
  return BigInt('0b' + bits).toString(16).padStart(16, '0');
}

export function hammingDistance(hashA: string, hashB: string): number {
  let xor = BigInt('0x' + hashA) ^ BigInt('0x' + hashB);
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}
