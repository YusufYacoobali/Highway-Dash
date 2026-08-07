import { CAR_CATALOG } from '@/domain/cars';
import type { PlayerSnapshot } from '@/services/engagement/notificationCopy';
import type { ProfileState } from '@/state/profileStore';

/** Projects the persisted profile down to just what re-engagement copy needs. */
export function playerSnapshot(profile: ProfileState): PlayerSnapshot {
  return {
    bestDistance: profile.bestDistance,
    streakDay: profile.streak.day,
    ownedCars: profile.ownedCarIds.length,
    totalCars: CAR_CATALOG.length,
  };
}
