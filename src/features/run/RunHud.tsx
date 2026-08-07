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
        colors={['rgba(8,24,48,0.62)', 'rgba(8,24,48,0)']}
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
          <PauseIcon size={15} />
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
        emboss={palette.navy200}
        style={[styles.speedNumber, nitro && styles.speedNitro]}
      >
        {kmh}
      </AppText>
      <AppText variant="caption" style={styles.speedUnit} color={nitro ? palette.cyanIce : undefined}>
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
  const remaining = useRunEventRemaining();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    opacity.setValue(event === 'cruise' ? 0.45 : 0);
    scale.setValue(0.88);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: event === 'cruise' ? 0.45 : 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [event, opacity, scale]);

  const presentation = eventPresentation(event);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.eventBanner,
        { borderColor: presentation.color, opacity, transform: [{ scale }] },
      ]}
    >
      <AppText variant="micro" color={presentation.color} align="center">
        LIVE EVENT
      </AppText>
      <AppText variant="title" color={palette.white} align="center">
        {presentation.label}
      </AppText>
      {event !== 'cruise' ? (
        <AppText variant="micro" color={alpha.white85} align="center">
          {`${remaining}s`}
        </AppText>
      ) : null}
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
      scale.setValue(1.18);
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
    }
  }, [combo, opacity, scale]);

  const color = combo >= 20 ? palette.redHot : combo >= 10 ? palette.cyanIce : palette.gold;
  const prefix = combo >= 20 ? 'CHAOS' : combo >= 10 ? 'UNHINGED' : 'COMBO';

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.comboBanner, { opacity, transform: [{ scale }] }]}
    >
      <AppText variant="displayM" align="center" color={color} emboss={palette.goldShadow}>
        {`${prefix} x${Math.max(2, combo)}`}
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
        CHASE GAPS · NEAR MISS FOR HEAT
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
      {frenzy ? (
        <AppText variant="micro" color={palette.cyanIce} align="center">
          FRENZY
        </AppText>
      ) : null}
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
        <BoltIcon size={38} />
      </Pressable>
    </View>
  );
};

const IntensityVignette: React.FC = () => {
  const intensity = useRunIntensity();
  return (
    <View
      pointerEvents="none"
      style={[styles.intensityVignette, { opacity: Math.max(0, intensity - 0.58) * 0.65 }]}
    />
  );
};

function eventPresentation(event: RunEventId): { label: string; color: string } {
  switch (event) {
    case 'coinRush':
      return { label: 'COIN RUSH', color: palette.gold };
    case 'construction':
      return { label: 'CONSTRUCTION', color: palette.gold };
    case 'tunnel':
      return { label: 'TUNNEL RUN', color: palette.cyanIce };
    case 'nitroRush':
      return { label: 'NITRO FRENZY', color: palette.cyanIce };
    case 'police':
      return { label: 'POLICE CHASE', color: palette.redHot };
    case 'roadblock':
      return { label: 'ROADBLOCK', color: palette.redHot };
    case 'cruise':
    default:
      return { label: 'CLEAR ROAD', color: alpha.white85 };
  }
}

const styles = StyleSheet.create({
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 205 },
  intensityVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 10,
    borderColor: 'rgba(255,45,70,0.58)',
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
  speedNumber: { fontSize: 46, lineHeight: 46 },
  speedNitro: { transform: [{ skewX: '-3deg' }] },
  speedUnit: { fontSize: 14, letterSpacing: 1.4 },
  statChips: { flexDirection: 'row', gap: 7, marginTop: 7 },
  pauseButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(11,26,51,0.72)',
    borderWidth: 3,
    borderColor: alpha.white55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
  eventBanner: {
    position: 'absolute',
    top: 122,
    alignSelf: 'center',
    minWidth: 145,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderRadius: 15,
    backgroundColor: 'rgba(7,20,43,0.80)',
  },
  comboBanner: { position: 'absolute', top: 205, left: 0, right: 0 },
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
  nitroWrap: { alignItems: 'center', gap: 4 },
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
  nitroFrenzy: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 6,
    backgroundColor: palette.cyanIce,
  },
  nitroActive: { transform: [{ scale: 1.08 }] },
  nitroCooling: { opacity: 0.42 },
  nitroPressed: { transform: [{ translateY: 4 }, { scale: 0.96 }] },
});
