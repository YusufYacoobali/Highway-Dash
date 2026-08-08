import { hashString, mulberry32 } from '@/core/rng';

export type RunModifierId =
  | 'standard'
  | 'rushHour'
  | 'goldFever'
  | 'openRoad'
  | 'heatWave'
  | 'featherweight';

/** UI tone token — the domain layer never imports the palette. */
export type ModifierTone = 'neutral' | 'gold' | 'red' | 'cyan' | 'green';

export interface RunModifier {
  id: RunModifierId;
  name: string;
  blurb: string;
  tone: ModifierTone;
  /** Multipliers applied on top of the car and upgrade tuning. */
  trafficScale: number;
  scoreScale: number;
  coinScale: number;
  speedScale: number;
  /** Above 1 means heat builds faster — fewer near-misses per star. */
  heatScale: number;
}

/**
 * Every player gets the same modifier on the same calendar day. It costs
 * nothing to run, it makes "what did you get today?" a real question, and it
 * stops every run from opening identically — which is the single cheapest
 * source of variance an endless runner has.
 */
export const RUN_MODIFIERS: readonly RunModifier[] = [
  {
    id: 'standard',
    name: 'CLEAN RUN',
    blurb: 'No modifiers. Just you and the road.',
    tone: 'neutral',
    trafficScale: 1,
    scoreScale: 1,
    coinScale: 1,
    speedScale: 1,
    heatScale: 1,
  },
  {
    id: 'rushHour',
    name: 'RUSH HOUR',
    blurb: 'Traffic +30%. Score +50%.',
    tone: 'red',
    trafficScale: 1.3,
    scoreScale: 1.5,
    coinScale: 1,
    speedScale: 1,
    heatScale: 1,
  },
  {
    id: 'goldFever',
    name: 'GOLD FEVER',
    blurb: 'Double coins. Slightly busier road.',
    tone: 'gold',
    trafficScale: 1.1,
    scoreScale: 1,
    coinScale: 2,
    speedScale: 1,
    heatScale: 1,
  },
  {
    id: 'openRoad',
    name: 'OPEN ROAD',
    blurb: 'Lighter traffic, much higher speed.',
    tone: 'cyan',
    trafficScale: 0.78,
    scoreScale: 1.15,
    coinScale: 1,
    speedScale: 1.22,
    heatScale: 1,
  },
  {
    id: 'heatWave',
    name: 'HEAT WAVE',
    blurb: 'Heat builds twice as fast. Score +30%.',
    tone: 'red',
    trafficScale: 1,
    scoreScale: 1.3,
    coinScale: 1,
    speedScale: 1,
    heatScale: 2,
  },
  {
    id: 'featherweight',
    name: 'FEATHERWEIGHT',
    blurb: 'Twitchier car, +75% score. Good luck.',
    tone: 'green',
    trafficScale: 1,
    scoreScale: 1.75,
    coinScale: 1,
    speedScale: 1.05,
    heatScale: 1,
  },
];

export const DEFAULT_MODIFIER = RUN_MODIFIERS[0];

const MODIFIER_INDEX = new Map(RUN_MODIFIERS.map((m) => [m.id, m]));

export function findModifier(id: RunModifierId): RunModifier {
  return MODIFIER_INDEX.get(id) ?? DEFAULT_MODIFIER;
}

/**
 * `standard` is deliberately excluded from the rotation — a day that reads
 * "no modifier" on the menu is a day the feature does nothing for you.
 */
export function modifierForDay(dayKey: string): RunModifier {
  const pool = RUN_MODIFIERS.filter((m) => m.id !== 'standard');
  const roll = mulberry32(hashString(`modifier:${dayKey}`))();
  return pool[Math.floor(roll * pool.length) % pool.length] ?? DEFAULT_MODIFIER;
}

/** Featherweight is the only modifier that touches handling. */
export function handlingScaleFor(modifier: RunModifier): number {
  return modifier.id === 'featherweight' ? 1.35 : 1;
}
