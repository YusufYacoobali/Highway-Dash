import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatKm } from '@/domain/runResult';
import { HEAT } from '@/engine/config';
import type { GateKind } from '@/engine/types';
import {
  useBustThreat,
  useChainRemaining,
  useDistance,
  useDraftCharge,
  useDrafting,
  useDriftMode,
  useGateApproaching,
  useGateBoost,
  useGateKind,
  useGateRiskSide,
  useHasStarted,
  useMultiplier,
  useNitroActive,
  useNitroGraceActive,
  useNitroGraceRemaining,
  useNitroReady,
  useNitroRemaining,
  usePlayerSide,
  usePoliceProximity,
  useRunCoins,
  useRunEvent,
  useRunIntensity,
  useScore,
} from '@/game/telemetryStore';
import { AppText, BoltIcon, CoinChip, TextPill } from '@/ui/components';
import { alpha, palette, radii, spacing } from '@/ui/theme';
import { PopLayer } from './PopLayer';
import { WantedMeter } from './WantedMeter';

export interface RunHudProps {
  onNitro(): void;
}

/**
 * Score, the two numbers that feed it, and the wanted stars. Nothing else.
 *
 * Every label that only narrated background state — event names, nitro status,
 * the heat descriptor, the daily modifier — is gone. If the player cannot act
 * on it, the road should be showing it instead of the HUD saying it.
 */
export const RunHud: React.FC<RunHudProps> = ({ onNitro }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(5,16,34,0.62)', 'rgba(5,16,34,0)']}
        style={styles.topScrim}
      />
      <IntensityVignette />
      <NitroVignette />
      <SirenWash />
      <BustVignette />

      <View style={[styles.hudTop, { top: insets.top + spacing.sm }]} pointerEvents="none">
        <View style={styles.primaryRow}>
          <ScoreReadout />
          <View style={styles.statChips}>
            <CoinChipReadout />
            <DistanceReadout />
          </View>
        </View>

        <View style={styles.contextRow}>
          <WantedMeter />
        </View>

        <BustWarning />
      </View>

      <GatePrompt />
      <PopLayer />
      <DraftMeter />

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

function multiplierColor(multiplier: number): string {
  if (multiplier >= 6) return palette.redHot;
  if (multiplier >= 3.5) return palette.orange;
  if (multiplier >= 2) return palette.gold;
  return palette.cyanIce;
}

/**
 * The headline. Score is distance banked at the live multiplier, so this
 * number climbing fast is the game telling the player their risk is paying.
 */
const ScoreReadout: React.FC = () => {
  const score = useScore();
  const multiplier = useMultiplier();
  const chain = useChainRemaining();
  const hot = multiplier > 1.05;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!hot) return;
    pulse.setValue(1.16);
    Animated.spring(pulse, {
      toValue: 1,
      friction: 5,
      tension: 150,
      useNativeDriver: true,
    }).start();
  }, [multiplier, hot, pulse]);

  const color = multiplierColor(multiplier);

  return (
    <View style={styles.scoreBlock}>
      <AppText variant="displayL" color={palette.white} style={styles.scoreNumber}>
        {score.toLocaleString()}
      </AppText>

      {hot ? (
        <View style={styles.chainRow}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <AppText variant="title" color={color} style={styles.multiplier}>
              {`x${multiplier.toFixed(1)}`}
            </AppText>
          </Animated.View>
          <View style={styles.chainTrack}>
            <View
              style={[
                styles.chainFill,
                { backgroundColor: color, width: `${Math.round(chain * 100)}%` },
              ]}
            />
          </View>
        </View>
      ) : (
        <AppText variant="micro" color={alpha.white45} style={styles.scoreHint}>
          NEAR MISSES BUILD THE MULTIPLIER
        </AppText>
      )}
    </View>
  );
};

const CoinChipReadout: React.FC = () => <CoinChip size="sm" value={useRunCoins()} />;

const DistanceReadout: React.FC = () => (
  <TextPill>
    <AppText variant="bodyStrong">{`${formatKm(useDistance())} KM`}</AppText>
  </TextPill>
);

const GATE_RISK_COLOR: Record<GateKind, string> = {
  double: palette.gold,
  drift: '#C45CFF',
};

const GATE_RISK_COPY: Record<GateKind, { title: string; sub: string }> = {
  double: { title: '×2 SCORE', sub: 'NO CATCH' },
  drift: { title: '×3 DRIFT', sub: 'HEAVY STEERING' },
};

/**
 * The choice, spelled out. Two panels matching the arches on the road, and the
 * one the car is currently lined up with is lit — so the player can read their
 * own commitment without taking their eyes off the traffic.
 */
