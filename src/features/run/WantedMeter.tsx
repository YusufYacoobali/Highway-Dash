import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HEAT } from '@/engine/config';
import { useWantedStars } from '@/game/telemetryStore';
import { StarIcon } from '@/ui/components';

const STAR_SLOTS = Array.from({ length: HEAT.maxStars }, (_, i) => i);

/**
 * Just the stars. The written heat tier said nothing the filled count did not
 * already say, and the run HUD has no room for text that only describes state.
 */
export const WantedMeter: React.FC = () => {
  const stars = useWantedStars();

  return (
    <View style={styles.stars}>
      {STAR_SLOTS.map((index) => (
        <StarIcon key={index} size={22} filled={index < stars} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  stars: { flexDirection: 'row', gap: 5 },
});
