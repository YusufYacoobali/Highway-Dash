import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { ChevronLeftIcon } from './Icons';
import { alpha, palette, radii, spacing } from '@/ui/theme';

export const skyGradient = [palette.navy800, '#10284B', '#17466F'] as const;
export const shopGradient = [palette.navy800, '#12365A', '#1C5882'] as const;
export const seasonGradient = [palette.navy900, '#1A315C', '#5D3E73'] as const;

interface MetaScreenProps {
  colors?: readonly [string, string, ...string[]];
  children: React.ReactNode;
  style?: ViewStyle;
}

/** Dark, quiet shell that lets content and rewards carry the colour. */
export const MetaScreen: React.FC<MetaScreenProps> = ({
  colors = skyGradient,
  children,
  style,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={colors}
      style={[StyleSheet.absoluteFill, { paddingTop: insets.top + spacing.sm }, style]}
    >
      {children}
    </LinearGradient>
  );
};

interface HeaderProps {
  title: string;
  onBack: () => void;
  subtitle?: string;
  right?: React.ReactNode;
  titleColor?: string;
}

export const ScreenHeader: React.FC<HeaderProps> = ({
  title,
  onBack,
  subtitle,
  right,
  titleColor = palette.white,
}) => (
  <View style={styles.header}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onBack}
      style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
      hitSlop={10}
    >
      <ChevronLeftIcon size={21} />
    </Pressable>
    <View style={styles.headerTitles}>
      {subtitle ? (
        <AppText variant="caption" color={alpha.white62}>
          {subtitle}
        </AppText>
      ) : null}
      <AppText variant="title" color={titleColor} style={styles.title}>
        {title}
      </AppText>
    </View>
    {right}
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: 16,
    paddingBottom: 16,
    minHeight: 58,
  },
  headerTitles: { flex: 1 },
  title: { fontSize: 22, lineHeight: 27, letterSpacing: 0.2 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: alpha.white08,
    borderWidth: 1,
    borderColor: alpha.white14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { opacity: 0.62, transform: [{ scale: 0.95 }] },
});
