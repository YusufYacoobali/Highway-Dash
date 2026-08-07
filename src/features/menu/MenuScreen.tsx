import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, ChunkyButton, CoinChip, GemChip } from '@/ui/components';
import { alpha, palette, radii, spacing } from '@/ui/theme';

export interface MenuScreenProps {
  coins: number;
  gems: number;
  claimableMissions: number;
  onPlay(): void;
  onGarage(): void;
  onMissions(): void;
}

/** Minimal chrome over the real attract-mode highway, so the game sells itself before Play. */
export const MenuScreen: React.FC<MenuScreenProps> = ({
  coins,
  gems,
  claimableMissions,
  onPlay,
  onGarage,
  onMissions,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(3,11,26,0.46)',
          'rgba(3,11,26,0.02)',
          'rgba(3,11,26,0.06)',
          'rgba(3,11,26,0.90)',
        ]}
        locations={[0, 0.23, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.currencyRow, { top: insets.top + spacing.sm }]}>
        <CoinChip size="sm" value={coins} />
        <GemChip size="sm" value={gems} />
      </View>

      <View style={[styles.titleBlock, { top: insets.top + 52 }]} pointerEvents="none">
        <AppText variant="displayL" align="center" color={palette.white} style={styles.title}>
          HIGHWAY DASH
        </AppText>
        <AppText variant="caption" align="center" color={palette.cyanIce}>
          DODGE · BOOST · DESTROY
        </AppText>
      </View>

      <View style={styles.liveTag} pointerEvents="none">
        <View style={styles.liveDot} />
        <AppText variant="micro" color={alpha.white85}>LIVE CHAOS</AppText>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <View pointerEvents="none" style={styles.pitch}>
          <AppText variant="displayS" align="center" color={palette.white}>
            HOW FAR CAN YOU GET?
          </AppText>
          <AppText variant="micro" align="center" color={alpha.white62}>
            NEAR MISS FOR HEAT · NITRO THROUGH TRAFFIC
          </AppText>
        </View>

        <ChunkyButton onPress={onPlay} tone="green" height={76} pulse accessibilityLabel="Play">
          <AppText variant="displayM" style={styles.playText}>PLAY</AppText>
        </ChunkyButton>

        <View style={styles.navBar}>
          <NavAction label="GARAGE" onPress={onGarage} />
          <View style={styles.navDivider} />
          <NavAction label="MISSIONS" onPress={onMissions} badge={claimableMissions} />
        </View>

        <AppText variant="micro" align="center" color={alpha.white55}>
          DRAG WITH ONE FINGER · HIT ⚡ WITH THE OTHER
        </AppText>
      </View>
    </View>
  );
};

interface NavActionProps {
  label: string;
  onPress(): void;
  badge?: number;
}

const NavAction: React.FC<NavActionProps> = ({ label, onPress, badge = 0 }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [styles.navAction, pressed && styles.navPressed]}
  >
    <AppText variant="bodyStrong" color={palette.white}>{label}</AppText>
    {badge > 0 ? (
      <View style={styles.badge}>
        <AppText variant="micro" color={palette.ink}>{badge}</AppText>
      </View>
    ) : null}
  </Pressable>
);

const styles = StyleSheet.create({
  currencyRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    zIndex: 3,
  },
  titleBlock: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 2,
  },
  title: {
    fontSize: 48,
    lineHeight: 52,
    textShadowColor: 'rgba(2,9,22,0.85)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },
  liveTag: {
    position: 'absolute',
    top: '31%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(3,13,30,0.5)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.redHot,
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 24,
    gap: 12,
    zIndex: 3,
  },
  pitch: { gap: 2, marginBottom: 2 },
  playText: { fontSize: 36, lineHeight: 42 },
  navBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    backgroundColor: 'rgba(5,16,34,0.68)',
    borderWidth: 1,
    borderColor: alpha.white08,
  },
  navAction: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPressed: { opacity: 0.62 },
  navDivider: { width: 1, height: 22, backgroundColor: alpha.white14 },
  badge: {
    position: 'absolute',
    top: 7,
    right: 18,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
