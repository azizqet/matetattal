// هوية «ماتعطل»: أزرق عميق + أصفر تنبيه (مطابقة لهوية الموقع الحالي)
export const colors = {
  primary: '#0757DB',
  primaryDark: '#00369C',
  primarySoft: '#EDF3FF',
  accent: '#FFC400',
  bg: '#F5F8FF',
  card: '#FFFFFF',
  text: '#15233F',
  heading: '#122D66',
  muted: '#66748E',
  line: '#E1E9F7',
  success: '#13A857',
  whatsapp: '#16A34A',
  danger: '#D92D20',
  warningBg: '#FFF6DD',
  warningText: '#775900',
  white: '#FFFFFF',
};

export const fonts = {
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  bold: 'Tajawal_700Bold',
  heavy: 'Tajawal_800ExtraBold',
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 26 };
export const space = (n: number) => n * 4;

export const shadow = {
  shadowColor: '#0C3D8C',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3,
};

// أيقونة لكل خدمة (MaterialCommunityIcons)
export const serviceIcons: Record<string, string> = {
  tow: 'tow-truck', tire: 'tire', keys: 'key-chain-variant', wash: 'car-wash', shield: 'shield-car',
  bat: 'car-battery', mech: 'wrench', other: 'view-grid-outline',
};
