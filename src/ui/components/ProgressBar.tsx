import React from 'react';
import { View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { palette, radii } from '@/ui/theme';

export interface ProgressBarProps {
  /** 0 – 1. Values outside the range are clamped. */
  progress: number;
  height?: number;
  trackColor?: string;
  colors?: readonly [string, string];
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 12,
  trackColor = 'rgba(255,255,255,0.16)',
  colors = [palette.goldLight, palette.goldDeep] as const,
  style,
}) => {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={[
        { height, borderRadius: radii.pill, backgroundColor: trackColor, overflow: 'hidden' },
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${pct * 100}%`, height: '100%', borderRadius: radii.pill }}
      />
    </View>
  );
};
