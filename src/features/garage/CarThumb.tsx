import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import type { CarDefinition } from '@/domain/cars';

interface CarThumbProps {
  car: CarDefinition;
  width?: number;
  /** Locked cars render desaturated in the collection grid. */
  locked?: boolean;
  style?: ViewStyle;
}

/**
 * Top-down car illustration, composed from plain views so it inherits each
 * car's livery for free and costs nothing to render in a scrolling grid.
 */
export const CarThumb: React.FC<CarThumbProps> = ({ car, width = 60, locked = false, style }) => {
  const height = width * 1.23;

  return (
    <View style={[{ width, height, opacity: locked ? 0.55 : 1 }, style]}>
      <View
        style={[
          styles.body,
          {
            borderRadius: width * 0.23,
            borderBottomLeftRadius: width * 0.17,
            borderBottomRightRadius: width * 0.17,
            backgroundColor: car.bodyColor,
          },
        ]}
      >
        <View
          style={[
            styles.roof,
            { backgroundColor: car.roofColor, borderRadius: width * 0.15, top: '10%' },
          ]}
        />
        <View style={styles.windshield} />
        <View style={[styles.mirror, { left: -width * 0.07 }]} />
        <View style={[styles.mirror, { right: -width * 0.07 }]} />
        <View style={[styles.tailLight, { left: '12%' }]} />
        <View style={[styles.tailLight, { right: '12%' }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  body: { flex: 1, overflow: 'visible' },
  roof: { position: 'absolute', left: '16%', right: '16%', height: '28%' },
  windshield: {
    position: 'absolute',
    left: '22%',
    right: '22%',
    top: '16%',
    height: '15%',
    backgroundColor: '#2C3E55',
    borderRadius: 5,
  },
  mirror: {
    position: 'absolute',
    top: '44%',
    width: '14%',
    height: '20%',
    backgroundColor: '#1B2330',
    borderRadius: 4,
  },
  tailLight: {
    position: 'absolute',
    bottom: '8%',
    width: '22%',
    height: '9%',
    backgroundColor: '#E8443A',
    borderRadius: 3,
  },
});
