import * as StoreReview from 'expo-store-review';

import { everyOtherDay, type CadencePolicy } from './CadencePolicy';
import type { KeyValueStore } from '@/services/storage/keyValueStore';

const LAST_PROMPT_KEY = 'highway-dash/review/last-prompt-at';
/** Never ask before the player has actually experienced the game. */
const MIN_RUNS_BEFORE_PROMPT = 3;

export interface ReviewPrompter {
  /** Returns true when the native review sheet was actually requested. */
  maybePrompt(context: ReviewContext): Promise<boolean>;
}

export interface ReviewContext {
  totalRuns: number;
  /** Prompting right after a personal best is the highest-sentiment moment. */
  isPositiveMoment: boolean;
}

/**
 * Requests the native in-app review sheet on an every-other-day cadence.
 *
 * Two guards sit in front of the cadence: the player must have finished a few
 * runs, and the moment must be a good one. Both stores also silently rate-limit
 * these requests, so the timestamp is recorded whenever we *ask*, not whenever
 * a sheet is confirmed to have appeared.
 */
export class StoreReviewService implements ReviewPrompter {
  constructor(
    private readonly storage: KeyValueStore,
    private readonly cadence: CadencePolicy = everyOtherDay,
  ) {}

  async maybePrompt({ totalRuns, isPositiveMoment }: ReviewContext): Promise<boolean> {
    if (totalRuns < MIN_RUNS_BEFORE_PROMPT || !isPositiveMoment) return false;

    const lastPromptAt = await this.readLastPrompt();
    if (!this.cadence.isDue(lastPromptAt)) return false;

    if (!(await StoreReview.hasAction())) return false;

    await this.writeLastPrompt(Date.now());
    await StoreReview.requestReview();
    return true;
  }

  private async readLastPrompt(): Promise<number | null> {
    const raw = await this.storage.getItem(LAST_PROMPT_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async writeLastPrompt(at: number): Promise<void> {
    await this.storage.setItem(LAST_PROMPT_KEY, String(at));
  }
}
