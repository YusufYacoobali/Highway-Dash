import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { alpha, palette, radii } from '@/ui/theme';

export type ButtonTone = 'green' | 'gold' | 'cyan' | 'navy' | 'ghost' | 'muted';

interface ToneSpec {
  top: string;
  bottom: string;
  border: string;
  shadow: string;
}

const TONES: Record<ButtonTone, ToneSpec> = {
  green: {
    top: palette.greenLight,
    bottom: palette.greenDeep,
    border: palette.greenBorder,
    shadow: palette.greenShadow,
  },
  gold: {
    top: palette.gold,
    bottom: palette.gold,
    border: palette.goldShadow,
    shadow: palette.goldShadow,
  },
  cyan: {
    top: palette.cyanLight,
    bottom: palette.cyanMid,
    border: palette.cyanBorder,
    shadow: palette.cyanShadow,
  },
  navy: {
    top: palette.navy500,
    bottom: palette.navy500,
    border: 'rgba(255,255,255,0.22)',
    shadow: 'rgba(6,18,38,0.55)',
  },
  ghost: {
    top: alpha.white14,
    bottom: alpha.white14,
    border: alpha.white45,
    shadow: 'transparent',
  },
  muted: {
    top: palette.frostAlt,
    bottom: palette.frostAlt,
    border: 'transparent',
    shadow: 'transparent',
  },
};

export interface ChunkyButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  tone?: ButtonTone;
  disabled?: boolean;
  /** Height of the visible face; the shadow adds `depth` on top of it. */
  height?: number;
  radius?: number;
  depth?: number;
  /** Sweeping highlight — reserved for the single primary CTA on a screen. */
  shine?: boolean;
  /** Slow breathing scale — reserved for the menu PLAY button. */
  pulse?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * The one button in the game. Every call to action is this component with a
 * different tone, which is what keeps the hyper-casual "moulded plastic" look
 * consistent across eight screens.
 */
export const ChunkyButton: React.FC<ChunkyButtonProps> = ({
  onPress,
  children,
  tone = 'green',
  disabled = false,
  height = 64,
  radius = radii.xl,
  depth = 7,
  shine = false,
  pulse = false,
  style,
  contentStyle,
  accessibilityLabel,
}) => {
  const spec = TONES[disabled ? 'muted' : tone];
  const press = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulse || disabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, disabled, pulse]);

  useEffect(() => {
    if (!shine || disabled) return;
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, shine, sweep]);

  const handlePressIn = useCallback(() => {
    Animated.timing(press, { toValue: 1, duration: 70, useNativeDriver: true }).start();
  }, [press]);

  const handlePressOut = useCallback(() => {
    Animated.timing(press, { toValue: 0, duration: 110, useNativeDriver: true }).start();
  }, [press]);

  const faceTransform = useMemo(
    () => [
      { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, depth] }) },
      { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) },
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
      style={[{ height: height + depth }, style]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: spec.shadow, borderRadius: radius, top: depth },
        ]}
      />
      <Animated.View
        style={[
          {
            height,
            borderRadius: radius,
            borderWidth: spec.border === 'transparent' ? 0 : 3.5,
            borderColor: spec.border,
            backgroundColor: spec.bottom,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            transform: faceTransform,
          },
          contentStyle,
        ]}
      >
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: spec.top, opacity: 0.55, bottom: '45%' },
          ]}
        />
        {shine && !disabled ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -height,
              bottom: -height,
              width: 54,
              backgroundColor: 'rgba(255,255,255,0.38)',
              transform: [
                { rotate: '18deg' },
                {
                  translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-160, 420] }),
                },
              ],
            }}
          />
        ) : null}
        {children}
      </Animated.View>
    </Pressable>
  );
};
