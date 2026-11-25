import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { logoAspect, logoSource } from '../theme/logo.generated';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';

/**
 * Bulb mark — the geometric bulb motif of the FIKRA DESIGN SYSTEM, used by
 * the Add button, splash, loaders and empty states. When `lit`, the
 * filament glows with the logo accent colour.
 */
export function BulbMark({ size = 48, lit = true, color, glow, stroke = 6 }: { size?: number; lit?: boolean; color?: string; glow?: string; stroke?: number }) {
  const { c } = useTheme();
  const line = color ?? c.primary;
  const light = glow ?? c.accent;
  return (
    <Svg width={size} height={size * 1.2} viewBox="0 0 100 120">
      <Defs>
        <RadialGradient id="halo" cx="50" cy="46" r="46" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={light} stopOpacity={lit ? 0.55 : 0} />
          <Stop offset="1" stopColor={light} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {lit && <Circle cx="50" cy="46" r="46" fill="url(#halo)" />}
      {/* faceted crown */}
      <Path d="M50 8 L77 18 L90 44 L82 66 L68 80 L68 92 L32 92 L32 80 L18 66 L10 44 L23 18 Z" fill="none" stroke={line} strokeWidth={stroke} strokeLinejoin="round" />
      {/* filament */}
      <Path d="M40 80 V60 L46 50 L50 58 L54 50 L60 60 V80" fill="none" stroke={lit ? light : line} strokeWidth={stroke * 0.8} strokeLinejoin="round" strokeLinecap="round" />
      {/* base */}
      <Line x1="36" y1="102" x2="64" y2="102" stroke={line} strokeWidth={stroke} strokeLinecap="round" />
      <Line x1="42" y1="112" x2="58" y2="112" stroke={line} strokeWidth={stroke} strokeLinecap="round" />
    </Svg>
  );
}

/** Filament line: 1.5px rule with a geometric notch (the logo's line work). */
export function Filament({ width = '100%', color, notch = true, style }: { width?: number | `${number}%`; color?: string; notch?: boolean; style?: ViewStyle }) {
  const { c } = useTheme();
  const col = color ?? c.line;
  return (
    <View style={[{ width, height: 8, justifyContent: 'center' }, style]}>
      <View style={{ height: 1.5, backgroundColor: col, borderRadius: 1 }} />
      {notch && <View style={{ position: 'absolute', start: 18, width: 7, height: 7, borderTopWidth: 1.5, borderStartWidth: 1.5, borderColor: col, transform: [{ rotate: '45deg' }], backgroundColor: c.bg, top: 3 }} />}
    </View>
  );
}

/** The original «فكرة» logo (exact file), or the interim mark until it is added. */
export function FikraLogo({ height = 36 }: { height?: number }) {
  const { c } = useTheme();
  if (logoSource) {
    return <Image source={logoSource} style={{ height, width: height * logoAspect }} contentFit="contain" accessibilityLabel="فكرة" />;
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityLabel="فكرة">
      <BulbMark size={height * 0.62} />
      <Text style={{ fontFamily: font.bold, fontSize: height * 0.72, color: c.primary, lineHeight: height * 1.15 }}>فكرة</Text>
    </View>
  );
}

/**
 * «سيـ فكرة ـل» lockup: the kashida strokes of «سيـ» and «ـل» extend into
 * filament lines that lead into the «فكرة» logo — سيل literally wraps the idea.
 * Always laid out right-to-left, whatever the UI language.
 */
export function Lockup({ height = 34, showLatin = false }: { height?: number; showLatin?: boolean }) {
  const { c } = useTheme();
  const fs = height * 0.78;
  const lineW = height * 0.38;
  const ink = c.scheme === 'dark' ? c.text : c.ink;
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityLabel="سيـ فكرة ـل FIKRA SELL">
      <View style={[styles.row, { direction: 'rtl' }]}>
        <Text style={[styles.word, { fontSize: fs, color: ink, lineHeight: height * 1.3 }]}>سيـ</Text>
        <View style={[styles.kashida, { width: lineW, backgroundColor: c.accent, height: Math.max(2, height * 0.07) }]} />
        <FikraLogo height={height} />
        <View style={[styles.kashida, { width: lineW, backgroundColor: c.accent, height: Math.max(2, height * 0.07) }]} />
        <Text style={[styles.word, { fontSize: fs, color: ink, lineHeight: height * 1.3 }]}>ـل</Text>
      </View>
      {showLatin && <Text style={{ fontFamily: font.semibold, letterSpacing: 4, fontSize: height * 0.3, color: c.textMuted, marginTop: 2 }}>FIKRA SELL</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  word: { fontFamily: font.bold, includeFontPadding: false },
  kashida: { borderRadius: 2, marginTop: 6 },
});
