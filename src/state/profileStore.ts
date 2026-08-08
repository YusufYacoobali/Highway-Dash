import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { dayKey } from '@/domain/calendar';
import { CAR_CATALOG, CarDefinition, DEFAULT_CAR_ID, findCar } from '@/domain/cars';
import {
  calculatePayout,
  CrateReward,
  RunPayout,
  rollCrate,
  ShopBundle,
} from '@/domain/economy';
import {
  advanceMissions,
  findMission,
  isMissionComplete,
  MissionReward,
  MissionState,
  rollDailyMissions,
} from '@/domain/missions';
import { RunResult } from '@/domain/runResult';
import { RunModifier } from '@/domain/runModifier';
import { applySeasonXp, SEASON_PASS_PRICE_GEMS, SeasonProgress } from '@/domain/season';
import { advanceStreak, INITIAL_STREAK, StreakState } from '@/domain/streak';
import { buildRunTuning, RunTuning } from '@/domain/tuning';
import {
  INITIAL_UPGRADES,
  isMaxed,
  UpgradeId,
  UpgradeLevels,
  upgradeCost,
} from '@/domain/upgrades';

export interface DailyState {
  dayKey: string;
  missions: MissionState[];
  crateClaimed: boolean;
}

export interface ProfileState {
  coins: number;
  gems: number;
  crates: number;
  season: SeasonProgress;
  hasSeasonPass: boolean;
  bestScore: number;
  bestDistance: number;
  totalRuns: number;
  ownedCarIds: string[];
  selectedCarId: string;
  upgrades: UpgradeLevels;
  daily: DailyState;
  streak: StreakState;
  firstLaunchAt: number;
}

export interface RunSummary {
  run: RunResult;
  payout: RunPayout;
  tiersGained: number;
  isNewBest: boolean;
}

interface ProfileActions {
  /** Called on launch and on foreground; rotates dailies when the date flips. */
  syncDaily(today?: string): void;
  claimStreak(today?: string): MissionReward | null;
  completeRun(run: RunResult): RunSummary;
  equipCar(carId: string): void;
  purchaseCar(carId: string): boolean;
  purchaseUpgrade(upgradeId: UpgradeId): boolean;
  claimMission(templateId: string): MissionReward | null;
  claimDailyCrate(): CrateReward | null;
  purchaseBundle(bundle: ShopBundle): boolean;
  /** Buys the season pass with gems. False when the player cannot afford it. */
  purchaseSeasonPass(): boolean;
  resetProfile(): void;
}

export type ProfileStore = ProfileState & ProfileActions;

const INITIAL_PROFILE: ProfileState = {
  coins: 0,
  gems: 0,
  crates: 0,
  season: { tier: 1, xp: 0 },
  hasSeasonPass: false,
  bestScore: 0,
  bestDistance: 0,
  totalRuns: 0,
  ownedCarIds: [DEFAULT_CAR_ID],
  selectedCarId: DEFAULT_CAR_ID,
  upgrades: { ...INITIAL_UPGRADES },
  daily: { dayKey: '', missions: [], crateClaimed: false },
  streak: { ...INITIAL_STREAK },
  firstLaunchAt: 0,
};

