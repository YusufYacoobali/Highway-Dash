export interface PlayerSnapshot {
  bestDistance: number;
  streakDay: number;
  ownedCars: number;
  totalCars: number;
}

export interface NotificationCopy {
  title: string;
  body: string;
}

type CopyFactory = (player: PlayerSnapshot) => NotificationCopy;

/**
 * Rotating re-engagement copy. Each slot leans on a different hook — record,
 * streak, collection, curiosity — so a lapsed player never sees the same
 * message twice in a row.
 */
const COPY_ROTATION: readonly CopyFactory[] = [
  ({ bestDistance }) => ({
    title: 'The highway is empty 🏁',
    body: bestDistance
      ? `Your record still says ${bestDistance.toLocaleString()} m. Think you can beat it?`
      : 'Your first run is waiting. Weave, dodge, repeat.',
  }),
  ({ streakDay }) => ({
    title: 'Your streak is cooling off 🔥',
    body:
      streakDay > 0
        ? `Day ${streakDay} is banked. Log in to keep the run going.`
        : 'Log in two days running and the crates start stacking.',
  }),
  () => ({
    title: 'A free crate just unlocked 🎁',
    body: 'Coins, gems, or a brand new ride. One spin, no cost.',
  }),
  ({ ownedCars, totalCars }) => ({
    title: 'The garage has gaps 🚗',
    body: `You've collected ${ownedCars} of ${totalCars} cars. The rare ones drive very differently.`,
  }),
  () => ({
    title: 'Five stars and still driving? ⭐',
    body: 'Chain near-misses to max the wanted meter without getting boxed in.',
  }),
  () => ({
    title: 'New daily missions are live 📋',
    body: 'Three fresh objectives, three fresh payouts. Takes one run.',
  }),
];

export function copyForOccurrence(index: number, player: PlayerSnapshot): NotificationCopy {
  return COPY_ROTATION[index % COPY_ROTATION.length](player);
}

export const NOTIFICATION_ROTATION_LENGTH = COPY_ROTATION.length;