const GatePrompt: React.FC = () => {
  const approaching = useGateApproaching();
  const riskSide = useGateRiskSide();
  const kind = useGateKind();
  const playerSide = usePlayerSide();
  const boost = useGateBoost();
  const driftMode = useDriftMode();

  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, {
      toValue: approaching ? 1 : 0,
      friction: 7,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [approaching, enter]);

  if (boost > 0) {
    const color = driftMode ? GATE_RISK_COLOR.drift : palette.gold;
    return (
      <View pointerEvents="none" style={styles.gateActive}>
        <View style={[styles.gateActivePill, { borderColor: color }]}>
          <AppText variant="bodyStrong" color={color}>
            {driftMode ? `×3 DRIFT · ${boost}s` : `×2 SCORE · ${boost}s`}
          </AppText>
        </View>
      </View>
    );
  }

  if (!approaching) return null;

  const riskColor = GATE_RISK_COLOR[kind];
  const copy = GATE_RISK_COPY[kind];
  const riskLeft = riskSide < 0;
  const leftIsRisk = riskLeft;
  const leftActive = playerSide < 0;

  const panel = (isRisk: boolean, active: boolean) => {
    const color = isRisk ? riskColor : palette.greenSoft;
    return (
      <View
        style={[
          styles.gatePanel,
          { borderColor: color },
          active && styles.gatePanelActive,
          active && { backgroundColor: `${color}2A`, borderWidth: 3 },
        ]}
      >
        <AppText variant="title" align="center" color={color} style={styles.gatePanelTitle}>
          {isRisk ? copy.title : 'SAFE'}
        </AppText>
        <AppText variant="micro" align="center" color={active ? palette.white : alpha.white55}>
          {isRisk ? copy.sub : '+90 COINS'}
        </AppText>
      </View>
    );
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.gateBanner,
        { opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] },
      ]}
    >
      <AppText variant="micro" align="center" color={alpha.white62} style={styles.gateHint}>
        PICK A SIDE
      </AppText>
      <View style={styles.gateChoices}>
        {panel(leftIsRisk, leftActive)}
        {panel(!leftIsRisk, !leftActive)}
      </View>
    </Animated.View>
  );
};

/**
 * The slipstream meter. It only appears while the player is actually in a
 * wake, so it teaches the mechanic at the exact moment it is being used.
 */
const DraftMeter: React.FC = () => {
  const drafting = useDrafting();
  const charge = useDraftCharge();
  if (!drafting && charge <= 0) return null;

  return (
    <View pointerEvents="none" style={styles.draftWrap}>
      <AppText variant="micro" align="center" color={palette.cyanIce}>
        SLIPSTREAM
      </AppText>
      <View style={styles.draftTrack}>
        <View style={[styles.draftFill, { width: `${Math.round(charge * 100)}%` }]} />
      </View>
    </View>
  );
};

/**
 * The bust is the only death the player cannot see coming in the mirror, so it
 * gets the loudest warning in the game and a bar that says exactly how long is
 * left to do something about it.
 */
/**
 * Red and blue washing across opposite edges of the screen, alternating like a
 * light bar in the mirror.
 *
 * Driven by how close the nearest interceptor physically is, not by having
 * heat — merely being wanted left it on for most of a run, which made it
 * wallpaper. It now only lights up when one is actually on your bumper.
 */
