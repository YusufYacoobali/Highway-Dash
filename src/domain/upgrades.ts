export type UpgradeId = 'engine' | 'grip' | 'magnet' | 'nerve';

export interface UpgradeDefinition {
  id: UpgradeId;
  label: string;
  description: string;
  color: string;
}

export const MAX_UPGRADE_LEVEL = 5;

export const UPGRADE_CATALOG: readonly UpgradeDefinition[] = [
  { id: 'engine', label: 'ENGINE', description: 'Higher top speed, faster ramp', color: '#E8332E' },
  { id: 'grip', label: 'GRIP', description: 'Snappier steering response', color: '#24C6DC' },
  { id: 'magnet', label: 'MAGNET', description: 'Pull coins from other lanes', color: '#FFC42E' },
  { id: 'nerve', label: 'NERVE', description: 'Wider near-miss window', color: '#46C82B' },
];

export type UpgradeLevels = Record<UpgradeId, number>;

export const INITIAL_UPGRADES: UpgradeLevels = { engine: 0, grip: 0, magnet: 0, nerve: 0 };

/**
 * Costs escalate linearly so the first few levels land inside a single run's
 * earnings and later ones need a deliberate grind — the standard hybrid-casual
 * upgrade curve.
 */
export function upgradeCost(currentLevel: number): number {
  return 400 + currentLevel * 650;
}

export function isMaxed(level: number): boolean {
  return level >= MAX_UPGRADE_LEVEL;
}

export function totalUpgradeLevel(levels: UpgradeLevels): number {
  return UPGRADE_CATALOG.reduce((sum, upgrade) => sum + levels[upgrade.id], 0);
}
