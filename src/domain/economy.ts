import { RunResult } from './runResult';

export interface RunPayout {
  coins: number;
  xp: number;
}

/** Distance is the dominant coin source so pushing further always pays. */
const COINS_PER_METRE = 1 / 12;
const XP_PER_METRE = 0.28;
const XP_PER_NEAR_MISS = 3;

export function calculatePayout(run: RunResult, coinMultiplier = 1): RunPayout {
  const distanceCoins = Math.round(run.distance * COINS_PER_METRE);
  return {
    coins: Math.round((run.coins + distanceCoins) * coinMultiplier),
    xp: Math.round(run.distance * XP_PER_METRE) + run.nearMisses * XP_PER_NEAR_MISS,
  };
}

export interface ShopBundle {
  id: string;
  amount: string;
  note: string;
  price: string;
  grants: { coins?: number; gems?: number };
  costsGems?: number;
}

export const GEM_BUNDLES: readonly ShopBundle[] = [
  { id: 'gems-80', amount: '80 GEMS', note: 'Starter stack', price: '$1.99', grants: { gems: 80 } },
  {
    id: 'gems-450',
    amount: '450 GEMS',
    note: 'Most popular · +15%',
    price: '$9.99',
    grants: { gems: 450 },
  },
  {
    id: 'gems-1200',
    amount: '1,200 GEMS',
    note: 'Best value · +30%',
    price: '$24.99',
    grants: { gems: 1200 },
  },
];

export const COIN_BUNDLES: readonly ShopBundle[] = [
  {
    id: 'coins-5k',
    amount: '5,000 COINS',
    note: 'Tune one track fully',
    price: '25 GEMS',
    grants: { coins: 5000 },
    costsGems: 25,
  },
  {
    id: 'coins-18k',
    amount: '18,000 COINS',
    note: '+20% bonus',
    price: '80 GEMS',
    grants: { coins: 18000 },
    costsGems: 80,
  },
];

export type CrateReward =
  | { kind: 'coins'; amount: number }
  | { kind: 'gems'; amount: number }
  | { kind: 'car'; carId: string };

const CRATE_WEIGHTS = { coins: 0.55, gems: 0.35 } as const;

/**
 * Daily crate roll. Car drops are deliberately rare — they are the reason to
 * come back tomorrow rather than a reliable progression source.
 */
export function rollCrate(lockedCarIds: readonly string[]): CrateReward {
  const roll = Math.random();
  if (roll < CRATE_WEIGHTS.coins) {
    return { kind: 'coins', amount: 200 + Math.floor(Math.random() * 6) * 100 };
  }
  if (roll < CRATE_WEIGHTS.coins + CRATE_WEIGHTS.gems || lockedCarIds.length === 0) {
    return { kind: 'gems', amount: 8 + Math.floor(Math.random() * 4) * 4 };
  }
  return { kind: 'car', carId: lockedCarIds[Math.floor(Math.random() * lockedCarIds.length)] };
}

export function describeCrateReward(reward: CrateReward, carName: (id: string) => string): string {
  switch (reward.kind) {
    case 'coins':
      return `CLAIMED · +${reward.amount.toLocaleString()} COINS`;
    case 'gems':
      return `CLAIMED · +${reward.amount} GEMS`;
    case 'car':
      return `CLAIMED · ${carName(reward.carId)}`;
  }
}
