/**
 * Deterministic particle placement (seeded), so a given condition always looks the same and
 * nothing is recomputed per render. Each particle is a string of CSS custom properties.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fixed = (n: number, digits = 1) => n.toFixed(digits);

/** Raindrops alternate between long/fast/strong and short/slow/faint, like the design. */
export function rainDrops(count: number, heavy = false): string[] {
  const rand = mulberry32(count * 7 + (heavy ? 1 : 0));
  const [big, small] = heavy
    ? [{ h: 20, o: 0.46, t: 0.75 }, { h: 12, o: 0.26, t: 1.2 }]
    : [{ h: 16, o: 0.34, t: 1 }, { h: 10, o: 0.2, t: 1.6 }];
  return Array.from({ length: count }, (_, i) => {
    const d = i % 2 === 0 ? big : small;
    return `--x:${fixed(rand() * 110 - 2)}%;--h:${d.h}px;--o:${d.o};--t:${d.t}s;--d:-${fixed(rand() * d.t, 2)}s`;
  });
}

export function snowFlakes(count: number): string[] {
  const rand = mulberry32(count * 13 + 5);
  return Array.from({ length: count }, () => {
    const size = 2 + Math.floor(rand() * 3);
    return `--x:${fixed(rand() * 100)}%;--s:${size}px;--o:${fixed(0.3 + rand() * 0.6, 2)};--t:${fixed(5.5 + rand() * 2.5)}s;--d:-${fixed(rand() * 8)}s`;
  });
}

export function hailStones(count: number): string[] {
  const rand = mulberry32(count * 17 + 3);
  return Array.from({ length: count }, () => {
    const size = 4.5 + rand() * 2;
    const ground = Math.round(size * 16.7 - 24.5); // bigger stones travel further before bouncing
    return `--x:${fixed(rand() * 100)}%;--s:${fixed(size)}px;--g:${ground}px;--o:${fixed(0.68 + (size - 4.7) * 0.12, 2)};--t:${fixed(1.2 + rand() * 0.3, 2)}s;--d:-${fixed(rand() * 1.4, 2)}s`;
  });
}

export function gusts(count: number): string[] {
  const rand = mulberry32(count * 19 + 11);
  const widths = [60, 80, 120];
  return Array.from({ length: count }, (_, i) => {
    const top = 7 + i * 11 + Math.floor(rand() * 4);
    return `--y:${top}px;--w:${widths[Math.floor(rand() * widths.length)]}px;--o:${fixed(0.3 + rand() * 0.4, 2)};--t:${fixed(2.2 + rand() * 1.6)}s;--d:-${fixed(rand() * 4)}s`;
  });
}

export function stars(count: number): string[] {
  const rand = mulberry32(count * 23 + 1);
  return Array.from({ length: count }, () => {
    const size = rand() < 0.5 ? 2 : 3;
    return `--x:${fixed(rand() * 100)}%;--y:${Math.round(5 + rand() * 80)}px;--s:${size}px;--t:${fixed(2.8 + rand() * 2.6)}s;--d:-${fixed(rand() * 5)}s`;
  });
}
