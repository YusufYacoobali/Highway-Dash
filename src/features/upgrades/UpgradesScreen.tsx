import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { CarDefinition } from '@/domain/cars';
import {
  MAX_UPGRADE_LEVEL,
  UPGRADE_CATALOG,
  type UpgradeId,
  type UpgradeLevels,
  isMaxed,
  upgradeCost,
} from '@/domain/upgrades';
import { AppText, CoinChip, MetaScreen, ScreenHeader } from '@/ui/components';
import { alpha, palette, radii, softShadow, spacing } from '@/ui/theme';

export interface UpgradesScreenProps {
  coins: number;
  car: CarDefinition;
  levels: UpgradeLevels;
  onBack(): void;
  onBuy(upgradeId: UpgradeId): void;
}

/** Four parallel upgrade tracks, five levels each — the long-tail coin sink. */
export const UpgradesScreen: React.FC<UpgradesScreenProps> = ({
  coins,
  car,
  levels,
  onBack,
  onBuy,
}) => (
  <MetaScreen>
    <ScreenHeader
      title="UPGRADES"
      onBack={onBack}
      right={<CoinChip size="sm" value={coins} />}
    />

    <View style={styles.equipped}>
      <View style={[styles.carChip, { backgroundColor: car.bodyColor }]} />
      <View>
        <AppText variant="caption" color={palette.inkMuted}>
          EQUIPPED
        </AppText>
        <AppText variant="title" color={palette.ink}>
          {car.name}
        </AppText>
      </View>
    </View>

    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {UPGRADE_CATALOG.map((upgrade) => {
        const level = levels[upgrade.id];
        const maxed = isMaxed(level);
        const cost = upgradeCost(level);
        const affordable = coins >= cost;

        return (
          <View key={upgrade.id} style={styles.row}>
            <View style={styles.rowTop}>
              <View style={[styles.icon, { backgroundColor: upgrade.color }]} />
              <View style={styles.rowText}>
                <AppText variant="title" color={palette.ink}>
                  {upgrade.label}
                </AppText>
                <AppText variant="body" color={palette.inkMuted}>
                  {upgrade.description}
                </AppText>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={maxed ? `${upgrade.label} maxed` : `Upgrade ${upgrade.label} for ${cost} coins`}
                accessibilityState={{ disabled: maxed || !affordable }}
                disabled={maxed || !affordable}
                onPress={() => onBuy(upgrade.id)}
                style={({ pressed }) => [
                  styles.buyButton,
                  { backgroundColor: maxed || !affordable ? palette.frostAlt : palette.green },
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant="label" color={maxed || !affordable ? palette.slate : palette.white}>
                  {maxed ? 'MAX' : cost.toLocaleString()}
                </AppText>
              </Pressable>
            </View>

            <View style={styles.pips}>
              {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.pip,
                    { backgroundColor: index < level ? upgrade.color : alpha.inkTint12 },
                  ]}
                />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  </MetaScreen>
);

const styles = StyleSheet.create({
  equipped: {
    marginHorizontal: 14,
    marginBottom: 14,
    backgroundColor: alpha.white75,
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  carChip: {
    width: 46,
    height: 62,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: 'rgba(20,33,61,0.35)',
  },
  list: { paddingHorizontal: 14, paddingBottom: 40, gap: 11 },
  row: {
    backgroundColor: palette.white,
    borderRadius: 20,
    padding: 13,
    ...softShadow(5),
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowText: { flex: 1 },
  icon: { width: 42, height: 42, borderRadius: radii.md },
  buyButton: {
    borderRadius: radii.md,
    paddingVertical: 9,
    paddingHorizontal: 14,
    minWidth: 66,
    alignItems: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  pips: { flexDirection: 'row', gap: 5, marginTop: spacing.md },
  pip: { flex: 1, height: 10, borderRadius: 5 },
});