function grant(state: ProfileState, reward: MissionReward): Partial<ProfileState> {
  return {
    coins: state.coins + (reward.coins ?? 0),
    gems: state.gems + (reward.gems ?? 0),
    crates: state.crates + (reward.crates ?? 0),
  };
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_PROFILE,

      syncDaily(today = dayKey()) {
        const state = get();
        const patch: Partial<ProfileState> = {};
        if (state.firstLaunchAt === 0) patch.firstLaunchAt = Date.now();
        if (state.daily.dayKey !== today) {
          patch.daily = { dayKey: today, missions: rollDailyMissions(today), crateClaimed: false };
        }
        if (Object.keys(patch).length > 0) set(patch);
      },

      claimStreak(today = dayKey()) {
        const state = get();
        const { state: nextStreak, reward } = advanceStreak(state.streak, today);
        if (!reward) return null;
        set({ streak: nextStreak, ...grant(state, reward) });
        return reward;
      },

      completeRun(run) {
        const state = get();
        const payout = calculatePayout(run, state.hasSeasonPass ? 2 : 1);
        const award = applySeasonXp(state.season, payout.xp);

        set({
          coins: state.coins + payout.coins,
          bestScore: Math.max(state.bestScore, run.score),
          bestDistance: Math.max(state.bestDistance, run.distance),
          totalRuns: state.totalRuns + 1,
          season: { tier: award.tier, xp: award.xp },
          daily: { ...state.daily, missions: advanceMissions(state.daily.missions, run) },
        });

        return {
          run,
          payout,
          tiersGained: award.tiersGained,
          // Score is the headline, so it is what "personal best" means now.
          isNewBest: run.score > state.bestScore,
        };
      },

      equipCar(carId) {
        if (!get().ownedCarIds.includes(carId)) return;
        set({ selectedCarId: carId });
      },

      purchaseCar(carId) {
        const state = get();
        if (state.ownedCarIds.includes(carId)) return false;

        const car = findCar(carId);
        const balance = car.currency === 'gems' ? state.gems : state.coins;
        if (balance < car.price) return false;

        set({
          ownedCarIds: [...state.ownedCarIds, carId],
          selectedCarId: carId,
          coins: car.currency === 'coins' ? state.coins - car.price : state.coins,
          gems: car.currency === 'gems' ? state.gems - car.price : state.gems,
        });
        return true;
      },

      purchaseUpgrade(upgradeId) {
        const state = get();
        const level = state.upgrades[upgradeId];
        if (isMaxed(level)) return false;

        const cost = upgradeCost(level);
        if (state.coins < cost) return false;

        set({
          coins: state.coins - cost,
          upgrades: { ...state.upgrades, [upgradeId]: level + 1 },
        });
        return true;
      },

      claimMission(templateId) {
        const state = get();
        const mission = state.daily.missions.find((m) => m.templateId === templateId);
        const template = findMission(templateId);
        if (!mission || !template || mission.claimed || !isMissionComplete(mission)) return null;

        set({
          ...grant(state, template.reward),
          daily: {
            ...state.daily,
            missions: state.daily.missions.map((m) =>
              m.templateId === templateId ? { ...m, claimed: true } : m,
            ),
          },
        });
        return template.reward;
      },

      claimDailyCrate() {
        const state = get();
        if (state.daily.crateClaimed) return null;

        const locked = CAR_CATALOG.filter((c) => !state.ownedCarIds.includes(c.id)).map((c) => c.id);
        const reward = rollCrate(locked);

        set({
          daily: { ...state.daily, crateClaimed: true },
          coins: state.coins + (reward.kind === 'coins' ? reward.amount : 0),
          gems: state.gems + (reward.kind === 'gems' ? reward.amount : 0),
          ownedCarIds:
            reward.kind === 'car' ? [...state.ownedCarIds, reward.carId] : state.ownedCarIds,
        });
        return reward;
      },

      purchaseBundle(bundle) {
        const state = get();
        if (bundle.costsGems !== undefined) {
          if (state.gems < bundle.costsGems) return false;
          set({
            gems: state.gems - bundle.costsGems,
            coins: state.coins + (bundle.grants.coins ?? 0),
          });
          return true;
        }
        // Real-money bundles land here after the store transaction resolves.
        set({
          coins: state.coins + (bundle.grants.coins ?? 0),
          gems: state.gems + (bundle.grants.gems ?? 0),
        });
        return true;
      },

      purchaseSeasonPass() {
        const state = get();
        if (state.hasSeasonPass) return false;
        if (state.gems < SEASON_PASS_PRICE_GEMS) return false;

        set({ hasSeasonPass: true, gems: state.gems - SEASON_PASS_PRICE_GEMS });
        return true;
      },

      resetProfile() {
        set({ ...INITIAL_PROFILE, firstLaunchAt: Date.now() });
      },
    }),
    {
      name: 'highway-dash/profile/v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Actions are plain functions and are dropped by JSON serialisation, so
      // the persisted payload is exactly `ProfileState`.
      version: 1,
    },
  ),
);

/* ------------------------------------------------------------------ */
/* Selectors — components subscribe to the narrowest slice they need.  */
/* ------------------------------------------------------------------ */

export const selectSelectedCar = (state: ProfileStore): CarDefinition =>
  findCar(state.selectedCarId);

/**
 * Not a hook selector: it allocates a fresh object, which would defeat
 * `useSyncExternalStore`'s snapshot caching. Callers memoise it instead.
 */
export const runTuningFor = (
  car: CarDefinition,
  upgrades: UpgradeLevels,
  modifier?: RunModifier,
): RunTuning => buildRunTuning(car, upgrades, modifier);

export const selectClaimableMissions = (state: ProfileStore): number =>
  state.daily.missions.filter((m) => !m.claimed && isMissionComplete(m)).length;

export const selectHasFreeCrate = (state: ProfileStore): boolean => !state.daily.crateClaimed;
