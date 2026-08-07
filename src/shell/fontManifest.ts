import { Baloo2_600SemiBold } from '@expo-google-fonts/baloo-2/600SemiBold';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2/700Bold';
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2/800ExtraBold';
import { LuckiestGuy_400Regular } from '@expo-google-fonts/luckiest-guy/400Regular';

/**
 * Keys here become the `fontFamily` strings used across the app, so they must
 * stay in sync with `src/ui/theme/typography.ts`.
 *
 * Weights are imported from their individual subpaths on purpose: pulling from
 * the package root would bundle every weight Google ships (~2 MB of TTF) when
 * the game only ever renders four.
 */
export const FONT_MANIFEST = {
  LuckiestGuy: LuckiestGuy_400Regular,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} as const;
