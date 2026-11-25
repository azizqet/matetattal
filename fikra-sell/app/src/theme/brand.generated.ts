// INTERIM tokens matching the described logo palette (turquoise, yellow, red,
// black, white). The original logo file has not been received yet; run
//   npm run brand -- brand/source/fikra-logo.png
// to overwrite these with the exact colours extracted from the logo pixels.
export const brand = {
  source: 'interim' as 'logo' | 'interim',
  primary: '#00857D', // turquoise — buttons & navigation (white text ≥ 4.5:1)
  primaryBright: '#00B3A7', // turquoise as drawn in the logo — icons & highlights
  featured: '#FFC629', // yellow — featured ads only
  alert: '#D32F2F', // red — alerts & destructive actions
  ink: '#111111', // black
  logoColors: [] as string[],
} as const;
