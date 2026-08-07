import { RunResult } from './runResult';

export type MissionMetric = 'nearMisses' | 'wantedPeak' | 'distance' | 'coins' | 'runs' | 'topSpeed';

export interface MissionTemplate {
  id: string;
  title: string;
  metric: MissionMetric;
  goal: number;
  reward: MissionReward;
}

export interface MissionReward {
  coins?: number;
  gems?: number;
  crates?: number;
}

export interface MissionState {
  templateId: string;
  progress: number;
  claimed: boolean;
}

export const MISSION_POOL: readonly MissionTemplate[] = [
  { id: 'near25', title: 'Bank 25 near-misses', metric: 'nearMisses', goal: 25, reward: { coins: 300 } },
  { id: 'near60', title: 'Bank 60 near-misses', metric: 'nearMisses', goal: 60, reward: { coins: 750 } },
  { id: 'stars4', title: 'Reach 4 wanted stars', metric: 'wantedPeak', goal: 4, reward: { gems: 15 } },
  { id: 'stars5', title: 'Max out the wanted meter', metric: 'wantedPeak', goal: 5, reward: { gems: 25 } },
  { id: 'dist3k', title: 'Drive 3,000 m total', metric: 'distance', goal: 3000, reward: { crates: 1 } },
  { id: 'dist8k', title: 'Drive 8,000 m total', metric: 'distance', goal: 8000, reward: { coins: 900 } },
  { id: 'coins500', title: 'Collect 500 coins', metric: 'coins', goal: 500, reward: { gems: 10 } },
  { id: 'runs5', title: 'Finish 5 runs', metric: 'runs', goal: 5, reward: { coins: 400 } },
  { id: 'speed260', title: 'Hit 260 km/h', metric: 'topSpeed', goal: 260, reward: { gems: 12 } },
];

export const DAILY_MISSION_COUNT = 3;

const MISSION_INDEX = new Map(MISSION_POOL.map((m) => [m.id, m]));

export function findMission(templateId: string): MissionTemplate | undefined {
  return MISSION_INDEX.get(templateId);
}

/**
 * Deterministic daily rotation: the same day key always yields the same three
 * missions, so the set survives an app restart without extra persistence.
 */
export function rollDailyMissions(dayKey: string): MissionState[] {
  const seed = [...dayKey].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const picked: MissionTemplate[] = [];
  let cursor = seed;

  while (picked.length < DAILY_MISSION_COUNT) {
    cursor = (cursor * 1_664_525 + 1_013_904_223) >>> 0;
    const candidate = MISSION_POOL[cursor % MISSION_POOL.length];
    if (!picked.some((m) => m.metric === candidate.metric)) picked.push(candidate);
  }

  return picked.map((template) => ({ templateId: template.id, progress: 0, claimed: false }));
}

function metricValue(metric: MissionMetric, run: RunResult): number {
  switch (metric) {
    case 'nearMisses':
      return run.nearMisses;
    case 'wantedPeak':
      return run.wantedPeak;
    case 'distance':
      return run.distance;
    case 'coins':
      return run.coins;
    case 'topSpeed':
      return run.topSpeed;
    case 'runs':
      return 1;
  }
}

/** `wantedPeak` and `topSpeed` are bests, everything else accumulates. */
export function advanceMissions(missions: MissionState[], run: RunResult): MissionState[] {
  return missions.map((mission) => {
    const template = findMission(mission.templateId);
    if (!template || mission.claimed) return mission;

    const value = metricValue(template.metric, run);
    const isBestOf = template.metric === 'wantedPeak' || template.metric === 'topSpeed';
    const next = isBestOf ? Math.max(mission.progress, value) : mission.progress + value;

    return { ...mission, progress: Math.min(template.goal, next) };
  });
}

export function isMissionComplete(mission: MissionState): boolean {
  const template = findMission(mission.templateId);
  return !!template && mission.progress >= template.goal;
}

export function describeReward(reward: MissionReward): string {
  const parts: string[] = [];
  if (reward.coins) parts.push(`+${reward.coins.toLocaleString()} coins`);
  if (reward.gems) parts.push(`+${reward.gems} gems`);
  if (reward.crates) parts.push(`+${reward.crates} crate`);
  return parts.join(' · ');
}
