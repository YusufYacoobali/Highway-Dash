import { Platform, ViewStyle } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 19,
  xl: 24,
  pill: 999,
} as const;

/**
 * Hyper-casual UI reads as "chunky plastic": a hard offset shadow with no blur.
 * React Native cannot express that with `shadowRadius: 0` on Android, so the
 * effect is composed from a solid underlay view instead — see `ChunkyButton`.
 */
export function hardShadow(color: string, offset: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offset },
      shadowOpacity: 1,
      shadowRadius: 0,
    },
    default: {
      borderBottomWidth: offset,
      borderBottomColor: color,
    },
  }) as ViewStyle;
}

/** Soft ambient drop shadow for cards floating on the sky gradients. */
export function softShadow(elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#06142A',
      shadowOffset: { width: 0, height: elevation * 0.6 },
      shadowOpacity: 0.25,
      shadowRadius: elevation,
    },
    default: { elevation },
  }) as ViewStyle;
}
