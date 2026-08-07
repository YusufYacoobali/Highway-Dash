import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useCombo,
  useDistance,
  useHasStarted,
  useNitroReady,
  useRunCoins,
  useSpeed,
} from '@/game/telemetryStore';
import { AppText, BoltIcon, CoinChip, PauseIcon, TextPill } from '@/ui/components';
import { alpha, palette, radii, spacing } from '@/ui/theme';
import { PopLayer } from './PopLayer';
import { WantedMeter } from './WantedMeter';

export interface RunHudProps {
  /** Ends the run and returns to the menu, banking what has been earned. */
  onQuit(): void;
  onNitro(): void;
}

/**
 * Heads-up display for an active run. Every readout subscribes to its own
 * telemetry field, so the speed counter ticking at 15 Hz never forces the
 * wanted meter or the nitro button to re-render.
 */
export const RunHud: React.FC<RunHudProps> = ({ onQuit, onNitro }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(8,24,48,0.5)', 'rgba(8,24,48,0)']}
        style={styles.topScrim}
      />

      <View style={[styles.topRow, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View pointerEvents="none">
          <SpeedReadout />
          <View style={styles.statChips}>
            <CoinChipReadout />
            <DistanceReadout />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="End run and return to menu"
          onPress={onQuit}
          hitSlop={10}
          style={({ pressed }) => [styles.pauseButton, pressed && styles.pressed]}
        >
          <PauseIcon size={15} />
        </Pressable>

        <View pointerEvents="none">
          <WantedMeter />
        </View>
      </View>

      <ComboBanner />
      <PopLayer />

      <View
        style={[styles.bottomRow, { paddingBottom: insets.bottom + spacing.lg }]}
        pointerEvents="box-none"
      >
        <SteerHint />
        <NitroButton onPress={onNitro} />
      </View>
    </View>
  );
};

const SpeedReadout: React.FC = () => {
  const kmh = useSpeed();
  return (
    <View style={styles.speedRow}>
      <AppText
        variant="displayL"
        color={kmh > 250 ? palette.cyanIce : palette.white}
        emboss={palette.navy200}
        style={styles.speedNumber}
      >
        {kmh}
      </AppText>
      <AppText variant="caption" style={styles.speedUnit}>
        KM/H
      </AppText>
    </View>
  );
};

const CoinChipReadout: React.FC = () => <CoinChip size="sm" value={useRunCoins()} />;

const DistanceReadout: React.FC = () => (
  <TextPill>
    <AppText variant="bodyStrong">{`${useDistance().toLocaleString()} M`}</AppText>
  </TextPill>
);

const ComboBanner: React.FC = () => {
  const combo = useCombo();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: combo > 1 ? 1 : 0,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [combo, opacity]);

  return (
    <Animated.View pointerEvents="none" style={[styles.comboBanner, { opacity }]}>
      <AppText variant="displayM" align="center" color={palette.gold} emboss={palette.goldShadow}>
        {`COMBO x${Math.max(2, combo)}`}
      </AppText>
    </Animated.View>
  );
};

const SteerHint: React.FC = () => {
  const started = useHasStarted();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: started ? 0 : 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [opacity, started]);

  return (
    <Animated.View pointerEvents="none" style={[styles.hint, { opacity }]}>
      <AppText variant="displayS" align="center">
        DRAG TO STEER
      </AppText>
      <AppText variant="caption" align="center" color={palette.gold}>
        ANYWHERE ON THE ROAD
      </AppText>
    </Animated.View>
  );
};

const NitroButton: React.FC<{ onPress(): void }> = ({ onPress }) => {
  const ready = useNitroReady();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nitro"
      accessibilityState={{ disabled: !ready }}
      disabled={!ready}
      onPress={onPress}
      style={({ pressed }) => [
        styles.nitro,
        !ready && styles.nitroCooling,
        pressed && styles.nitroPressed,
      ]}
    >
      <BoltIcon size={38} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 190 },
  topRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  speedRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  speedNumber: { fontSize: 46, lineHeight: 46 },
  speedUnit: { fontSize: 14, letterSpacing: 1.4 },
  statChips: { flexDirection: 'row', gap: 7, marginTop: 7 },
  pauseButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(11,26,51,0.7)',
    borderWidth: 3,
    borderColor: alpha.white55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
  comboBanner: { position: 'absolute', top: 176, left: 0, right: 0 },
  bottomRow: {
    marginTop: 'auto',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  hint: {
    flex: 1,
    alignSelf: 'flex-end',
    marginBottom: 12,
    backgroundColor: 'rgba(11,26,51,0.82)',
    borderWidth: 3,
    borderColor: alpha.white45,
    borderRadius: radii.lg,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  nitro: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: palette.cyanMid,
    borderWidth: 4,
    borderColor: palette.cyanBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nitroCooling: { opacity: 0.45 },
  nitroPressed: { transform: [{ translateY: 4 }] },
});
