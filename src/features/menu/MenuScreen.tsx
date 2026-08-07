import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, ChunkyButton, CoinChip, GemChip } from '@/ui/components';
import { alpha, palette, radii, spacing } from '@/ui/theme';

export interface MenuScreenProps {
  coins: number;
  gems: number;
  seasonTier: number;
  claimableMissions: number;
  hasFreeCrate: boolean;
  onPlay(): void;
  onGarage(): void;
  onMissions(): void;
  onShop(): void;
  onSeason(): void;
}

/**
 * The title screen. It deliberately has no background of its own — the live
 * attract-mode drive shows straight through, which is what sells the game
 * before the player taps anything.
 */
export const MenuScreen: React.FC<MenuScreenProps> = ({
  coins,
  gems,
  seasonTier,
  claimableMissions,
  hasFreeCrate,
  onPlay,
  onGarage,
  onMissions,
  onShop,
  onSeason,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(10,32,66,0.34)',
          'rgba(10,32,66,0)',
          'rgba(6,20,40,0)',
          'rgba(6,20,40,0.62)',
        ]}
        locations={[0, 0.26, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.currencyRow, { top: insets.top + spacing.sm }]}>
        <CoinChip value={coins} />
        <GemChip value={gems} />
      </View>

      <View style={[styles.titleBlock, { top: insets.top + 70 }]} pointerEvents="none">
        <AppText variant="displayXL" align="center" emboss={palette.navy300}>
          HIGHWAY
        </AppText>
        <AppText
          variant="displayXL"
          align="center"
          color={palette.gold}
          emboss={palette.goldShadow}
          style={styles.titleSecondLine}
        >
          DASH
        </AppText>
        <AppText variant="caption" align="center" style={styles.tagline}>
          ENDLESS TRAFFIC RUNNER
        </AppText>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <ChunkyButton onPress={onPlay} tone="green" height={88} depth={9} shine pulse accessibilityLabel="Play">
          <AppText variant="displayL" emboss="rgba(20,70,10,0.55)">
            PLAY
          </AppText>
        </ChunkyButton>

        <View style={styles.navRow}>
          <NavTile label="GARAGE" onPress={onGarage} />
          <NavTile label="MISSIONS" onPress={onMissions} badge={claimableMissions} />
          <NavTile label="SHOP" onPress={onShop} dot={hasFreeCrate} />
          <NavTile label="SEASON" caption={`TIER ${seasonTier}`} onPress={onSeason} />
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
  caption?: string;
  badge?: number;
  dot?: boolean;
}

const NavTile: React.FC<NavTileProps> = ({ label, onPress, caption, badge = 0, dot = false }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={caption ? `${label} ${caption}` : label}
    onPress={onPress}
    style={({ pressed }) => [styles.navTile, pressed && styles.navTilePressed]}
  >
    <AppText variant="caption" color={caption ? palette.gold : palette.white} numberOfLines={1}>
      {label}
    </AppText>
    {caption ? (
      <AppText variant="bodyStrong" numberOfLines={1}>
        {caption}
      </AppText>
    ) : null}
    {badge > 0 ? (
      <View style={styles.badge}>
        <AppText variant="micro" color={palette.ink}>
          {badge}
        </AppText>
      </View>
    ) : dot ? (
      <View style={styles.dot} />
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
  },
  titleBlock: { position: 'absolute', left: 0, right: 0 },
  titleSecondLine: { fontSize: 76, lineHeight: 72, marginTop: 2 },
  tagline: { marginTop: 12, fontSize: 14, letterSpacing: 2.6 },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 26,
    gap: spacing.md,
  },
  navRow: { flexDirection: 'row', gap: 9 },
  navTile: {
    flex: 1,
    height: 58,
    borderRadius: radii.lg,
    backgroundColor: alpha.navyGlass,
    borderWidth: 3,
    borderColor: alpha.white45,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  navTilePressed: { backgroundColor: alpha.navyGlassStrong, transform: [{ scale: 0.96 }] },
  // Badges sit inside the tile rather than overhanging it: Android clips
  // absolutely-positioned children against a rounded parent.
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.red,
  },
  hint: { textShadowColor: 'rgba(6,20,40,0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
});
