export type CrashCause = 'SMASHED' | 'BUSTED';

/** Everything a finished run reports back to the meta game. */
export interface RunResult {
  cause: CrashCause;
  /** Metres travelled, already rounded for display. */
  distance: number;
  /** Coins picked up plus near-miss bonuses during the run. */
  coins: number;
  nearMisses: number;
  bestCombo: number;
  topSpeed: number;
  wantedPeak: number;
  /** Seconds of wall clock the run lasted. */
  duration: number;
}

export const EMPTY_RUN: RunResult = {
  cause: 'SMASHED',
  distance: 0,
  coins: 0,
  nearMisses: 0,
  bestCombo: 0,
  topSpeed: 90,
  wantedPeak: 0,
  duration: 0,
};

export const crashHeadline = (cause: CrashCause): string =>
  cause === 'BUSTED' ? 'BUSTED!' : 'SMASHED!';

export const crashSubtitle = (cause: CrashCause): string =>
  cause === 'BUSTED' ? 'THE COPS BOXED YOU IN' : 'YOU KISSED A MINIVAN';
