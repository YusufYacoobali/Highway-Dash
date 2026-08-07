import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { ChevronLeftIcon } from './Icons';
import { palette, radii, spacing } from '@/ui/theme';

export const skyGradient = [palette.sky600, palette.sky400, palette.sky200] as const;
export const shopGradient = [palette.sky600, palette.sky300] as const;
export const seasonGradient = [palette.sky700, palette.sky500, '#FFC46B'] as const;

interface MetaScreenProps {
  colors?: readonly [string, string, ...string[]];
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Full-bleed gradient surface shared by every non-gameplay screen. Owning the
 * safe-area padding here means individual screens only lay out content.
 */
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
      hitSlop={8}
    >
      <ChevronLeftIcon size={22} />
    </Pressable>
    <View style={styles.headerTitles}>
      {subtitle ? (
        <AppText variant="caption" color="#FFF3C9">
          {subtitle}
        </AppText>
      ) : null}
      <AppText variant="displayS" color={titleColor} emboss={palette.navy300} style={styles.title}>
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
    gap: spacing.sm,
    paddingHorizontal: 14,
    paddingBottom: spacing.md,
  },
  headerTitles: { flex: 1 },
  title: { fontSize: 27, lineHeight: 32 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: palette.navy500,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
});
