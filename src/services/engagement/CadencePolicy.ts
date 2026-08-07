import { DAY_MS } from '@/domain/calendar';

/** The product requirement: re-engage on a two-day rhythm, not daily. */
export const EVERY_OTHER_DAY_MS = 2 * DAY_MS;

/**
 * Decides whether a periodic engagement action is due. Extracted so the
 * notification scheduler and the review prompter share one definition of
 * "every other day" and can both be tested without any native modules.
 */
export class CadencePolicy {
  constructor(private readonly intervalMs: number = EVERY_OTHER_DAY_MS) {}

  isDue(lastAt: number | null | undefined, now: number = Date.now()): boolean {
    if (!lastAt) return true;
    return now - lastAt >= this.intervalMs;
  }

  nextDueAt(lastAt: number | null | undefined, now: number = Date.now()): number {
    return (lastAt ?? now) + this.intervalMs;
  }

  /** Occurrence `index` (0-based) of the cadence, counted from `from`. */
  occurrenceAt(from: number, index: number): number {
    return from + this.intervalMs * index;
  }
}

export const everyOtherDay = new CadencePolicy(EVERY_OTHER_DAY_MS);
