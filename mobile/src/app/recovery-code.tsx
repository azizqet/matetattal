// رمز استعادة الحساب: الطريقة الآمنة لاسترجاع الحساب بدون SMS أو بريد.
// إنشاء رمز جديد يلغي القديم، والرمز يُعرض مرة واحدة فقط (يُحفظ في الخادم مشفّراً بـ bcrypt).
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { Button, Card, Row, Screen, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, fonts, radius } from '@/lib/theme';
import { arabicError } from '@/lib/utils';

export default function RecoveryCode() {
  const { session } = useSession();
  const toast = useToast();
  const has = useQuery({ queryKey: ['has-recovery'], queryFn: api.hasRecoveryCode, enabled: !!session });
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!session) return null;

  async function create() {
    setBusy(true);
    try { setCode(await api.createRecoveryCode()); setConfirm(false); has.refetch(); }
    catch (e) { toast(arabicError(e)); } finally { setBusy(false); }
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="muted">إذا نسيت كلمة السر تقدر تغيّرها برقم تلفونك + رمز الاستعادة. الرقم وحده ما يكفي.</Text>
      {code ? (
        <Card style={{ marginTop: 14 }}>
          <View style={{ paddingVertical: 18, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primarySoft, alignItems: 'center' }}>
            <Text selectable testID="recovery-code" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 32, color: colors.heading }}>{code}</Text>
          </View>
          <Button title="حفظ أو مشاركة الرمز" kind="soft" icon="share-variant-outline" style={{ marginTop: 12 }}
            onPress={() => { Share.share({ message: `رمز استعادة حساب ماتعطل: ${code}` }).catch(() => {}); }} />
          <Text variant="small" style={{ marginTop: 10, color: colors.warningText }}>احفظه في مكان آمن. ما راح نعرضه مرة ثانية، ولا أحد من فريقنا يطلبه منك.</Text>
        </Card>
      ) : (
        <Card style={{ marginTop: 14 }}>
          <Text variant="title">{has.data ? 'عندك رمز استعادة محفوظ' : 'ما عندك رمز استعادة'}</Text>
          <Text variant="small">{has.data ? 'إذا ضاع الرمز أو شكّيت أن أحد شافه، أنشئ رمزاً جديداً وراح يتوقف القديم فوراً.' : 'أنشئ رمزاً الآن حتى تقدر تسترجع حسابك إذا نسيت كلمة السر.'}</Text>
          {has.data && !confirm ? (
            <Button title="إنشاء رمز جديد" kind="soft" style={{ marginTop: 12 }} onPress={() => setConfirm(true)} testID="new-code" />
          ) : has.data && confirm ? (
            <Row style={{ marginTop: 12 }}>
              <Button title="نعم، ألغِ القديم" style={{ flex: 1 }} loading={busy} onPress={create} testID="new-code-confirm" />
              <Button title="تراجع" kind="soft" style={{ flex: 1 }} onPress={() => setConfirm(false)} />
            </Row>
          ) : (
            <Button title="إنشاء رمز استعادة" style={{ marginTop: 12 }} loading={busy || has.isLoading} onPress={create} testID="new-code" />
          )}
        </Card>
      )}
    </Screen>
  );
}
