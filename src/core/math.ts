export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const clamp01 = (value: number): number => clamp(value, 0, 1);

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/**
 * Frame-rate independent approach towards `to`. `rate` is roughly "how many
 * times per second the remaining gap is closed", which keeps tuning readable.
 */
export const damp = (from: number, to: number, rate: number, dt: number): number =>
  lerp(from, to, clamp01(rate * dt));

export const randomRange = (min: number, max: number): number => min + Math.random() * (max - min);

export const randomInt = (maxExclusive: number): number => Math.floor(Math.random() * maxExclusive);

export const pickRandom = <T>(items: readonly T[]): T => items[randomInt(items.length)];

export const randomSign = (): number => (Math.random() > 0.5 ? 1 : -1);
