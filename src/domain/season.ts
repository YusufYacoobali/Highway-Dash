export interface SeasonTier {
  tier: number;
  free: string;
  premium: string;
}

export const SEASON_NAME = 'RUSH HOUR';
export const SEASON_NUMBER = 1;
export const XP_PER_TIER = 600;
export const MAX_TIER = 30;
/** Priced just above the mid gem bundle — the classic battle-pass conversion. */
export const SEASON_PASS_PRICE_GEMS = 450;

const FREE_CYCLE = ['250 coins', '1 crate', '400 coins', '10 gems', '600 coins', '900 coins'];
const PREMIUM_CYCLE = [
  'HOT DOG WAGON',
  'Neon trail',
  '40 gems',
  '2× coin hour',
  'SHOPPING CART',
  '80 gems',
  'Siren horn',
  'STOLEN CRUISER',
];

/** Deterministic reward track so the UI and the grant logic never disagree. */
export function seasonTier(tier: number): SeasonTier {
  return {
    tier,
    free: FREE_CYCLE[(tier - 1) % FREE_CYCLE.length],
    premium: PREMIUM_CYCLE[(tier - 1) % PREMIUM_CYCLE.length],
  };
}

export function seasonTiers(from: number, count: number): SeasonTier[] {
  return Array.from({ length: count }, (_, i) => seasonTier(Math.min(MAX_TIER, from + i)));
}

export interface SeasonProgress {
  tier: number;
  xp: number;
}

export interface SeasonAward extends SeasonProgress {
  tiersGained: number;
}

/** Pure XP application so it can be unit tested without a store. */
export function applySeasonXp(current: SeasonProgress, xp: number): SeasonAward {
  let tier = current.tier;
  let total = current.xp + Math.max(0, xp);
  let tiersGained = 0;

  while (total >= XP_PER_TIER && tier < MAX_TIER) {
    total -= XP_PER_TIER;
    tier += 1;
    tiersGained += 1;
  }
  if (tier >= MAX_TIER) total = Math.min(total, XP_PER_TIER);

  return { tier, xp: total, tiersGained };
}

/** Days remaining in the current 30-day season window. */
export function seasonDaysLeft(now: Date = new Date()): number {
  const dayOfSeason = Math.floor(now.getTime() / 86_400_000) % 30;
  return 30 - dayOfSeason;
}
