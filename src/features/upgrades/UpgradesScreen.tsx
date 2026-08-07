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
import { alpha, palette, radii, spacing } from '@/ui/theme';

export interface UpgradesScreenProps {
  coins: number;
  car: CarDefinition;
  levels: UpgradeLevels;
  onBack(): void;
  onBuy(upgradeId: UpgradeId): void;
}

export const UpgradesScreen: React.FC<UpgradesScreenProps> = ({
  coins,
  car,
  levels,
  onBack,
  onBuy,
}) => (
  <MetaScreen>
    <ScreenHeader title="Upgrades" onBack={onBack} right={<CoinChip size="sm" value={coins} />} />

    <View style={styles.equipped}>
      <View style={[styles.carAccent, { backgroundColor: car.bodyColor }]} />
      <View style={styles.equippedText}>
        <AppText variant="caption" color={alpha.white45}>TUNING</AppText>
        <AppText variant="bodyStrong" color={palette.white}>{car.name}</AppText>
      </View>
      <AppText variant="label" color={alpha.white55}>BUILD</AppText>
    </View>

    <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      {UPGRADE_CATALOG.map((upgrade) => {
        const level = levels[upgrade.id];
        const maxed = isMaxed(level);
        const cost = upgradeCost(level);
        const affordable = coins >= cost;

        return (
          <View key={upgrade.id} style={styles.row}>
            <View style={[styles.iconMark, { backgroundColor: upgrade.color }]} />
            <View style={styles.rowContent}>
              <View style={styles.rowTop}>
                <View style={styles.rowText}>
                  <AppText variant="bodyStrong" color={palette.white}>{upgrade.label}</AppText>
                  <AppText variant="body" color={alpha.white55}>{upgrade.description}</AppText>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={maxed ? `${upgrade.label} maxed` : `Upgrade ${upgrade.label} for ${cost} coins`}
                  accessibilityState={{ disabled: maxed || !affordable }}
                  disabled={maxed || !affordable}
                  onPress={() => onBuy(upgrade.id)}
                  style={({ pressed }) => [
                    styles.buyButton,
                    maxed || !affordable ? styles.buyDisabled : styles.buyActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText variant="label" color={maxed || !affordable ? alpha.white45 : palette.ink}>
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
                      { backgroundColor: index < level ? upgrade.color : alpha.white08 },
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  </MetaScreen>
);

const styles = StyleSheet.create({
  equipped: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: alpha.white08,
  },
  carAccent: { width: 5, height: 34, borderRadius: radii.pill },
  equippedText: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: alpha.white08,
  },
  iconMark: { width: 4, borderRadius: radii.pill },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowText: { flex: 1 },
  buyButton: {
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 13,
    minWidth: 64,
    alignItems: 'center',
  },
  buyActive: { backgroundColor: palette.gold },
  buyDisabled: { backgroundColor: alpha.white08 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  pips: { flexDirection: 'row', gap: 5, marginTop: spacing.md },
  pip: { flex: 1, height: 5, borderRadius: 3 },
});
