import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useI18n } from '../i18n';
import { ensureDeviceSession, useAuth } from '../lib/auth';
import { useTheme } from '../theme/ThemeProvider';
import { BulbLoader, EmptyState } from './feedback';

/** Renders children once the silent device account exists (created automatically, no sign-in screen). */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const { c } = useTheme();
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (userId) return;
    let alive = true;
    ensureDeviceSession().catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [userId, attempt]);
  if (userId) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}>
      {failed ? <EmptyState icon="wifiOff" title={t('empty.errorTitle')} action={t('common.retry')} onAction={() => { setFailed(false); setAttempt((n) => n + 1); }} />
        : <BulbLoader label={t('common.loading')} />}
    </View>
  );
}
