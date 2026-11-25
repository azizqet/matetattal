import React, { useState } from 'react';
import { View } from 'react-native';
import { AuthShell } from '../../components/AuthShell';
import { Button, Input, T } from '../../components/ui';
import { useI18n } from '../../i18n';
import { EMAIL_RE, useAuth } from '../../lib/auth';
import { toAppError } from '../../lib/errors';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

export default function Forgot() {
  const { c } = useTheme();
  const { t } = useI18n();
  const { sendReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <AuthShell title={t('auth.resetTitle')} subtitle={t('auth.resetBody')}>
      <View style={{ gap: space.lg }}>
        <Input testID="forgot-email" label={t('auth.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" icon="mail" />
        {error && <T v="small" color={c.danger}>{error}</T>}
        {sent && <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: c.successSoft }}><T v="small" color={c.success} testID="forgot-sent">{t('auth.resetSent')}</T></View>}
        <Button testID="forgot-submit" title={t('auth.sendLink')} loading={busy} disabled={sent} onPress={async () => {
          if (!EMAIL_RE.test(email.trim())) { setError(t('auth.invalidEmail')); return; }
          setBusy(true); setError(null);
          try { await sendReset(email); setSent(true); }
          catch (e) {
            const a = toAppError(e);
            // Never reveal whether an e-mail is registered.
            if (a.key === 'errors.over_request_rate_limit' || a.key === 'errors.network') setError(t(a.key)); else setSent(true);
          } finally { setBusy(false); }
        }} />
      </View>
    </AuthShell>
  );
}
