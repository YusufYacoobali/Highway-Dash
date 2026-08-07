import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatCountdown, msUntilMidnight } from '@/domain/calendar';
import {
  describeReward,
  findMission,
  isMissionComplete,
  type MissionState,
} from '@/domain/missions';
import { STREAK_LENGTH } from '@/domain/streak';
import {
  AppText,
  CheckIcon,
  ChunkyButton,
  MetaScreen,
  ProgressBar,
  ScreenHeader,
  shopGradient,
} from '@/ui/components';
import { useMinuteTick } from '@/ui/hooks/useMinuteTick';
import { alpha, palette, radii, softShadow, spacing } from '@/ui/theme';

export interface MissionsScreenProps {
  missions: readonly MissionState[];
  streakDay: number;
  onBack(): void;
  onClaim(templateId: string): void;
  onPlay(): void;
}

/** Dailies plus the seven-day login ladder — the two-day return loop's payoff. */
export const MissionsScreen: React.FC<MissionsScreenProps> = ({
  missions,
  streakDay,
  onBack,
  onClaim,
  onPlay,
}) => {
  useMinuteTick();

  return (
  <MetaScreen colors={shopGradient}>
    <ScreenHeader
      title="DAILY MISSIONS"
      onBack={onBack}
      right={
        <AppText variant="label" color={palette.navy500}>
          {`${formatCountdown(msUntilMidnight())} LEFT`}
        </AppText>
      }
    />

    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.missionList}>
        {missions.map((mission) => {
          const template = findMission(mission.templateId);
          if (!template) return null;

          const complete = isMissionComplete(mission);
          const claimable = complete && !mission.claimed;
          const progress = Math.min(mission.progress, template.goal);

          return (
            <View key={mission.templateId} style={styles.missionCard}>
              <View style={styles.missionTop}>
                <View
                  style={[
                    styles.tick,
                    { backgroundColor: mission.claimed ? palette.green : alpha.inkTint12 },
                  ]}
                >
                  {mission.claimed ? <CheckIcon size={16} /> : null}
                </View>

                <View style={styles.missionText}>
                  <AppText variant="bodyStrong" color={palette.ink}>
                    {template.title}
                  </AppText>
                  <AppText variant="body" color={palette.inkMuted}>
                    {describeReward(template.reward)}
                  </AppText>
                </View>

                {claimable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Claim ${template.title}`}
                    onPress={() => onClaim(mission.templateId)}
                    style={({ pressed }) => [styles.claimButton, pressed && styles.pressed]}
                  >
                    <AppText variant="label">CLAIM</AppText>
                  </Pressable>
                ) : (
                  <AppText variant="bodyStrong" color={palette.goldDeep}>
                    {`${progress.toLocaleString()}/${template.goal.toLocaleString()}`}
                  </AppText>
                )}
              </View>

              <ProgressBar
                progress={progress / template.goal}
                height={9}
                trackColor={alpha.inkTint12}
                colors={
                  complete
                    ? [palette.greenLight, palette.greenDeep]
                    : [palette.goldLight, palette.goldDeep]
                }
                style={styles.missionBar}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.streakCard}>
        <View style={styles.streakHeader}>
          <AppText variant="caption" color={palette.navy500}>
            LOGIN STREAK
          </AppText>
          <AppText variant="label" color={palette.navy500}>
            {`DAY ${streakDay} / ${STREAK_LENGTH}`}
          </AppText>
        </View>

        <View style={styles.streakRow}>
          {Array.from({ length: STREAK_LENGTH }, (_, index) => {
            const day = index + 1;
            const claimed = day < streakDay;
            const today = day === streakDay;
            return (
              <View
                key={day}
                style={[
                  styles.streakDay,
                  {
                    backgroundColor: claimed
                      ? palette.green
                      : today
                        ? palette.gold
                        : alpha.white55,
                  },
                ]}
              >
                <AppText variant="bodyStrong" color={claimed ? palette.white : palette.ink}>
                  {day}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>

    <View style={styles.footer}>
      <ChunkyButton onPress={onPlay} tone="green" height={72} depth={7} shine>
        <AppText variant="displayM">PLAY</AppText>
      </ChunkyButton>
    </View>
  </MetaScreen>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.lg },
  missionList: { paddingHorizontal: 14, gap: 11 },
  missionCard: { backgroundColor: palette.white, borderRadius: 20, padding: 13, ...softShadow(5) },
  missionTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  missionText: { flex: 1 },
  tick: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  claimButton: {
    backgroundColor: palette.green,
    borderRadius: radii.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  missionBar: { marginTop: 10 },
  streakCard: {
    marginTop: spacing.lg,
    marginHorizontal: 14,
    backgroundColor: alpha.white28,
    borderWidth: 2.5,
    borderColor: alpha.white55,
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  streakRow: { flexDirection: 'row', gap: 6 },
  streakDay: {
    flex: 1,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: 14, paddingBottom: 34, paddingTop: spacing.sm },
});
