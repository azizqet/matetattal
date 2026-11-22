import type { ReactNode } from 'react';
import { View } from 'react-native';
import { colors } from '@/lib/theme';

/** خلفية الواجهة الرئيسية (لون الهوية مع زوايا سفلية دائرية) */
export function LinearGradientFallback({ children }: { children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.primaryDark, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
      <View style={{ position: 'absolute', top: -60, left: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.primary, opacity: 0.55 }} />
      <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center' }}>{children}</View>
    </View>
  );
}
