import { daysBetweenKeys } from './calendar';
import { MissionReward } from './missions';

export const STREAK_LENGTH = 7;

/** Day 7 is the hook: a guaranteed gem payout for a full week of logins. */
export const STREAK_REWARDS: readonly MissionReward[] = [
  { coins: 150 },
  { coins: 250 },
  { gems: 5 },
  { coins: 500 },
  { crates: 1 },
  { coins: 900 },
  { gems: 30 },
];

export interface StreakState {
  /** 1-based day within the current week, 0 when never claimed. */
  day: number;
  lastClaimedDayKey: string | null;
}

export const INITIAL_STREAK: StreakState = { day: 0, lastClaimedDayKey: null };

export interface StreakAdvance {
  state: StreakState;
  /** Null when the streak was already claimed today. */
  reward: MissionReward | null;
}

/**
 * Consecutive days advance the streak; a missed day resets it to one. Claiming
 * twice in the same day is a no-op so the caller can run this on every launch.
 */
export function advanceStreak(state: StreakState, today: string): StreakAdvance {
  if (state.lastClaimedDayKey === today) return { state, reward: null };

  const gap = state.lastClaimedDayKey ? daysBetweenKeys(state.lastClaimedDayKey, today) : Infinity;
  const nextDay = gap === 1 ? (state.day % STREAK_LENGTH) + 1 : 1;

  return {
    state: { day: nextDay, lastClaimedDayKey: today },
    reward: STREAK_REWARDS[nextDay - 1],
  };
}
