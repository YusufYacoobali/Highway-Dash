import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { crashHeadline, crashSubtitle } from '@/domain/runResult';
import { XP_PER_TIER } from '@/domain/season';
import type { RunSummary } from '@/state/profileStore';
import { AppText, ChunkyButton, CoinIcon, ProgressBar } from '@/ui/components';
import { palette, radii, softShadow, spacing } from '@/ui/theme';

export interface CrashScreenProps {
  summary: RunSummary;
  bestDistance: number;
  carName: string;
  seasonXp: number;
  onReplay(): void;
  onMenu(): void;
  onGarage(): void;
}

/**
 * Post-run summary. The layout is a deliberate funnel: the score is celebrated
 * first, the rewards land second, and the biggest, greenest control on screen
 * is the one that starts another run.
 */
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
    { label: 'TOP SPEED', value: `${run.topSpeed} KM/H` },
    { label: 'BEST COMBO', value: `x${run.bestCombo}` },
    { label: 'CAR', value: carName },
  ];

  return (
    <LinearGradient
      colors={['rgba(8,22,45,0.55)', 'rgba(8,22,45,0.88)']}
      style={[
        StyleSheet.absoluteFill,
        { paddingTop: insets.top + 30, paddingBottom: insets.bottom + spacing.lg },
      ]}
    >
      <View style={styles.headline}>
        <AppText
          variant="displayL"
          align="center"
          color={run.cause === 'BUSTED' ? palette.cyanIce : palette.redSoft}
          emboss="rgba(8,22,45,0.85)"
          style={styles.headlineText}
        >
          {crashHeadline(run.cause)}
        </AppText>
        <AppText variant="label" align="center" color="rgba(255,255,255,0.78)">
          {crashSubtitle(run.cause)}
        </AppText>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View>
            <AppText variant="caption" color={palette.inkFaint}>
              DISTANCE
            </AppText>
            <View style={styles.distanceRow}>
              <AppText variant="displayL" color={palette.ink} style={styles.distance}>
                {run.distance.toLocaleString()}
              </AppText>
              <AppText variant="displayS" color={palette.ink}>
                M
              </AppText>
            </View>
          </View>
          <View style={styles.bestBlock}>
            <AppText variant="caption" color={palette.inkFaint} align="right">
              {isNewBest ? 'NEW BEST' : 'BEST'}
            </AppText>
            <AppText variant="displayS" color={palette.goldDeep} align="right">
              {`${bestDistance.toLocaleString()} M`}
            </AppText>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statTile}>
              <AppText variant="micro" color={palette.inkFaint}>
                {stat.label}
              </AppText>
              <AppText variant="title" color={palette.ink} numberOfLines={1}>
                {stat.value}
              </AppText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.rewardRow}>
        <View style={[styles.rewardCard, { borderColor: palette.gold }]}>
          <CoinIcon size={27} />
          <View>
            <AppText variant="micro" color={palette.bluegrey}>
              COINS
            </AppText>
            <AppText variant="title">{`+${payout.coins.toLocaleString()}`}</AppText>
          </View>
        </View>

        <View style={[styles.rewardCard, styles.xpCard, { borderColor: palette.green }]}>
          <AppText variant="micro" color={palette.bluegrey}>
            SEASON XP
          </AppText>
          <View style={styles.xpRow}>
            <ProgressBar progress={seasonXp / XP_PER_TIER} style={styles.xpBar} />
            <AppText variant="bodyStrong" color={palette.greenSoft}>
              {`+${payout.xp}`}
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.actions}>
        <ChunkyButton onPress={onReplay} tone="green" height={80} depth={8} shine>
          <AppText variant="displayM" emboss="rgba(20,70,10,0.5)">
            RUN IT BACK
          </AppText>
        </ChunkyButton>

        <View style={styles.secondaryRow}>
          <ChunkyButton onPress={onMenu} tone="ghost" height={54} depth={0} style={styles.secondary}>
            <AppText variant="title">MENU</AppText>
          </ChunkyButton>
          <ChunkyButton onPress={onGarage} tone="gold" height={54} depth={5} style={styles.secondary}>
            <AppText variant="title" color={palette.ink}>
              GARAGE
            </AppText>
          </ChunkyButton>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headline: { paddingHorizontal: 18 },
  headlineText: { fontSize: 54, lineHeight: 56 },
  card: {
    marginTop: 18,
    marginHorizontal: 18,
    backgroundColor: palette.white,
    borderRadius: 26,
    padding: 17,
    ...softShadow(10),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 13,
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(20,33,61,0.15)',
    borderStyle: 'dashed',
  },
  distanceRow: { flexDirection: 'row', alignItems: 'baseline' },
  distance: { fontSize: 40, lineHeight: 44 },
  bestBlock: { alignItems: 'flex-end' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    paddingTop: 13,
  },
  statTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: palette.frost,
    borderRadius: 15,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  rewardRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginHorizontal: 18 },
  rewardCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: palette.navy500,
    borderWidth: 3,
    borderRadius: radii.lg,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  xpCard: { flexDirection: 'column', alignItems: 'stretch', gap: 4 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  xpBar: { flex: 1 },
  spacer: { flex: 1, minHeight: spacing.lg },
  actions: { paddingHorizontal: 18, gap: 11 },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondary: { flex: 1 },
});
