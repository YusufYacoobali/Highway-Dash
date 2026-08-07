import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import { palette } from '@/ui/theme';

interface IconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

const STAR_PATH =
  'M50 0 L63 36 L100 38 L70 61 L80 100 L50 76 L20 100 L30 61 L0 38 L37 36 Z';

export const StarIcon: React.FC<IconProps & { filled?: boolean }> = ({
  size = 22,
  filled = false,
  style,
}) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Path d={STAR_PATH} fill={filled ? palette.redHot : 'rgba(11,26,51,0.55)'} />
  </Svg>
);

export const GemIcon: React.FC<IconProps> = ({ size = 20, style }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Defs>
      <SvgLinearGradient id="gem" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={palette.goldLight} />
        <Stop offset="1" stopColor="#F5A800" />
      </SvgLinearGradient>
    </Defs>
    <Path d={STAR_PATH} fill="url(#gem)" />
  </Svg>
);

export const CoinIcon: React.FC<IconProps> = ({ size = 24, style }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Defs>
      <RadialGradient id="coin" cx="35%" cy="30%" r="75%">
        <Stop offset="0" stopColor={palette.coinCore} />
        <Stop offset="1" stopColor={palette.coinEdge} />
      </RadialGradient>
    </Defs>
    <Circle cx="50" cy="50" r="44" fill="url(#coin)" stroke={palette.coinRim} strokeWidth="11" />
  </Svg>
);

export const BoltIcon: React.FC<IconProps> = ({ size = 34, color = palette.white, style }) => (
  <Svg width={size * 0.6} height={size} viewBox="0 0 60 100" style={style}>
    <Path d="M35 0 L6 56 L26 56 L20 100 L54 40 L31 40 Z" fill={color} />
  </Svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 22, color = palette.white, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <Path
      d="M15 4 L7 12 L15 20"
      stroke={color}
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, color = palette.white, style }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <Path
      d="M5 13 L10 18 L19 6"
      stroke={color}
      strokeWidth="3.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

/** Two vertical bars — the run screen pause affordance. */
export const PauseIcon: React.FC<IconProps> = ({ size = 16, color = palette.white, style }) => (
  <View
    style={[
      { flexDirection: 'row', gap: size * 0.28, alignItems: 'center', justifyContent: 'center' },
      style,
    ]}
  >
    <View style={{ width: size * 0.3, height: size, borderRadius: 2, backgroundColor: color }} />
    <View style={{ width: size * 0.3, height: size, borderRadius: 2, backgroundColor: color }} />
  </View>
);

export const GarageIcon: React.FC<IconProps> = ({ size = 24, color = palette.white, style }) => (
  <Svg width={size} height={size * 0.84} viewBox="0 0 24 20" style={style}>
    <Path
      d="M3 19 V8 A4 4 0 0 1 7 4 H17 A4 4 0 0 1 21 8 V19"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
);
