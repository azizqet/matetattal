import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, type TextInputInstance, View } from 'react-native';
import { AuthShell } from '../../components/AuthShell';
import { useToast } from '../../components/feedback';
import { Icon } from '../../components/Icon';
import { Button, Input, T } from '../../components/ui';
import { useI18n, type TKey } from '../../i18n';
import { EMAIL_RE, useAuth } from '../../lib/auth';
import { toAppError } from '../../lib/errors';
import { useTheme } from '../../theme/ThemeProvider';
import { font, radius, space } from '../../theme/tokens';

const REASON: Record<string, TKey> = { post: 'auth.actionPost', chat: 'auth.actionChat', favorite: 'auth.actionFavorite', report: 'auth.actionReport', default: 'auth.actionDefault' };

export default function SignIn() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { c } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const { signIn, lockedFor } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) { setError(t('auth.invalidEmail')); return; }
    if (!password) { setError(t('errors.invalid_credentials')); return; }
    const wait = await lockedFor();
    if (wait > 0) { setError(t('auth.tooManyAttempts', { s: wait })); return; }
    setBusy(true); setError(null);
    try {
      await signIn(email, password);
      toast.show(t('auth.welcome'), 'success');
      if (router.canGoBack()) router.back(); else router.replace('/');
      if (reason === 'post') setTimeout(() => router.push('/post/new'), 350);
    } catch (e) {
      const a = toAppError(e);
      setError(t(a.key, a.vars));
    } finally { setBusy(false); }
  };

  return (
    <AuthShell title={t('auth.signIn')}>
      {reason && REASON[reason] && (
        <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: c.primarySoft, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
          <Icon name="lock" size={18} color={c.primary} />
          <T v="small" color={c.primary} style={{ flex: 1 }}>{t('auth.guestPrompt', { action: t(REASON[reason]) })}</T>
        </View>
      )}
      <View style={{ gap: space.lg }}>
        <Input testID="signin-email" label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => passRef.current?.focus()} icon="mail" />
        <Input ref={passRef} testID="signin-password" label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry={!show}
          autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} icon="lock"
          right={<Pressable onPress={() => setShow(!show)} hitSlop={10} accessibilityLabel="toggle"><Icon name={show ? 'hide' : 'eye'} size={20} color={c.textMuted} /></Pressable>} />
        <Pressable onPress={() => router.push('/auth/forgot')} style={{ alignSelf: 'flex-end' }} testID="go-forgot"><T v="small" color={c.primary} style={{ fontFamily: font.medium }}>{t('auth.forgot')}</T></Pressable>
        {error && <T v="small" color={c.danger} testID="signin-error">{error}</T>}
        <Button testID="signin-submit" title={t('auth.signIn')} onPress={submit} loading={busy} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1, height: 1, backgroundColor: c.line }} /><T v="small" faint>{t('common.or')}</T><View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
        </View>
        <Button testID="go-signup" title={t('auth.createAccount')} kind="secondary" onPress={() => router.replace('/auth/sign-up')} />
        <Button title={t('auth.continueBrowsing')} kind="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </AuthShell>
  );
}
