import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  MAX_TIER,
  SEASON_NAME,
  SEASON_NUMBER,
  SEASON_PASS_PRICE_GEMS,
  XP_PER_TIER,
  seasonDaysLeft,
  seasonTiers,
} from '@/domain/season';
import {
  AppText,
  ChunkyButton,
  MetaScreen,
  ProgressBar,
  ScreenHeader,
  seasonGradient,
} from '@/ui/components';
import { alpha, palette, radii, spacing } from '@/ui/theme';

export interface SeasonScreenProps {
  tier: number;
  xp: number;
  hasPass: boolean;
  onBack(): void;
  onUnlockPass(): void;
}

const VISIBLE_TIERS = 10;

export const SeasonScreen: React.FC<SeasonScreenProps> = ({
  tier,
  xp,
  hasPass,
  onBack,
  onUnlockPass,
}) => {
  const from = Math.max(1, Math.min(tier, MAX_TIER - VISIBLE_TIERS + 1));
  const tiers = seasonTiers(from, VISIBLE_TIERS);

  return (
    <MetaScreen colors={seasonGradient}>
      <ScreenHeader
        title={SEASON_NAME}
        subtitle={`SEASON ${SEASON_NUMBER} · ${seasonDaysLeft()} DAYS LEFT`}
        onBack={onBack}
      />

      <View style={styles.progressBlock}>
        <View style={styles.progressLabels}>
          <AppText variant="bodyStrong" color={palette.white}>{`TIER ${tier}`}</AppText>
          <AppText variant="caption" color={alpha.white55}>{`${xp}/${XP_PER_TIER} XP`}</AppText>
        </View>
        <ProgressBar progress={xp / XP_PER_TIER} height={7} trackColor={alpha.white08} />
      </View>

      <View style={styles.columnLabels}>
        <AppText variant="micro" color={alpha.white45} style={styles.tierColumn}>TIER</AppText>
        <AppText variant="micro" color={alpha.white45} style={styles.rewardColumn}>FREE</AppText>
        <AppText variant="micro" color={palette.greenSoft} style={styles.rewardColumn}>PASS</AppText>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {tiers.map((entry) => {
          const unlocked = entry.tier <= tier;
          return (
            <View key={entry.tier} style={[styles.row, unlocked && styles.rowUnlocked]}>
              <View style={styles.tierColumn}>
                <View style={[styles.tierDot, unlocked && styles.tierDotUnlocked]} />
                <AppText variant="bodyStrong" color={unlocked ? palette.gold : alpha.white55}>
                  {entry.tier}
                </AppText>
              </View>

              <View style={styles.rewardColumn}>
                <AppText variant="bodyStrong" color={unlocked ? palette.white : alpha.white45} numberOfLines={1}>
                  {entry.free}
                </AppText>
              </View>

              <View style={styles.rewardColumn}>
                <AppText
                  variant="bodyStrong"
                  color={unlocked && hasPass ? palette.greenSoft : alpha.white45}
                  numberOfLines={1}
                >
                  {entry.premium}
                </AppText>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {hasPass ? (
          <View style={styles.ownedBanner}>
            <View style={styles.activeDot} />
            <View>
              <AppText variant="bodyStrong">RUSH PASS ACTIVE</AppText>
              <AppText variant="micro" color={alpha.white55}>2× COINS ON EVERY RUN</AppText>
            </View>
          </View>
        ) : (
          <ChunkyButton onPress={onUnlockPass} tone="green" height={62} shine>
            <View style={styles.passCta}>
              <AppText variant="bodyStrong">UNLOCK RUSH PASS</AppText>
              <AppText variant="micro" color={alpha.white75}>
                {`${SEASON_PASS_PRICE_GEMS} GEMS · 2X COINS`}
              </AppText>
            </View>
          </ChunkyButton>
        )}
      </View>
    </MetaScreen>
  );
};

const styles = StyleSheet.create({
  progressBlock: { marginHorizontal: 16, marginBottom: spacing.lg },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  columnLabels: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  list: { paddingHorizontal: 16, paddingBottom: spacing.lg },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: alpha.white08,
    opacity: 0.62,
  },
  rowUnlocked: { opacity: 1 },
  tierColumn: { width: 68, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rewardColumn: { flex: 1, paddingRight: 8 },
  tierDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: alpha.white14 },
  tierDotUnlocked: { backgroundColor: palette.gold },
  footer: { paddingHorizontal: 16, paddingBottom: 30, paddingTop: spacing.sm },
  ownedBanner: {
    minHeight: 58,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(107,224,74,0.28)',
    backgroundColor: 'rgba(70,200,43,0.10)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.greenLight },
  passCta: { alignItems: 'center', gap: 1 },
});
