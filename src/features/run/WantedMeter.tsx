import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HEAT } from '@/engine/config';
import { useWantedStars } from '@/game/telemetryStore';
import { AppText, StarIcon } from '@/ui/components';
import { alpha, palette } from '@/ui/theme';

const STAR_SLOTS = Array.from({ length: HEAT.maxStars }, (_, i) => i);

function heatLabel(stars: number): string {
  if (stars >= 5) return 'MAX HEAT';
  if (stars >= 4) return 'ROADBLOCKS';
  if (stars >= 3) return 'COPS ON YOU';
  if (stars >= 2) return 'SIRENS';
  if (stars >= 1) return 'HEATING UP';
  return 'CRUISING';
}

export const WantedMeter: React.FC = () => {
  const stars = useWantedStars();

  return (
    <View style={styles.container}>
      <AppText variant="micro" color={alpha.white85}>
        WANTED
      </AppText>
      <View style={styles.stars}>
        {STAR_SLOTS.map((index) => (
          <StarIcon key={index} size={22} filled={index < stars} />
        ))}
      </View>
      <AppText variant="label" color={stars >= 3 ? palette.redSoft : 'rgba(255,255,255,0.8)'}>
        {heatLabel(stars)}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'flex-end', gap: 7 },
  stars: { flexDirection: 'row', gap: 5 },
});
