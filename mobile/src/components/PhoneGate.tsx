// بعد اعتماد الدخول برقم الهاتف: أي حساب مسجّل دخوله بدون رقم مؤكَّد برمز SMS (حساب قديم بالإيميل)
// يُحوَّل لصفحة ربط الرقم. التصفح بدون حساب يبقى متاحاً، وصلاحيات الإدارة يفرضها الخادم (is_admin يشترط رقماً مؤكَّداً).
import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { hasConfirmedPhone } from '@/lib/api';
import { useSession } from '@/lib/session';

export function PhoneGate() {
  const { ready, session } = useSession();
  const segments = useSegments();
  const onAuth = segments[0] === 'auth' || segments[0] === 'legal';
  const needsPhone = ready && !!session && !hasConfirmedPhone(session.user);
  useEffect(() => {
    if (needsPhone && !onAuth) router.replace('/auth?mode=link');
  }, [needsPhone, onAuth]);
  return null;
}
