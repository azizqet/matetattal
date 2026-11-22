// هوية «ماتعطل» الفاخرة: أزرق ملكي عميق + ذهبي كويتي، مع وضع فاتح وداكن.
// الوضع يُقرأ من إعداد الجهاز عند فتح التطبيق (Appearance) — تغييره أثناء التشغيل يطبَّق عند إعادة فتح التطبيق.
import { Appearance } from 'react-native';

const light = {
  primary: '#0A5BE0',
  primaryDark: '#062E7A',
  primarySoft: '#EAF1FF',
  accent: '#F5B819',          // ذهبي
  accentSoft: '#FFF5D6',
  bg: '#F4F6FB',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  input: '#FFFFFF',
  inputText: '#000000',
  inputBorder: '#DCE3F0',
  text: '#101B33',
  heading: '#0B1A3D',
  muted: '#67728A',
  line: '#E4E9F2',
  success: '#12A150',
  successSoft: '#E6F6EC',
  successText: '#0C6B37',
  whatsapp: '#17A34A',
  danger: '#D92D20',
  dangerSoft: '#FDECEA',
  warningBg: '#FFF6DD',
  warningText: '#775900',
  white: '#FFFFFF',            // للنص/الأيقونات فوق الأزرق دائماً
  overlay: 'rgba(8,16,36,0.5)',
  toast: '#111C33',
  shadow: '#0A2A66',
  tabBar: '#FFFFFF',
  placeholder: '#98A3B8',
  label: '#243D69',
};
type Palette = typeof light;

const dark: Palette = {
  primary: '#3D82FF',
  primaryDark: '#0A2A66',
  primarySoft: '#14264A',
  accent: '#F5B819',
  accentSoft: '#3A2F0E',
  bg: '#0A101D',
  card: '#121A2B',
  elevated: '#172136',
  input: '#0F1726',
  inputText: '#F3F6FD',
  inputBorder: '#26324A',
  text: '#E7ECF7',
  heading: '#F3F6FD',
  muted: '#93A0BA',
  line: '#212C42',
  success: '#2CC46B',
  successSoft: '#10301F',
  successText: '#7CE0A5',
  whatsapp: '#1FB457',
  danger: '#FF6B5E',
  dangerSoft: '#3A1714',
  warningBg: '#33290C',
  warningText: '#F2CF6B',
  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.6)',
  toast: '#26324A',
  shadow: '#000000',
  tabBar: '#0F1726',
  placeholder: '#5E6B85',
  label: '#B8C4DC',
};

export const isDark = Appearance.getColorScheme?.() === 'dark';
export const colors: Palette = isDark ? dark : light;

// تدرجات الهوية
export const gradients = {
  brand: (isDark ? ['#0A2A66', '#0A4FC2'] : ['#062E7A', '#0A5BE0']) as [string, string],
  gold: ['#F8CB45', '#E9A400'] as [string, string],
};

export const fonts = {
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  bold: 'Tajawal_700Bold',
  heavy: 'Tajawal_800ExtraBold',
};

export const radius = { sm: 12, md: 16, lg: 22, xl: 28 };
export const space = (n: number) => n * 4;

export const shadow = {
  shadowColor: colors.shadow,
  shadowOpacity: isDark ? 0.35 : 0.07,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
};

// أيقونة لكل خدمة (MaterialCommunityIcons)
export const serviceIcons: Record<string, string> = {
  tow: 'tow-truck', tire: 'tire', keys: 'car-key', wash: 'car-wash', shield: 'shield-car',
  bat: 'car-battery', mech: 'car-wrench', other: 'view-grid-outline',
};

// تدرّج مميز لكل خدمة (بطاقات الخدمات في الرئيسية)
export const serviceGradients: Record<string, [string, string]> = {
  tow: ['#0A5BE0', '#2F86FF'],
  tire: ['#111827', '#3B4A66'],
  keys: ['#E9A400', '#F8CB45'],
  wash: ['#0891B2', '#38BDF8'],
  shield: ['#4F46E5', '#7C83FF'],
  bat: ['#16A34A', '#4ADE80'],
  mech: ['#DC5A1E', '#FB923C'],
  other: ['#475569', '#94A3B8'],
};
