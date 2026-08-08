export type CrashCause = 'SMASHED' | 'BUSTED';

/** Everything a finished run reports back to the meta game. */
export interface RunResult {
  cause: CrashCause;
  /** The headline number: metres banked at the live risk multiplier. */
  score: number;
  /** Metres travelled, already rounded. Rendered as kilometres. */
  distance: number;
  /** Coins picked up plus near-miss bonuses during the run. */
  coins: number;
  nearMisses: number;
  /** Survivable grazes — each one cost most of a chain. */
  sideswipes: number;
  bestCombo: number;
  /** Highest risk multiplier held during the run. */
  bestMultiplier: number;
  topSpeed: number;
  wantedPeak: number;
  /** Seconds of wall clock the run lasted. */
  duration: number;
}

export const EMPTY_RUN: RunResult = {
  cause: 'SMASHED',
  score: 0,
  distance: 0,
  coins: 0,
  nearMisses: 0,
  sideswipes: 0,
  bestCombo: 0,
  bestMultiplier: 1,
  topSpeed: 90,
  wantedPeak: 0,
  duration: 0,
};

/** Metres to a short, readable kilometre string: 8_420 → "8.42". */
export const formatKm = (metres: number): string => {
  const km = metres / 1000;
  if (km >= 100) return km.toFixed(0);
  return km.toFixed(km >= 10 ? 1 : 2);
};

export const crashHeadline = (cause: CrashCause): string =>
  cause === 'BUSTED' ? 'BUSTED!' : 'SMASHED!';

export const crashSubtitle = (cause: CrashCause): string =>
  cause === 'BUSTED' ? 'THE COPS PIT-ED YOU OFF THE ROAD' : 'YOU KISSED A MINIVAN';
