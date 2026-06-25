export function jitter(base: number, rng: () => number = Math.random): number {
  return base * (0.8 + rng() * 0.4);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