const SirenWash: React.FC = () => {
  const proximity = usePoliceProximity();
  const phase = useRef(new Animated.Value(0)).current;
  const lit = proximity > 0;

  useEffect(() => {
    if (!lit) {
      phase.stopAnimation();
      phase.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(phase, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [lit, phase]);

  if (!lit) return null;

  const strength = 0.25 + proximity * 0.75;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.sirenEdge,
          styles.sirenLeft,
          { opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [strength, 0.05] }) },
        ]}
      >
        <LinearGradient
          colors={['rgba(255,38,79,0.85)', 'rgba(255,38,79,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sirenEdge,
          styles.sirenRight,
          { opacity: phase.interpolate({ inputRange: [0, 1], outputRange: [0.05, strength] }) },
        ]}
      >
        <LinearGradient
          colors={['rgba(36,168,255,0)', 'rgba(36,168,255,0.85)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

/** Edge flash only — the screen centre stays clear of chrome. */
const BustVignette: React.FC = () => {
  const threat = useBustThreat();
  const flash = useRef(new Animated.Value(0)).current;
  const visible = threat >= HEAT.bustWarnAt;

  useEffect(() => {
    if (!visible) {
      flash.stopAnimation();
      flash.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.25, duration: 260, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flash, visible]);

  if (!visible) return null;
  return <Animated.View pointerEvents="none" style={[styles.bustVignette, { opacity: flash }]} />;
};

/** The countdown itself sits in the HUD stack, under the wanted meter. */
const BustWarning: React.FC = () => {
  const threat = useBustThreat();
  if (threat < HEAT.bustWarnAt) return null;

  return (
    <View style={styles.bustBanner}>
      <AppText variant="bodyStrong" color={palette.redHot}>
        THEY&apos;RE PITTING YOU — BOOST!
      </AppText>
      <View style={styles.bustTrack}>
        <View style={[styles.bustFill, { width: `${Math.round(threat * 100)}%` }]} />
      </View>
    </View>
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
        SECOND FINGER CAN HIT NITRO
      </AppText>
    </Animated.View>
  );
};

/**
 * The button carries its own state through colour, size and the countdown
 * digit — a word above it was only ever narrating what the shape already said.
 */
const NitroButton: React.FC<{ onPress(): void }> = ({ onPress }) => {
  const ready = useNitroReady();
  const active = useNitroActive();
  const grace = useNitroGraceActive();
  const remaining = useNitroRemaining();
  const graceRemaining = useNitroGraceRemaining();
  const frenzy = useRunEvent() === 'nitroRush';

  return (
    <View style={styles.nitroWrap}>
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
          grace && styles.nitroGrace,
          !ready && !active && !grace && styles.nitroCooling,
          pressed && styles.nitroPressed,
        ]}
      >
        {active || grace ? (
          <AppText variant="title" color={palette.white}>
            {(active ? remaining : graceRemaining).toFixed(1)}
          </AppText>
        ) : (
          <BoltIcon size={36} />
        )}
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

const NitroVignette: React.FC = () => {
  const active = useNitroActive();
  const grace = useNitroGraceActive();
  if (!active && !grace) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.nitroVignette,
        { borderColor: active ? 'rgba(86,226,255,0.68)' : 'rgba(111,255,198,0.54)' },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 190 },
  intensityVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 7,
    borderColor: 'rgba(255,45,70,0.45)',
  },
  nitroVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 12,
  },
  hudTop: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 8,
  },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  scoreBlock: { minHeight: 62 },
  scoreNumber: { fontSize: 46, lineHeight: 48 },
  scoreHint: { letterSpacing: 0.8, marginTop: 1 },
  chainRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 },
  multiplier: { fontSize: 21, lineHeight: 23 },
  chainTrack: {
    width: 72,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: alpha.white14,
  },
  chainFill: { height: '100%', borderRadius: 2 },
  statChips: { flexDirection: 'row', gap: 6, marginTop: 4, flexShrink: 0 },
  bustVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 10,
    borderColor: 'rgba(255,38,79,0.85)',
  },
  sirenEdge: { position: 'absolute', top: 0, bottom: 0, width: '34%' },
  sirenLeft: { left: 0 },
  sirenRight: { right: 0 },
  bustBanner: { alignItems: 'flex-start', gap: 3 },
  bustTrack: {
    marginTop: 2,
    width: 190,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(5,16,34,0.7)',
  },
  bustFill: { height: '100%', borderRadius: 3, backgroundColor: palette.redHot },
  gateBanner: {
    position: 'absolute',
    bottom: 210,
    left: 14,
    right: 14,
    alignItems: 'center',
    gap: 6,
  },
  gateHint: { letterSpacing: 2.2 },
  gateChoices: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  gatePanel: {
    flex: 1,
    minHeight: 62,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
    borderWidth: 2,
    justifyContent: 'center',
    gap: 1,
    backgroundColor: 'rgba(5,16,34,0.74)',
  },
  gatePanelActive: {
    transform: [{ scale: 1.06 }],
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  gatePanelTitle: { fontSize: 22, lineHeight: 25 },
  gateActive: {
    position: 'absolute',
    bottom: 210,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  gateActivePill: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 2,
    backgroundColor: 'rgba(5,16,34,0.74)',
  },
  draftWrap: {
    position: 'absolute',
    bottom: 148,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 3,
  },
  draftTrack: {
    width: 104,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(5,16,34,0.7)',
  },
  draftFill: { height: '100%', borderRadius: 3, backgroundColor: palette.cyanIce },
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
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(31,165,224,0.94)',
    borderWidth: 2,
    borderColor: 'rgba(127,224,255,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nitroFrenzy: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: palette.cyanMid,
    borderColor: palette.cyanIce,
  },
  nitroActive: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: palette.cyanDeep,
    borderColor: palette.white,
    transform: [{ scale: 1.08 }],
  },
  nitroGrace: {
    backgroundColor: palette.greenDeep,
    borderColor: palette.greenSoft,
  },
  nitroCooling: { opacity: 0.3 },
  nitroPressed: { transform: [{ scale: 0.92 }] },
});
