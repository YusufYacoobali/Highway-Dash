import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { CoinIcon, GemIcon } from './Icons';
import { alpha, palette, radii } from '@/ui/theme';

interface ChipProps {
  value: string | number;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const chipSizing = {
  sm: { icon: 18, padV: 4, padR: 10, text: 13.5 as const },
  md: { icon: 23, padV: 6, padR: 14, text: 16.5 as const },
};

const CurrencyChip: React.FC<ChipProps & { children: React.ReactNode }> = ({
  value,
  size = 'md',
  style,
  children,
}) => {
  const s = chipSizing[size];
  return (
    <View style={[styles.chip, { paddingVertical: s.padV, paddingRight: s.padR }, style]}>
      {children}
      <AppText variant="bodyStrong" style={{ fontSize: s.text }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </AppText>
    </View>
  );
};

export const CoinChip: React.FC<ChipProps> = (props) => (
  <CurrencyChip {...props}>
    <CoinIcon size={chipSizing[props.size ?? 'md'].icon} />
  </CurrencyChip>
);

export const GemChip: React.FC<ChipProps> = (props) => (
  <CurrencyChip {...props}>
    <GemIcon size={chipSizing[props.size ?? 'md'].icon} />
  </CurrencyChip>
);

export const TextPill: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <View style={[styles.chip, styles.textPill, style]}>{children}</View>;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(8,21,43,0.72)',
    borderWidth: 1,
    borderColor: alpha.white14,
    borderRadius: radii.pill,
    paddingLeft: 5,
  },
  textPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
