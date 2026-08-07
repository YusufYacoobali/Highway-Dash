import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { crashHeadline, crashSubtitle } from '@/domain/runResult';
import { XP_PER_TIER } from '@/domain/season';
import type { RunSummary } from '@/state/profileStore';
import { AppText, ChunkyButton, CoinIcon, ProgressBar } from '@/ui/components';
import { alpha, palette, radii, spacing } from '@/ui/theme';

export interface CrashScreenProps {
  summary: RunSummary;
  bestDistance: number;
  carName: string;
  seasonXp: number;
  onReplay(): void;
  onMenu(): void;
  onGarage(): void;
}

export const CrashScreen: React.FC<CrashScreenProps> = ({
  summary,
  bestDistance,
  carName,
  seasonXp,
  onReplay,
  onMenu,
  onGarage,
}) => {
  const insets = useSafeAreaInsets();
  const { run, payout, isNewBest } = summary;

  const stats = [
    { label: 'NEAR MISSES', value: `${run.nearMisses}` },
    { label: 'TOP SPEED', value: `${run.topSpeed}` },
    { label: 'BEST COMBO', value: `x${run.bestCombo}` },
    { label: 'CAR', value: carName },
  ];

  return (
    <LinearGradient
      colors={['rgba(5,15,33,0.60)', 'rgba(5,15,33,0.96)']}
      style={[
        StyleSheet.absoluteFill,
        { paddingTop: insets.top + 22, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={styles.headline}>
        <AppText
          variant="displayM"
          align="center"
          color={run.cause === 'BUSTED' ? palette.cyanIce : palette.redSoft}
          style={styles.headlineText}
        >
          {crashHeadline(run.cause)}
        </AppText>
        <AppText variant="body" align="center" color={alpha.white55}>
          {crashSubtitle(run.cause)}
        </AppText>
      </View>

      <View style={styles.scoreBlock}>
        <AppText variant="caption" color={alpha.white45} align="center">DISTANCE</AppText>
        <View style={styles.distanceRow}>
          <AppText variant="displayXL" color={palette.white} style={styles.distance}>
            {run.distance.toLocaleString()}
          </AppText>
          <AppText variant="displayS" color={alpha.white55}>M</AppText>
        </View>
        <AppText variant="label" color={isNewBest ? palette.gold : alpha.white45} align="center">
          {isNewBest ? 'NEW PERSONAL BEST' : `BEST ${bestDistance.toLocaleString()} M`}
        </AppText>
      </View>

      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <View key={stat.label} style={[styles.stat, index % 2 === 0 && styles.statRightBorder]}>
            <AppText variant="micro" color={alpha.white45}>{stat.label}</AppText>
            <AppText variant="bodyStrong" color={palette.white} numberOfLines={1}>{stat.value}</AppText>
          </View>
        ))}
      </View>

      <View style={styles.rewards}>
        <View style={styles.rewardLine}>
          <View style={styles.rewardLabel}>
            <CoinIcon size={23} />
            <AppText variant="bodyStrong">COINS</AppText>
          </View>
          <AppText variant="title" color={palette.gold}>{`+${payout.coins.toLocaleString()}`}</AppText>
        </View>
        <View style={styles.rewardLine}>
          <AppText variant="bodyStrong">SEASON XP</AppText>
          <View style={styles.xpRight}>
            <ProgressBar progress={seasonXp / XP_PER_TIER} height={6} style={styles.xpBar} />
            <AppText variant="bodyStrong" color={palette.greenSoft}>{`+${payout.xp}`}</AppText>
          </View>
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <ChunkyButton onPress={onReplay} tone="green" height={68} shine>
          <AppText variant="title">RUN IT BACK</AppText>
        </ChunkyButton>

        <View style={styles.secondaryRow}>
          <ChunkyButton onPress={onMenu} tone="ghost" height={48} style={styles.secondary}>
            <AppText variant="bodyStrong">MENU</AppText>
          </ChunkyButton>
          <ChunkyButton onPress={onGarage} tone="ghost" height={48} style={styles.secondary}>
            <AppText variant="bodyStrong" color={palette.gold}>GARAGE</AppText>
          </ChunkyButton>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headline: { paddingHorizontal: 18 },
  headlineText: { fontSize: 38, lineHeight: 43 },
  scoreBlock: {
    marginTop: 26,
    alignItems: 'center',
  },
  distanceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  distance: { fontSize: 68, lineHeight: 72 },
  statsGrid: {
    marginTop: 24,
    marginHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: alpha.white08,
  },
  stat: {
    width: '50%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: alpha.white08,
  },
  statRightBorder: { borderRightWidth: 1, borderRightColor: alpha.white08 },
  rewards: { marginHorizontal: 20, marginTop: 14 },
  rewardLine: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: alpha.white08,
  },
  rewardLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  xpRight: { flexDirection: 'row', alignItems: 'center', gap: 9, width: '56%' },
  xpBar: { flex: 1 },
  spacer: { flex: 1, minHeight: spacing.lg },
  actions: { paddingHorizontal: 18, gap: 10 },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondary: { flex: 1, borderRadius: radii.lg },
});
