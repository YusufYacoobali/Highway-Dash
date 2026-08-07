import { TextStyle } from 'react-native';

/**
 * The mockup uses exactly two families: `Luckiest Guy` for anything shouty,
 * `Baloo 2` for readable UI copy. Font keys must match the names registered
 * in {@link src/app/fontManifest.ts}.
 */
export const fontFamily = {
  display: 'LuckiestGuy',
  bodyBold: 'Baloo2_700Bold',
  bodySemi: 'Baloo2_600SemiBold',
  bodyBlack: 'Baloo2_800ExtraBold',
} as const;

type Variant =
  | 'displayXL'
  | 'displayL'
  | 'displayM'
  | 'displayS'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'micro';

export const textVariants: Record<Variant, TextStyle> = {
  displayXL: { fontFamily: fontFamily.display, fontSize: 66, lineHeight: 62 },
  displayL: { fontFamily: fontFamily.display, fontSize: 44, lineHeight: 50 },
  displayM: { fontFamily: fontFamily.display, fontSize: 32, lineHeight: 38 },
  displayS: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 28 },
  title: { fontFamily: fontFamily.bodyBlack, fontSize: 19, lineHeight: 24 },
  bodyStrong: { fontFamily: fontFamily.bodyBlack, fontSize: 15.5, lineHeight: 20 },
  body: { fontFamily: fontFamily.bodySemi, fontSize: 13.5, lineHeight: 19 },
  label: { fontFamily: fontFamily.bodyBlack, fontSize: 12.5, lineHeight: 16, letterSpacing: 0.8 },
  caption: { fontFamily: fontFamily.bodyBlack, fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
  micro: { fontFamily: fontFamily.bodyBlack, fontSize: 9.5, lineHeight: 12, letterSpacing: 1.2 },
};

export type TextVariant = Variant;
