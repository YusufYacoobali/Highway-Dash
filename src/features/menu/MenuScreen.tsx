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
      <Image source={{ uri: MENU_BACKGROUND_URI }} resizeMode="cover" style={StyleSheet.absoluteFill} pointerEvents="none" />

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(4,20,44,0.04)', 'rgba(4,20,44,0)', 'rgba(4,16,38,0.18)', 'rgba(4,13,30,0.84)']}
        locations={[0, 0.38, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.currencyRow, { top: insets.top + spacing.sm }]}>
        <CoinChip size="sm" value={coins} />
        <GemChip size="sm" value={gems} />
      </View>

      <View style={[styles.titleBlock, { top: insets.top + 54 }]} pointerEvents="none">
        <Image source={{ uri: MENU_LOGO_URI }} resizeMode="contain" style={styles.logo} />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}>
        <ChunkyButton onPress={onPlay} tone="green" height={72} shine pulse accessibilityLabel="Play">
          <AppText variant="displayM" style={styles.playText}>PLAY</AppText>
        </ChunkyButton>

        <View style={styles.navBar}>
          <NavAction label="GARAGE" onPress={onGarage} />
          <View style={styles.navDivider} />
          <NavAction label="MISSIONS" onPress={onMissions} badge={claimableMissions} />
        </View>

        <AppText variant="micro" align="center" color={alpha.white55}>
          DRAG TO STEER · TAP ⚡ TO SMASH THROUGH TRAFFIC
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
  logo: { width: '100%', height: 225 },
  footer: {
    marginTop: 'auto',
    paddingHorizontal: 24,
    gap: 12,
    zIndex: 3,
  },
  playText: { fontSize: 34, lineHeight: 40 },
  navBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    backgroundColor: 'rgba(5,16,34,0.66)',
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
