import { alpha, onColor } from './color';

/**
 * FIKRA SELL design tokens — fixed UI palette (only these colours are used in
 * the interface; tints are the same colours with transparency):
 *   navy #1E305C · dark navy #162447 · blue #2D5D9F · white #FFFFFF
 *   light grey background #F5F8FA · grey #808080 · black #111111
 * The logo artwork keeps its own colours and is never recoloured.
 */
export const ui = {
  navy: '#1E305C',
  navyDark: '#162447',
  blue: '#2D5D9F',
  white: '#FFFFFF',
  bgGrey: '#F5F8FA',
  grey: '#808080',
  black: '#111111',
} as const;

export type Palette = {
  scheme: 'light' | 'dark';
  bg: string; surface: string; surfaceAlt: string; card: string; line: string; lineStrong: string;
  text: string; textMuted: string; textFaint: string;
  primary: string; primaryPressed: string; primarySoft: string; primaryBright: string; onPrimary: string;
  featured: string; featuredSoft: string; onFeatured: string;
  /** Kept for older components; maps to the blue. */
  accent: string; accentSoft: string; accentGlow: string; onAccent: string;
  ink: string; price: string; navyDark: string;
  success: string; successSoft: string; danger: string; dangerSoft: string; warning: string;
  overlay: string; skeleton: string; skeletonHighlight: string;
};

export const light: Palette = {
  scheme: 'light',
  bg: ui.bgGrey,
  surface: ui.bgGrey,
  surfaceAlt: ui.white,
  card: ui.white,
  line: alpha(ui.grey, 0.18),
  lineStrong: alpha(ui.grey, 0.35),
  text: ui.black,
  textMuted: ui.grey,
  textFaint: ui.grey,
  primary: ui.navy,
  primaryPressed: ui.navyDark,
  primarySoft: alpha(ui.blue, 0.1),
  primaryBright: ui.blue,
  onPrimary: onColor(ui.navy, ui.black),
  featured: ui.blue,
  featuredSoft: alpha(ui.blue, 0.1),
  onFeatured: ui.white,
  accent: ui.blue,
  accentSoft: alpha(ui.blue, 0.1),
  accentGlow: alpha(ui.blue, 0.2),
  onAccent: ui.white,
  ink: ui.black,
  price: ui.navy,
  navyDark: ui.navyDark,
  success: ui.blue,
  successSoft: alpha(ui.blue, 0.1),
  danger: ui.black,
  dangerSoft: alpha(ui.grey, 0.12),
  warning: ui.navyDark,
  overlay: alpha(ui.black, 0.45),
  skeleton: alpha(ui.grey, 0.15),
  skeletonHighlight: ui.bgGrey,
};

/** Dark mode is disabled (white/grey design); kept equal to light for type compatibility. */
export const dark: Palette = light;

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
