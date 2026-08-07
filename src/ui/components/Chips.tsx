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
  sm: { icon: 19, padV: 4, padR: 12, text: 14.5 as const, border: 2.5 },
  md: { icon: 26, padV: 6, padR: 18, text: 19 as const, border: 3 },
};

const CurrencyChip: React.FC<ChipProps & { children: React.ReactNode }> = ({
  value,
  size = 'md',
  style,
  children,
}) => {
  const s = chipSizing[size];
  return (
    <View
      style={[
        styles.chip,
        { paddingVertical: s.padV, paddingRight: s.padR, borderWidth: s.border },
        style,
      ]}
    >
      {children}
      <AppText variant="title" style={{ fontSize: s.text }}>
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

/** Plain pill with no icon — used for the distance readout in the run HUD. */
export const TextPill: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => <View style={[styles.chip, styles.textPill, style]}>{children}</View>;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.navy500,
    borderColor: alpha.white24,
    borderRadius: radii.pill,
    paddingLeft: 5,
  },
  textPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 2.5,
  },
});
