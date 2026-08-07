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

/** How many tiers to show ahead of the player's current position. */
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
          <AppText variant="caption" color={alpha.white90}>
            {`TIER ${tier}`}
          </AppText>
          <AppText variant="caption" color={alpha.white90}>
            {`${xp}/${XP_PER_TIER} XP`}
          </AppText>
        </View>
        <ProgressBar progress={xp / XP_PER_TIER} height={16} trackColor="rgba(11,26,51,0.35)" />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {tiers.map((entry) => {
          const unlocked = entry.tier <= tier;
          return (
            <View
              key={entry.tier}
              style={[
                styles.row,
                { backgroundColor: unlocked ? alpha.white85 : 'rgba(255,255,255,0.4)' },
              ]}
            >
              <View
                style={[
                  styles.tierBadge,
                  { backgroundColor: unlocked ? palette.gold : alpha.inkTint14 },
                ]}
              >
                <AppText variant="displayS" color={unlocked ? palette.ink : palette.steel}>
                  {entry.tier}
                </AppText>
              </View>

              <View style={styles.rewards}>
                <View style={styles.freeReward}>
                  <AppText variant="micro" color={palette.inkFaint}>
                    FREE
                  </AppText>
                  <AppText variant="bodyStrong" color={palette.ink} numberOfLines={1}>
                    {entry.free}
                  </AppText>
                </View>

                <View
                  style={[
                    styles.premiumReward,
                    { opacity: unlocked && hasPass ? 1 : 0.75 },
                  ]}
                >
                  <AppText variant="micro" color="rgba(255,255,255,0.8)">
                    PASS
                  </AppText>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {entry.premium}
                  </AppText>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {hasPass ? (
          <View style={styles.ownedBanner}>
            <AppText variant="displayS" align="center">
              RUSH PASS ACTIVE
            </AppText>
            <AppText variant="caption" align="center" color={alpha.white85}>
              2× COINS ON EVERY RUN
            </AppText>
          </View>
        ) : (
          <ChunkyButton onPress={onUnlockPass} tone="green" height={66} depth={7} shine>
            <AppText variant="displayS">UNLOCK RUSH PASS</AppText>
            <AppText variant="caption" color={alpha.white85}>
              {`${SEASON_PASS_PRICE_GEMS} GEMS · 2X COINS ALL SEASON`}
            </AppText>
          </ChunkyButton>
        )}
      </View>
    </MetaScreen>
  );
};

const styles = StyleSheet.create({
  progressBlock: { marginHorizontal: 14, marginBottom: spacing.md },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  list: { paddingHorizontal: 14, paddingBottom: spacing.lg, gap: 9 },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 9, padding: 8, borderRadius: 18 },
  tierBadge: {
    width: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewards: { flex: 1, flexDirection: 'row', gap: 8 },
  freeReward: {
    flex: 1,
    borderRadius: 13,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: alpha.inkTint07,
  },
  premiumReward: {
    flex: 1,
    borderRadius: 13,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: palette.greenDeep,
  },
  footer: { paddingHorizontal: 14, paddingBottom: 34, paddingTop: spacing.sm },
  ownedBanner: {
    borderRadius: radii.xl,
    borderWidth: 3,
    borderColor: palette.greenLight,
    backgroundColor: 'rgba(11,26,51,0.4)',
    paddingVertical: spacing.md,
  },
});
