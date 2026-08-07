import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { alpha, palette, radii, softShadow } from '@/ui/theme';

export type ButtonTone = 'green' | 'gold' | 'cyan' | 'navy' | 'ghost' | 'muted';

interface ToneSpec {
  fill: string;
  border: string;
}

const TONES: Record<ButtonTone, ToneSpec> = {
  green: { fill: '#4ED631', border: 'rgba(255,255,255,0.16)' },
  gold: { fill: palette.gold, border: 'rgba(255,255,255,0.22)' },
  cyan: { fill: palette.cyanMid, border: 'rgba(255,255,255,0.18)' },
  navy: { fill: 'rgba(17,35,63,0.94)', border: alpha.white14 },
  ghost: { fill: alpha.white08, border: alpha.white14 },
  muted: { fill: 'rgba(255,255,255,0.08)', border: alpha.white08 },
};

export interface ChunkyButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  tone?: ButtonTone;
  disabled?: boolean;
  height?: number;
  radius?: number;
  /** Kept for call-site compatibility; modern buttons use only a tiny visual lift. */
  depth?: number;
  /** Adds a static soft highlight, not a sweeping plastic sheen. */
  shine?: boolean;
  /** Optional restrained breathing animation for the menu PLAY CTA. */
  pulse?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  accessibilityLabel?: string;
}

/** A restrained, game-native CTA: one solid surface, soft depth and fast press feedback. */
export const ChunkyButton: React.FC<ChunkyButtonProps> = ({
  onPress,
  children,
  tone = 'green',
  disabled = false,
  height = 64,
  radius = radii.lg,
  depth = 0,
  shine = false,
  pulse = false,
  style,
  contentStyle,
  accessibilityLabel,
}) => {
  const spec = TONES[disabled ? 'muted' : tone];
  const press = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulse || disabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, disabled, pulse]);

  const handlePressIn = useCallback(() => {
    Animated.timing(press, { toValue: 1, duration: 65, useNativeDriver: true }).start();
  }, [press]);

  const handlePressOut = useCallback(() => {
    Animated.timing(press, { toValue: 0, duration: 120, useNativeDriver: true }).start();
  }, [press]);

  const transform = useMemo(
    () => [
      { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] }) },
      { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, Math.min(2, depth)] }) },
      { scaleY: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) },
    ],
    [breathe, depth, press],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[{ height }, style]}
    >
      <Animated.View
        style={[
          styles.face,
          {
            height,
            borderRadius: radius,
            borderColor: spec.border,
            backgroundColor: spec.fill,
            transform,
            opacity: disabled ? 0.52 : 1,
          },
          tone !== 'ghost' && tone !== 'muted' ? softShadow(4) : null,
          contentStyle,
        ]}
      >
        {shine && !disabled ? <View pointerEvents="none" style={styles.highlight} /> : null}
        {children}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  face: {
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlight: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
});
