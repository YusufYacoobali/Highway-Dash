import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, ChunkyButton, CoinChip, GemChip } from '@/ui/components';
import { alpha, palette, radii, spacing } from '@/ui/theme';
import { MENU_BACKGROUND_URI } from './menuBackground';
import { MENU_LOGO_URI } from './menuLogo';

export interface MenuScreenProps {
  coins: number;
  gems: number;
  claimableMissions: number;
  onPlay(): void;
  onGarage(): void;
  onMissions(): void;
}

/**
 * The title screen uses generated art so the first impression matches the
 * polished hyper-casual reference rather than depending on the live GL scene.
 */
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
    <View style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: MENU_BACKGROUND_URI }}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(4,29,67,0.08)',
          'rgba(4,29,67,0)',
          'rgba(5,20,47,0.05)',
          'rgba(4,16,38,0.70)',
        ]}
        locations={[0, 0.34, 0.60, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.currencyRow, { top: insets.top + spacing.sm }]}>
        <CoinChip value={coins} />
        <GemChip value={gems} />
      </View>

      <View style={[styles.titleBlock, { top: insets.top + 58 }]} pointerEvents="none">
        <Image source={{ uri: MENU_LOGO_URI }} resizeMode="contain" style={styles.logo} />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <ChunkyButton
          onPress={onPlay}
          tone="green"
          height={92}
          depth={9}
          shine
          pulse
          accessibilityLabel="Play"
        >
          <AppText variant="displayL" emboss="rgba(20,70,10,0.55)" style={styles.playText}>
            PLAY
          </AppText>
        </ChunkyButton>

        <View style={styles.navRow}>
          <NavTile label="GARAGE" onPress={onGarage} />
          <NavTile label="MISSIONS" onPress={onMissions} badge={claimableMissions} />
        </View>

        <AppText variant="body" align="center" color={alpha.white85} style={styles.hint}>
          Drag anywhere to steer · tap ⚡ for nitro
        </AppText>
      </View>
    </View>
  );
};

interface NavTileProps {
  label: string;
  onPress(): void;
  badge?: number;
}

const NavTile: React.FC<NavTileProps> = ({ label, onPress, badge = 0 }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [styles.navTile, pressed && styles.navTilePressed]}
  >
    <AppText variant="bodyStrong" color={palette.white} numberOfLines={1}>
      {label}
    </AppText>
    {badge > 0 ? (
      <View style={styles.badge}>
        <AppText variant="micro" color={palette.ink}>
          {badge}
        </AppText>
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
    gap: 14,
    zIndex: 3,
  },
  titleBlock: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 2,
  },
  logo: {
    width: '100%',
    height: 245,
  },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 26,
    gap: spacing.md,
    zIndex: 3,
  },
  playText: { fontSize: 48, lineHeight: 54 },
  navRow: { flexDirection: 'row', gap: 10 },
  navTile: {
    flex: 1,
    height: 58,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(16,39,74,0.86)',
    borderWidth: 3,
    borderColor: alpha.white45,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  navTilePressed: {
    backgroundColor: alpha.navyGlassStrong,
    transform: [{ scale: 0.96 }],
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    textShadowColor: 'rgba(6,20,40,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
