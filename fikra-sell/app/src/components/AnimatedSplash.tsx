import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { Lockup } from './Brand';

/** Short, calm opening (≈1 s): the lockup fades/rises in on white, then the overlay fades into the app. */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const word = useSharedValue(0);
  const out = useSharedValue(1);

  useEffect(() => {
    word.set(withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    out.set(withDelay(800, withTiming(0, { duration: 260 }, (fin) => { if (fin) runOnJS(onDone)(); })));
  }, [word, out, onDone]);

  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 10 }] }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: out.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', zIndex: 1000 }, rootStyle]} pointerEvents="none">
      <Animated.View style={wordStyle}>
        <Lockup height={42} showLatin />
      </Animated.View>
    </Animated.View>
  );
}
