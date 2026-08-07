import React from 'react';
import { StyleSheet, Text, TextProps } from 'react-native';

import { palette, textVariants, TextVariant } from '@/ui/theme';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  /** Chunky offset text shadow used on anything sitting over the 3D scene. */
  emboss?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Single entry point for typography. Screens never touch `fontFamily`
 * directly, which keeps the two-font rule enforceable in one place.
 */
export const AppText: React.FC<AppTextProps> = ({
  variant = 'body',
  color = palette.white,
  emboss,
  align,
  style,
  ...rest
}) => (
  <Text
    {...rest}
    allowFontScaling={false}
    style={[
      textVariants[variant],
      { color },
      align ? { textAlign: align } : null,
      emboss ? { textShadowColor: emboss, textShadowOffset: EMBOSS_OFFSET, textShadowRadius: 1 } : null,
      style,
    ]}
  />
);

const EMBOSS_OFFSET = { width: 0, height: 3 };

export const textStyles = StyleSheet.create({
  uppercaseWide: { letterSpacing: 2 },
});
