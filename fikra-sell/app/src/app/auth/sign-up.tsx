import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, type TextInputInstance, View } from 'react-native';
import { AuthShell } from '../../components/AuthShell';
import { useToast } from '../../components/feedback';
import { Icon } from '../../components/Icon';
import { Button, Input, T } from '../../components/ui';
import { useI18n } from '../../i18n';
import { EMAIL_RE, passwordOk, useAuth } from '../../lib/auth';
import { toAppError } from '../../lib/errors';
import { useTheme } from '../../theme/ThemeProvider';
import { font, space } from '../../theme/tokens';

/**
 * Sign-up: name, e-mail, password → "Create account" → straight into the app.
 * No confirmation e-mail, no OTP, no activation link, no waiting.
 */
export default function SignUp() {
  const { c } = useTheme();
  const { t, lang } = useI18n();
  const toast = useToast();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const openedAt = useRef(0);
  useEffect(() => { openedAt.current = Date.now(); }, []);
  const emailRef = useRef<TextInputInstance>(null);
  const passRef = useRef<TextInputInstance>(null);

  const submit = async () => {
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = t('auth.nameRequired');
    if (!EMAIL_RE.test(email.trim())) e.email = t('auth.invalidEmail');
    if (!passwordOk(password)) e.password = t('auth.weakPassword');
    setErrors(e);
    if (Object.keys(e).length) return;
    // Bots submit instantly; humans need a few seconds to fill three fields.
    if (Date.now() - openedAt.current < 2500) { setErrors({ form: t('errors.over_request_rate_limit') }); return; }
    setBusy(true);
    try {
      await signUp(name, email, password, lang);
      toast.show(t('auth.welcome'), 'success');
      router.dismissAll();
      router.replace('/');
    } catch (err) {
      const a = toAppError(err);
      setErrors({ form: t(a.key, a.vars) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t('auth.signUp')}>
      <View style={{ gap: space.lg }}>
        <Input testID="signup-name" label={t('auth.name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={60}
          returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} error={errors.name} icon="user" />
        <Input ref={emailRef} testID="signup-email" label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
          keyboardType="email-address" autoComplete="email" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => passRef.current?.focus()} error={errors.email} icon="mail" />
        <Input ref={passRef} testID="signup-password" label={t('auth.choosePassword')} value={password} onChangeText={setPassword} secureTextEntry={!show}
          autoComplete="new-password" textContentType="newPassword" returnKeyType="done" onSubmitEditing={submit} error={errors.password} hint={t('auth.passwordHint')} icon="lock"
          right={<Pressable onPress={() => setShow(!show)} hitSlop={10} accessibilityLabel="toggle"><Icon name={show ? 'hide' : 'eye'} size={20} color={c.textMuted} spark={false} /></Pressable>} />
        {errors.form && <T v="small" color={c.danger} testID="signup-error">{errors.form}</T>}
        <Button testID="signup-submit" title={t('auth.createAccount')} onPress={submit} loading={busy} />
        <T v="small" faint center>
          {t('auth.terms', { terms: t('auth.termsLink'), privacy: t('auth.privacyLink') })}
        </T>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.lg }}>
          <Pressable onPress={() => router.push('/page/terms')}><T v="small" color={c.primary} style={{ fontFamily: font.medium }}>{t('auth.termsLink')}</T></Pressable>
          <Pressable onPress={() => router.push('/page/privacy')}><T v="small" color={c.primary} style={{ fontFamily: font.medium }}>{t('auth.privacyLink')}</T></Pressable>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: space.sm }}>
          <T muted>{t('auth.haveAccount')}</T>
          <Pressable onPress={() => router.replace('/auth/sign-in')} testID="go-signin"><T color={c.primary} style={{ fontFamily: font.semibold }}>{t('auth.signIn')}</T></Pressable>
        </View>
      </View>
    </AuthShell>
  );
}
