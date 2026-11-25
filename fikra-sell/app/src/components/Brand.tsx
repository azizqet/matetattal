import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { logoAspect, logoSource } from '../theme/logo.generated';
import { useTheme } from '../theme/ThemeProvider';
import { font } from '../theme/tokens';
import { Icon } from './Icon';

/** The official logo file once added (brand/source/fikra-logo.png → `npm run brand`), otherwise the «فكرة» wordmark. */
export function FikraLogo({ height = 36 }: { height?: number }) {
  const { c } = useTheme();
  if (logoSource) {
    return <Image source={logoSource} style={{ height, width: height * logoAspect }} contentFit="contain" accessibilityLabel="فكرة سيل" />;
  }
  return (
    <Text accessibilityLabel="فكرة" style={{ fontFamily: font.bold, fontSize: height * 0.78, color: c.primary, lineHeight: height * 1.2, includeFontPadding: false }}>فكرة</Text>
  );
}

/**
 * «سيـ فكرة ـل» lockup. With the official logo file present, the file is shown
 * as-is (never redrawn). Until then: «سيـ ـل» in ink wrapping «فكرة» in turquoise.
 * Always laid out right-to-left, whatever the UI language.
 */
export function Lockup({ height = 34, showLatin = false }: { height?: number; showLatin?: boolean }) {
  const { c } = useTheme();
  if (logoSource) {
    return (
      <View style={{ alignItems: 'center' }}>
        <Image source={logoSource} style={{ height: height * 1.25, width: height * 1.25 * logoAspect }} contentFit="contain" accessibilityLabel="سيـ فكرة ـل FIKRA SELL" />
      </View>
    );
  }
  const fs = height * 0.78;
  const ink = c.scheme === 'dark' ? c.text : c.ink;
  const bar = { width: height * 0.32, height: Math.max(2, height * 0.075), backgroundColor: c.primaryBright, borderRadius: 2, marginTop: height * 0.2 };
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityLabel="سيـ فكرة ـل FIKRA SELL">
      <View style={[styles.row, { direction: 'rtl' }]}>
        <Text style={[styles.word, { fontSize: fs, color: ink, lineHeight: height * 1.3 }]}>سيـ</Text>
        <View style={bar} />
        <FikraLogo height={height} />
        <View style={bar} />
        <Text style={[styles.word, { fontSize: fs, color: ink, lineHeight: height * 1.3 }]}>ـل</Text>
      </View>
      {showLatin && <Text style={{ fontFamily: font.semibold, letterSpacing: 4, fontSize: height * 0.3, color: c.textMuted, marginTop: 2 }}>FIKRA SELL</Text>}
    </View>
  );
}

/** Neutral placeholder for ads without photos. */
export function PhotoPlaceholder({ size = 34 }: { size?: number }) {
  const { c } = useTheme();
  return <Icon name="image" size={size} color={c.lineStrong} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  word: { fontFamily: font.bold, includeFontPadding: false },
});
