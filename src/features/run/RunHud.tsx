import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RunEventId } from '@/engine/types';
import {
  useCombo,
  useDistance,
  useHasStarted,
  useNitroActive,
  useNitroReady,
  useRunCoins,
  useRunEvent,
  useRunEventRemaining,
  useRunEventVariant,
  useRunIntensity,
  useSpeed,
} from '@/game/telemetryStore';
import { AppText, BoltIcon, CoinChip, PauseIcon, TextPill } from '@/ui/components';
import { alpha, palette, radii, spacing } from '@/ui/theme';
import { PopLayer } from './PopLayer';
import { WantedMeter } from './WantedMeter';

export interface RunHudProps {
  onQuit(): void;
  onNitro(): void;
}

export const RunHud: React.FC<RunHudProps> = ({ onQuit, onNitro }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(5,16,34,0.62)', 'rgba(5,16,34,0)']}
        style={styles.topScrim}
      />
      <IntensityVignette />

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
          <PauseIcon size={14} />
        </Pressable>

        <View pointerEvents="none">
          <WantedMeter />
        </View>
      </View>

      <EventBanner />
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
  const nitro = useNitroActive();
  return (
    <View style={styles.speedRow}>
      <AppText
        variant="displayL"
        color={nitro || kmh > 300 ? palette.cyanIce : palette.white}
        style={[styles.speedNumber, nitro && styles.speedNitro]}
      >
        {kmh}
      </AppText>
      <AppText variant="caption" style={styles.speedUnit} color={nitro ? palette.cyanIce : alpha.white55}>
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

const EventBanner: React.FC = () => {
  const event = useRunEvent();
  const variant = useRunEventVariant();
  const remaining = useRunEventRemaining();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(-8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: event === 'cruise' ? 0 : 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 7,
        tension: 110,
        useNativeDriver: true,
      }),
    ]).start();
  }, [event, variant, opacity, translateY]);

  const presentation = eventPresentation(event, variant);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.eventBanner, { opacity, transform: [{ translateY }] }]}
    >
      <View style={[styles.eventDot, { backgroundColor: presentation.color }]} />
      <View>
        <AppText variant="caption" color={presentation.color} align="center">
          {presentation.label}
        </AppText>
        <AppText variant="micro" color={alpha.white62} align="center">
          {`${remaining}s`}
        </AppText>
      </View>
    </Animated.View>
  );
};

const ComboBanner: React.FC = () => {
  const combo = useCombo();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: combo > 1 ? 1 : 0,
      duration: 110,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    if (combo > 1) {
      scale.setValue(1.12);
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    }
  }, [combo, opacity, scale]);

  const color = combo >= 20 ? palette.redHot : combo >= 10 ? palette.cyanIce : palette.gold;
  const prefix = combo >= 20 ? 'CHAOS' : combo >= 10 ? 'UNHINGED' : 'COMBO';

  return (
    <Animated.View pointerEvents="none" style={[styles.comboBanner, { opacity, transform: [{ scale }] }]}>
      <AppText variant="displayS" align="center" color={color}>
        {`${prefix}  x${Math.max(2, combo)}`}
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
      <AppText variant="bodyStrong" align="center">DRAG TO STEER</AppText>
      <AppText variant="micro" align="center" color={alpha.white55}>
        NEAR MISS TO BUILD HEAT
      </AppText>
    </Animated.View>
  );
};

const NitroButton: React.FC<{ onPress(): void }> = ({ onPress }) => {
  const ready = useNitroReady();
  const active = useNitroActive();
  const event = useRunEvent();
  const frenzy = event === 'nitroRush';

  return (
    <View style={styles.nitroWrap}>
      {frenzy ? <AppText variant="micro" color={palette.cyanIce}>FRENZY</AppText> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nitro"
        accessibilityState={{ disabled: !ready }}
        disabled={!ready}
        onPress={onPress}
        style={({ pressed }) => [
          styles.nitro,
          frenzy && styles.nitroFrenzy,
          active && styles.nitroActive,
          !ready && !active && styles.nitroCooling,
          pressed && styles.nitroPressed,
        ]}
      >
        <BoltIcon size={34} />
      </Pressable>
    </View>
  );
};

const IntensityVignette: React.FC = () => {
  const intensity = useRunIntensity();
  return (
    <View
      pointerEvents="none"
      style={[styles.intensityVignette, { opacity: Math.max(0, intensity - 0.62) * 0.5 }]}
    />
  );
};

function eventPresentation(event: RunEventId, variant: number): { label: string; color: string } {
  const index = variant % 4;
  switch (event) {
    case 'coinRush':
      return { label: ['GOLDEN SWEEP', 'COIN SNAKE', 'LANE JACKPOT', 'COIN FEVER'][index], color: palette.gold };
    case 'construction':
      return { label: ['WORK ZONE', 'SLALOM', 'LANE SQUEEZE', 'CHICANE'][index], color: palette.gold };
    case 'tunnel':
      return { label: ['TUNNEL RUN', 'BLACKOUT RUN', 'NEON TUNNEL', 'UNDERGROUND'][index], color: palette.cyanIce };
    case 'nitroRush':
      return { label: ['NITRO FRENZY', 'FULL SEND', 'BOOST WINDOW', 'OVERTAKE MODE'][index], color: palette.cyanIce };
    case 'police':
      return { label: ['POLICE CHASE', 'INTERCEPTORS', 'HIGH HEAT', 'SIRENS'][index], color: palette.redHot };
    case 'roadblock':
      return { label: ['ROADBLOCK', 'DOUBLE GATE', 'DIAGONAL WALL', 'GAP TEST'][index], color: palette.redHot };
    case 'cruise':
    default:
      return { label: 'CLEAR ROAD', color: alpha.white62 };
  }
}

const styles = StyleSheet.create({
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 190 },
  intensityVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 7,
    borderColor: 'rgba(255,45,70,0.45)',
  },
  topRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  speedRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  speedNumber: { fontSize: 44, lineHeight: 44 },
  speedNitro: { transform: [{ skewX: '-3deg' }] },
  speedUnit: { fontSize: 12, letterSpacing: 1.4 },
  statChips: { flexDirection: 'row', gap: 6, marginTop: 6 },
  pauseButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(8,21,43,0.55)',
    borderWidth: 1,
    borderColor: alpha.white14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  eventBanner: {
    position: 'absolute',
    top: 126,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(5,16,34,0.62)',
  },
  eventDot: { width: 6, height: 6, borderRadius: 3 },
  comboBanner: { position: 'absolute', top: 184, left: 0, right: 0 },
  bottomRow: {
    marginTop: 'auto',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  hint: {
    flex: 1,
    alignSelf: 'flex-end',
    marginBottom: 9,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(5,16,34,0.56)',
  },
  nitroWrap: { alignItems: 'center', gap: 4 },
  nitro: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(31,165,224,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(127,224,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nitroFrenzy: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: palette.cyanMid,
    borderColor: palette.cyanIce,
  },
  nitroActive: { transform: [{ scale: 1.06 }] },
  nitroCooling: { opacity: 0.34 },
  nitroPressed: { transform: [{ scale: 0.94 }] },
});
