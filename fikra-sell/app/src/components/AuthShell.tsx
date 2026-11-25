import { router } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';
import { BulbMark, Lockup } from './Brand';
import { IconButton, T } from './ui';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: space.sm, flexDirection: 'row' }}>
        <IconButton name="close" label={t('common.close')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} testID="auth-close" />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xl, paddingBottom: insets.bottom + 40, gap: space.xl }}>
        <View style={{ alignItems: 'center', gap: space.lg, paddingBottom: space.sm }}>
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <BulbMark size={44} />
          </View>
          <Lockup height={30} />
        </View>
        <View style={{ gap: 6 }}>
          <T v="h1">{title}</T>
          {subtitle && <T muted>{subtitle}</T>}
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
