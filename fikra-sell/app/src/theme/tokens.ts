import { brand } from './brand.generated';
import { alpha, mix, onColor } from './color';

/**
 * FIKRA DESIGN SYSTEM — tokens.
 * Brand colours come ONLY from brand.generated.ts (extracted from the logo).
 * Everything else is neutral so the logo colours stay the hero.
 */
const neutral = {
  white: '#FFFFFF',
  n25: '#FBFBFC',
  n50: '#F5F5F7',
  n100: '#ECECF0',
  n200: '#DEDFE5',
  n300: '#C5C7D0',
  n500: '#8A8D99',
  n600: '#676A76',
  n700: '#4A4C56',
  n800: '#2A2B32',
  n850: '#1E1F25',
  n900: '#16171C',
  n950: '#0E0F13',
};

export type Palette = {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  line: string;
  lineStrong: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
  onAccent: string;
  ink: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  overlay: string;
  skeleton: string;
  skeletonHighlight: string;
};

export const light: Palette = {
  scheme: 'light',
  bg: neutral.white,
  surface: neutral.n50,
  surfaceAlt: neutral.n25,
  card: neutral.white,
  line: neutral.n100,
  lineStrong: neutral.n200,
  text: brand.ink,
  textMuted: neutral.n600,
  textFaint: neutral.n500,
  primary: brand.primary,
  primaryPressed: mix(brand.primary, '#000000', 0.18),
  primarySoft: mix(brand.primary, '#FFFFFF', 0.9),
  onPrimary: onColor(brand.primary, brand.ink),
  accent: brand.accent,
  accentSoft: mix(brand.accent, '#FFFFFF', 0.84),
  accentGlow: alpha(brand.accent, 0.35),
  onAccent: onColor(brand.accent, brand.ink),
  ink: brand.ink,
  success: '#12805C',
  successSoft: '#E3F4EC',
  danger: '#C8322B',
  dangerSoft: '#FBE9E7',
  warning: '#B7791F',
  overlay: 'rgba(14,15,19,0.45)',
  skeleton: neutral.n100,
  skeletonHighlight: neutral.n50,
};

export const dark: Palette = {
  scheme: 'dark',
  bg: neutral.n950,
  surface: neutral.n900,
  surfaceAlt: neutral.n850,
  card: neutral.n900,
  line: neutral.n800,
  lineStrong: neutral.n700,
  text: '#F3F3F6',
  textMuted: '#A4A7B3',
  textFaint: '#7C7F8B',
  // Same exact brand hue, lifted only where needed for contrast on dark.
  primary: mix(brand.primary, '#FFFFFF', 0.22),
  primaryPressed: brand.primary,
  primarySoft: mix(brand.primary, neutral.n950, 0.78),
  onPrimary: onColor(mix(brand.primary, '#FFFFFF', 0.22), brand.ink),
  accent: brand.accent,
  accentSoft: mix(brand.accent, neutral.n950, 0.82),
  accentGlow: alpha(brand.accent, 0.3),
  onAccent: onColor(brand.accent, brand.ink),
  ink: brand.ink,
  success: '#3CC48E',
  successSoft: '#11291F',
  danger: '#F0645C',
  dangerSoft: '#2C1513',
  warning: '#E2A84B',
  overlay: 'rgba(0,0,0,0.6)',
  skeleton: neutral.n850,
  skeletonHighlight: neutral.n800,
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

/**
 * "Bulb" radius system: generous crown radii, a tight "base" radius.
 * Cards use crown corners on top and one socket corner at the bottom.
 */
export const radius = { socket: 6, sm: 10, md: 14, lg: 20, crown: 26, pill: 999 } as const;

export const font = {
  light: 'ReadexPro_300Light',
  regular: 'ReadexPro_400Regular',
  medium: 'ReadexPro_500Medium',
  semibold: 'ReadexPro_600SemiBold',
  bold: 'ReadexPro_700Bold',
} as const;

export const type = {
  display: { fontFamily: font.bold, fontSize: 30, lineHeight: 40 },
  h1: { fontFamily: font.bold, fontSize: 24, lineHeight: 34 },
  h2: { fontFamily: font.semibold, fontSize: 20, lineHeight: 30 },
  h3: { fontFamily: font.semibold, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 24 },
  bodyStrong: { fontFamily: font.medium, fontSize: 15, lineHeight: 24 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  caption: { fontFamily: font.medium, fontSize: 11, lineHeight: 16, letterSpacing: 0.2 },
  price: { fontFamily: font.bold, fontSize: 18, lineHeight: 24 },
  priceLarge: { fontFamily: font.bold, fontSize: 26, lineHeight: 34 },
} as const;

/** Filament: the 1.5px geometric line motif taken from the logo strokes. */
export const filament = { width: 1.5, notch: 6 } as const;

export const motion = { fast: 160, base: 240, slow: 420, spring: { damping: 18, stiffness: 220, mass: 0.9 } } as const;
