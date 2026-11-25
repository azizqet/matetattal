import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../../components/AuthShell';
import { BulbLoader, useToast } from '../../components/feedback';
import { Button, Input, T } from '../../components/ui';
import { useI18n } from '../../i18n';
import { passwordOk, useAuth } from '../../lib/auth';
import { toAppError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

/** Opened from the password-reset e-mail link (fikrasell://auth/reset-password?code=…). */
export default function ResetPassword() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { c } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const { session, setNewPassword } = useAuth();
  const [ready, setReady] = useState(!!session);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let code = params.code;
      if (!code) { const url = await Linking.getInitialURL(); code = url ? (Linking.parse(url).queryParams?.code as string | undefined) : undefined; }
      if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(code);
        if (e) setError(t(toAppError(e).key));
      }
      setReady(true);
    })();
  }, [params.code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><BulbLoader /></View>;
  return (
    <AuthShell title={t('auth.newPassword')}>
      <View style={{ gap: space.lg }}>
        <Input label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t('auth.passwordHint')} icon="lock" />
        {error && <T v="small" color={c.danger}>{error}</T>}
        <Button title={t('auth.setPassword')} loading={busy} onPress={async () => {
          if (!passwordOk(password)) { setError(t('auth.weakPassword')); return; }
          setBusy(true); setError(null);
          try { await setNewPassword(password); toast.success('auth.passwordUpdated'); router.replace('/'); }
          catch (e) { setError(t(toAppError(e).key)); } finally { setBusy(false); }
        }} />
      </View>
    </AuthShell>
  );
}
