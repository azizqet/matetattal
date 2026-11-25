import { brand } from './brand.generated';
import { alpha, mix, onColor } from './color';

/**
 * FIKRA SELL design tokens.
 * Logo colours: turquoise (primary actions & navigation), yellow (featured
 * ads only), red (alerts only), black and white. Everything else is a calm
 * neutral so photos and prices stay the focus.
 */
const neutral = {
  white: '#FFFFFF',
  n25: '#FAFBFB',
  n50: '#F4F6F6',
  n100: '#EAEDED',
  n200: '#DCE1E1',
  n300: '#C3CACA',
  n500: '#86908F',
  n600: '#5E6766',
  n700: '#454C4B',
  n800: '#272C2C',
  n850: '#1C2020',
  n900: '#141717',
  n950: '#0C0E0E',
};

export type Palette = {
  scheme: 'light' | 'dark';
  bg: string; surface: string; surfaceAlt: string; card: string; line: string; lineStrong: string;
  text: string; textMuted: string; textFaint: string;
  primary: string; primaryPressed: string; primarySoft: string; primaryBright: string; onPrimary: string;
  featured: string; featuredSoft: string; onFeatured: string;
  /** Kept for components that highlight small details; equals `featured`. */
  accent: string; accentSoft: string; accentGlow: string; onAccent: string;
  ink: string; price: string;
  success: string; successSoft: string; danger: string; dangerSoft: string; warning: string;
  overlay: string; skeleton: string; skeletonHighlight: string;
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
  primaryPressed: mix(brand.primary, '#000000', 0.15),
  primarySoft: mix(brand.primaryBright, '#FFFFFF', 0.88),
  primaryBright: brand.primaryBright,
  onPrimary: onColor(brand.primary, brand.ink),
  featured: brand.featured,
  featuredSoft: mix(brand.featured, '#FFFFFF', 0.82),
  onFeatured: onColor(brand.featured, brand.ink),
  accent: brand.featured,
  accentSoft: mix(brand.featured, '#FFFFFF', 0.82),
  accentGlow: alpha(brand.featured, 0.3),
  onAccent: onColor(brand.featured, brand.ink),
  ink: brand.ink,
  price: brand.ink,
  success: '#12805C',
  successSoft: '#E3F4EC',
  danger: brand.alert,
  dangerSoft: mix(brand.alert, '#FFFFFF', 0.9),
  warning: '#B7791F',
  overlay: 'rgba(12,14,14,0.45)',
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
  text: '#F2F4F4',
  textMuted: '#A3ACAB',
  textFaint: '#7B8483',
  primary: brand.primaryBright,
  primaryPressed: brand.primary,
  primarySoft: mix(brand.primaryBright, neutral.n950, 0.8),
  primaryBright: brand.primaryBright,
  onPrimary: onColor(brand.primaryBright, brand.ink),
  featured: brand.featured,
  featuredSoft: mix(brand.featured, neutral.n950, 0.82),
  onFeatured: onColor(brand.featured, brand.ink),
  accent: brand.featured,
  accentSoft: mix(brand.featured, neutral.n950, 0.82),
  accentGlow: alpha(brand.featured, 0.25),
  onAccent: onColor(brand.featured, brand.ink),
  ink: brand.ink,
  price: '#FFFFFF',
  success: '#3CC48E',
  successSoft: '#11291F',
  danger: mix(brand.alert, '#FFFFFF', 0.2),
  dangerSoft: mix(brand.alert, neutral.n950, 0.82),
  warning: '#E2A84B',
  overlay: 'rgba(0,0,0,0.6)',
  skeleton: neutral.n850,
  skeletonHighlight: neutral.n800,
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 48 } as const;

/** Soft, consistent rounding (no asymmetric corners). */
export const radius = { socket: 6, sm: 10, md: 12, lg: 16, crown: 16, pill: 999 } as const;

export const font = {
  light: 'ReadexPro_300Light',
  regular: 'ReadexPro_400Regular',
  medium: 'ReadexPro_500Medium',
  semibold: 'ReadexPro_600SemiBold',
  bold: 'ReadexPro_700Bold',
} as const;

export const type = {
  display: { fontFamily: font.bold, fontSize: 28, lineHeight: 38 },
  h1: { fontFamily: font.bold, fontSize: 22, lineHeight: 32 },
  h2: { fontFamily: font.semibold, fontSize: 19, lineHeight: 28 },
  h3: { fontFamily: font.semibold, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: font.medium, fontSize: 15, lineHeight: 23 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: font.medium, fontSize: 11, lineHeight: 16, letterSpacing: 0.2 },
  price: { fontFamily: font.bold, fontSize: 17, lineHeight: 24 },
  priceLarge: { fontFamily: font.bold, fontSize: 26, lineHeight: 34 },
} as const;

export const motion = { fast: 150, base: 220, slow: 380, spring: { damping: 20, stiffness: 260, mass: 0.8 } } as const;
