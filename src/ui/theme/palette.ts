/**
 * Colour tokens lifted verbatim from the Highway Dash design mockup.
 * Nothing outside this file should hard-code a hex value.
 */
export const palette = {
  /** Deep navy chrome used behind every meta screen. */
  navy900: '#08152B',
  navy800: '#0B1A33',
  navy700: '#0E1A2B',
  navy600: '#14213D',
  navy500: '#16294A',
  navy400: '#1B3A6B',
  navy300: '#175FA8',
  navy200: '#123566',

  /** Sky gradients for the garage / shop / season surfaces. */
  sky700: '#1F7FE0',
  sky600: '#2E9BF0',
  sky500: '#5FB8F5',
  sky400: '#7FCBF7',
  sky300: '#9FDCFF',
  sky200: '#CFEBFF',

  /** Text ramp. */
  ink: '#14213D',
  inkMuted: 'rgba(20,33,61,0.6)',
  inkFaint: 'rgba(20,33,61,0.5)',
  white: '#FFFFFF',
  frost: '#EEF3FA',
  frostAlt: '#E7EEF7',
  steel: '#5B7392',
  slate: '#8FA3BE',
  bluegrey: '#7FA6DB',
  bluegreyDim: '#5C7CAE',

  /** Accents. */
  gold: '#FFC42E',
  goldLight: '#FFE07A',
  goldDeep: '#F59A00',
  goldShadow: '#B4550A',
  coinCore: '#FFE9A0',
  coinEdge: '#F2A800',
  coinRim: '#B87800',

  green: '#46C82B',
  greenLight: '#6BE04A',
  greenDeep: '#33A81C',
  greenBorder: '#1E7A0F',
  greenShadow: '#17610B',
  greenSoft: '#8DE87A',

  red: '#E8332E',
  redSoft: '#FF6B5E',
  redHot: '#FF4D3D',
  redDeep: '#C22824',

  cyan: '#24C6DC',
  cyanDeep: '#12A2B8',
  cyanIce: '#7FE0FF',
  cyanLight: '#8FE7FF',
  cyanMid: '#1FA5E0',
  cyanBorder: '#0B6E9E',
  cyanShadow: '#075681',

  purple: '#9B5DE5',
  purpleDeep: '#7B3FC7',
  orange: '#F08A24',
} as const;

/** Rarity tiers map to a single accent colour across garage, crates and drops. */
export const rarityColor = {
  COMMON: palette.steel,
  RARE: palette.cyanDeep,
  EPIC: palette.purpleDeep,
  LEGEND: palette.goldDeep,
  MYTHIC: palette.red,
} as const;

/** Translucent fills used repeatedly for glassy overlay controls. */
export const alpha = {
  white05: 'rgba(255,255,255,0.05)',
  white08: 'rgba(255,255,255,0.08)',
  white14: 'rgba(255,255,255,0.14)',
  white24: 'rgba(255,255,255,0.24)',
  white28: 'rgba(255,255,255,0.28)',
  white40: 'rgba(255,255,255,0.4)',
  white45: 'rgba(255,255,255,0.45)',
  white55: 'rgba(255,255,255,0.55)',
  white62: 'rgba(255,255,255,0.62)',
  white75: 'rgba(255,255,255,0.75)',
  white85: 'rgba(255,255,255,0.85)',
  white90: 'rgba(255,255,255,0.9)',
  navyGlass: 'rgba(11,26,51,0.55)',
  navyGlassStrong: 'rgba(11,26,51,0.78)',
  navyShadow: 'rgba(6,18,38,0.55)',
  inkShadow: 'rgba(8,22,45,0.35)',
  inkShadowSoft: 'rgba(8,22,45,0.18)',
  inkTint07: 'rgba(20,33,61,0.07)',
  inkTint12: 'rgba(20,33,61,0.12)',
  inkTint14: 'rgba(20,33,61,0.14)',
} as const;

export type PaletteColor = (typeof palette)[keyof typeof palette];
