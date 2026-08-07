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
import { alpha, palette, radii, spacing } from '@/ui/theme';

export interface MissionsScreenProps {
  missions: readonly MissionState[];
  streakDay: number;
  onBack(): void;
  onClaim(templateId: string): void;
  onPlay(): void;
}

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
        title="Daily missions"
        onBack={onBack}
        right={
          <AppText variant="caption" color={alpha.white55}>
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
              <View key={mission.templateId} style={styles.missionRow}>
                <View style={styles.missionTop}>
                  <View
                    style={[
                      styles.tick,
                      mission.claimed && styles.tickDone,
                    ]}
                  >
                    {mission.claimed ? <CheckIcon size={15} /> : null}
                  </View>

                  <View style={styles.missionText}>
                    <AppText variant="bodyStrong" color={palette.white}>
                      {template.title}
                    </AppText>
                    <AppText variant="body" color={alpha.white55}>
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
                      <AppText variant="label" color={palette.ink}>CLAIM</AppText>
                    </Pressable>
                  ) : (
                    <AppText variant="label" color={complete ? palette.greenSoft : alpha.white62}>
                      {`${progress.toLocaleString()}/${template.goal.toLocaleString()}`}
                    </AppText>
                  )}
                </View>

                <ProgressBar
                  progress={progress / template.goal}
                  height={6}
                  trackColor={alpha.white08}
                  colors={complete ? [palette.greenLight, palette.greenDeep] : [palette.goldLight, palette.goldDeep]}
                  style={styles.missionBar}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.streakSection}>
          <View style={styles.streakHeader}>
            <View>
              <AppText variant="caption" color={alpha.white55}>LOGIN STREAK</AppText>
              <AppText variant="bodyStrong" color={palette.white}>Keep the run alive</AppText>
            </View>
            <AppText variant="label" color={palette.gold}>{`DAY ${streakDay}/${STREAK_LENGTH}`}</AppText>
          </View>

          <View style={styles.streakRow}>
            {Array.from({ length: STREAK_LENGTH }, (_, index) => {
              const day = index + 1;
              const claimed = day < streakDay;
              const today = day === streakDay;
              return (
                <View key={day} style={styles.streakDayWrap}>
                  <View
                    style={[
                      styles.streakDot,
                      claimed && styles.streakClaimed,
                      today && styles.streakToday,
                    ]}
                  />
                  <AppText variant="micro" color={today ? palette.gold : alpha.white55}>
                    {day}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <ChunkyButton onPress={onPlay} tone="green" height={64} shine>
          <AppText variant="title">PLAY</AppText>
        </ChunkyButton>
      </View>
    </MetaScreen>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.lg },
  missionList: { paddingHorizontal: 16 },
  missionRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: alpha.white08,
  },
  missionTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  missionText: { flex: 1 },
  tick: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: alpha.white14,
    backgroundColor: alpha.white05,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickDone: { backgroundColor: palette.green, borderColor: palette.green },
  claimButton: {
    backgroundColor: palette.gold,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.96 }] },
  missionBar: { marginTop: 11, marginLeft: 39 },
  streakSection: {
    marginTop: 22,
    marginHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: alpha.white14,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  streakRow: { flexDirection: 'row', gap: 7 },
  streakDayWrap: { flex: 1, alignItems: 'center', gap: 5 },
  streakDot: {
    width: 22,
    height: 6,
    borderRadius: 3,
    backgroundColor: alpha.white14,
  },
  streakClaimed: { backgroundColor: palette.green },
  streakToday: { backgroundColor: palette.gold, height: 8 },
  footer: { paddingHorizontal: 16, paddingBottom: 30, paddingTop: spacing.sm },
});
