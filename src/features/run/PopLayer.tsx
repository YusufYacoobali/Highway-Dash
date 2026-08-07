import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/components';
import { usePopStore, type Pop } from './popStore';

const POP_DURATION = 950;

/** Renders the transient near-miss praise. Purely decorative, never interactive. */
export const PopLayer: React.FC = () => {
  const pops = usePopStore((state) => state.pops);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pops.map((pop) => (
        <PopText key={pop.id} pop={pop} />
      ))}
    </View>
  );
};

const PopText: React.FC<{ pop: Pop }> = ({ pop }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const remove = usePopStore((state) => state.remove);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: POP_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => remove(pop.id));
  }, [pop.id, progress, remove]);

  return (
    <Animated.View
      style={[
        styles.pop,
        {
          left: `${pop.x}%`,
          top: pop.y,
          opacity: progress.interpolate({
            inputRange: [0, 0.2, 0.72, 1],
            outputRange: [0, 1, 1, 0],
          }),
          transform: [
            { translateX: -60 },
            {
              translateY: progress.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0, -12, -72],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0.5, 1.15, 0.95],
              }),
            },
          ],
        },
      ]}
    >
      <AppText
        variant="displayM"
        align="center"
        color={pop.color}
        emboss="rgba(8,22,45,0.75)"
        style={{ fontSize: pop.size, lineHeight: pop.size * 1.15, width: 120 }}
      >
        {pop.text}
      </AppText>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  pop: { position: 'absolute' },
});
