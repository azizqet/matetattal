import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/ThemeProvider';
import { Lockup } from './Brand';

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const ALine = Animated.createAnimatedComponent(Line);
const CROWN = 'M50 8 L77 18 L90 44 L82 66 L68 80 L68 92 L32 92 L32 80 L18 66 L10 44 L23 18 Z';
const FIL = 'M40 80 V60 L46 50 L50 58 L54 50 L60 60 V80';
const CROWN_LEN = 330;
const FIL_LEN = 100;

/**
 * Opening sequence (≈1.6 s): the bulb outline is drawn, the filament
 * lights up with the logo accent, a soft halo blooms, then the lockup
 * appears and the overlay fades into the app.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const draw = useSharedValue(0);
  const light = useSharedValue(0);
  const word = useSharedValue(0);
  const out = useSharedValue(1);

  useEffect(() => {
    draw.set(withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    light.set(withDelay(560, withSequence(withTiming(1, { duration: 260 }), withTiming(0.82, { duration: 160 }), withTiming(1, { duration: 140 }))));
    word.set(withDelay(900, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) })));
    out.set(withDelay(1450, withTiming(0, { duration: 300 }, (fin) => { if (fin) runOnJS(onDone)(); })));
  }, [draw, light, word, out, onDone]);

  const crownProps = useAnimatedProps(() => ({ strokeDashoffset: CROWN_LEN * (1 - draw.value) }));
  const filProps = useAnimatedProps(() => ({ strokeDashoffset: FIL_LEN * (1 - Math.min(1, draw.value * 1.2)), strokeOpacity: 0.35 + light.value * 0.65 }));
  const haloProps = useAnimatedProps(() => ({ opacity: light.value }));
  const baseProps = useAnimatedProps(() => ({ strokeOpacity: draw.value }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 12 }] }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: out.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', zIndex: 1000 }, rootStyle]} pointerEvents="none">
      <Svg width={132} height={158} viewBox="0 0 100 120">
        <Defs>
          <RadialGradient id="sg" cx="50" cy="46" r="48" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={c.accent} stopOpacity={0.6} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <ACircle cx="50" cy="46" r="48" fill="url(#sg)" animatedProps={haloProps} />
        <APath d={CROWN} fill="none" stroke={c.primary} strokeWidth={5} strokeLinejoin="round" strokeDasharray={CROWN_LEN} animatedProps={crownProps} />
        <APath d={FIL} fill="none" stroke={c.accent} strokeWidth={4.2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={FIL_LEN} animatedProps={filProps} />
        <ALine x1="36" y1="102" x2="64" y2="102" stroke={c.primary} strokeWidth={5} strokeLinecap="round" animatedProps={baseProps} />
        <ALine x1="42" y1="112" x2="58" y2="112" stroke={c.primary} strokeWidth={5} strokeLinecap="round" animatedProps={baseProps} />
      </Svg>
      <Animated.View style={[{ marginTop: 24 }, wordStyle]}>
        <Lockup height={38} showLatin />
      </Animated.View>
      <View style={{ height: 40 }} />
    </Animated.View>
  );
}
