// الموافقة الإلكترونية على الشروط (المرحلة 1).
// • التطبيق يرسل فقط: معرّف الوثيقة + السياق. الخادم يسجّل المستخدم والوقت والإصدار والبصمة.
// • لا يُطلب شيء إذا لم تُنشر أي نسخة نافذة بعد (لا نوقف التسجيل قبل النشر — قرار المالك).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';
import type { ConsentContext, PendingTerm, TermsDocument, TermsKind } from '@/lib/types';
import { arabicError, parseTermsBody } from '@/lib/utils';
import { Button, Card, Icon, Row, Text, useToast } from './ui';

const REG_KEY = 'matetattal.registration-consent'; // معرّفات الوثائق التي وافق عليها المستخدم في شاشة التسجيل

const platform = (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : undefined) as 'ios' | 'android' | 'web' | undefined;
const appVersion = Constants.expoConfig?.version;

export function recordConsent(ids: number[], context: ConsentContext, companyId?: number | null) {
  return api.acceptTerms(ids, context, companyId, platform, appVersion);
}

/** يُستدعى من شاشة التسجيل: نحفظ ما وافق عليه ليُسجَّل في أول جلسة (قد تأتي بعد تفعيل الإيميل) */
export async function rememberRegistrationConsent(ids: number[]) {
  try { await AsyncStorage.setItem(REG_KEY, JSON.stringify(ids)); } catch { /* التخزين غير متاح */ }
}

/** النسخ النافذة لأنواع محددة + هل وافق عليها المستخدم الحالي */
export function useRequiredTerms(kinds: TermsKind[]) {
  const { session } = useSession();
  const docs = useQuery({ queryKey: ['terms', 'current', kinds.join(',')], queryFn: () => api.getCurrentTerms(kinds) });
  const accepted = useQuery({ queryKey: ['terms', 'accepted', session?.user.id], queryFn: api.getMyAcceptedDocIds, enabled: !!session });
  const pending = (docs.data ?? []).filter((d) => !accepted.data?.includes(d.id));
  return { loading: docs.isLoading || (!!session && accepted.isLoading), docs: docs.data ?? [], pending };
}

/** مربع إقرار: «قرأت وأوافق على ...» مع إمكانية قراءة كل وثيقة */
export function ConsentCheckbox({ docs, checked, onChange, testID = 'consent-check' }: {
  docs: Pick<TermsDocument, 'id' | 'title' | 'version' | 'body'>[]; checked: boolean; onChange: (v: boolean) => void; testID?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!docs.length) return null;
  return (
    <View style={{ marginTop: 14 }}>
      <Pressable onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }} testID={testID}>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Icon name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={checked ? colors.primary : colors.muted} />
          <Text style={{ flex: 1 }}>
            قرأت وأوافق على: {docs.map((d) => `${d.title} (الإصدار ${d.version})`).join('، ')}
          </Text>
        </Row>
      </Pressable>
      <Row style={{ flexWrap: 'wrap', marginTop: 6 }}>
        {docs.map((d) => (
          <Button key={d.id} small kind="ghost" icon="file-document-outline" title={open === d.id ? 'إخفاء ' + d.title : 'اقرأ ' + d.title}
            onPress={() => setOpen(open === d.id ? null : d.id)} />
        ))}
      </Row>
      {open != null ? <TermsBody body={docs.find((d) => d.id === open)?.body ?? ''} compact /> : null}
    </View>
  );
}

export function TermsBody({ body, compact }: { body: string; compact?: boolean }) {
  const parts = parseTermsBody(body);
  const content = parts.map((p, i) => (
    <Text key={i} variant={p.heading ? 'title' : 'body'} style={{ marginTop: p.heading ? 14 : 4 }}>{p.text}</Text>
  ));
  if (!compact) return <>{content}</>;
  return (
    <Card style={{ maxHeight: 320, padding: 0 }}>
      <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 14 }}>{content}</ScrollView>
    </Card>
  );
}

/**
 * بوابة الموافقة للمستخدمين المسجّلين: إذا نُشرت نسخة جديدة لم يوافق عليها المستخدم،
 * تظهر شاشة تطلب الموافقة قبل متابعة استخدام الحساب (أو تسجيل الخروج).
 */
export function ConsentGate() {
  const { session, signOut } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const uid = session?.user.id;
  const pending = useQuery({ queryKey: ['terms', 'pending', uid], queryFn: api.getMyPendingTerms, enabled: !!uid, staleTime: 5 * 60_000 });
  const ids = (pending.data ?? []).map((p) => p.document_id);
  const docs = useQuery({
    queryKey: ['terms', 'docs', ids.join(',')], enabled: ids.length > 0,
    queryFn: async () => (await api.getCurrentTerms()).filter((d) => ids.includes(d.id)),
  });
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const regDone = useRef<string | null>(null);

  // موافقة التسجيل المحفوظة → تُسجَّل تلقائياً بسياق registration (لنفس الوثائق فقط)
  useEffect(() => {
    if (!uid || !pending.data?.length || regDone.current === uid) return;
    regDone.current = uid;
    (async () => {
      let saved: number[] = [];
      try { saved = JSON.parse((await AsyncStorage.getItem(REG_KEY)) ?? '[]'); } catch { saved = []; }
      const match = pending.data!.filter((p: PendingTerm) => saved.includes(p.document_id)).map((p) => p.document_id);
      if (!match.length) return;
      try {
        await recordConsent(match, 'registration');
        await AsyncStorage.removeItem(REG_KEY).catch(() => {});
        qc.invalidateQueries({ queryKey: ['terms'] });
      } catch { /* تبقى البوابة تطلب الموافقة يدوياً */ }
    })();
  }, [uid, pending.data, qc]);

  const visible = !!uid && ids.length > 0 && !!docs.data?.length;
  async function accept() {
    setBusy(true);
    try {
      await recordConsent(ids, 'update');
      setChecked(false);
      await qc.invalidateQueries({ queryKey: ['terms'] });
      toast('شكراً، تم تسجيل موافقتك');
    } catch (e) { toast(arabicError(e)); } finally { setBusy(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => {}} testID="consent-gate">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, direction: 'rtl' }}>
        <ScrollView contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
          <Text variant="h1">تحديث الشروط والسياسات</Text>
          <Text variant="muted">نشرنا نسخة جديدة من الوثائق التالية. لمتابعة استخدام حسابك، اقرأها ووافق عليها.</Text>
          {(docs.data ?? []).map((d) => (
            <Card key={d.id} style={{ marginTop: 12 }}>
              <Text variant="title">{d.title}</Text>
              <Text variant="small">الإصدار {d.version}{d.published_at ? ` · نُشرت ${new Date(d.published_at).toLocaleDateString('ar-KW')}` : ''}</Text>
              <TermsBody body={d.body} compact />
            </Card>
          ))}
          <ConsentCheckbox docs={docs.data ?? []} checked={checked} onChange={setChecked} testID="gate-check" />
          <Button title="أوافق وأتابع" icon="check" style={{ marginTop: 14 }} disabled={!checked} loading={busy} onPress={accept} testID="gate-accept" />
          <Button title="تسجيل الخروج" kind="ghost" style={{ marginTop: 6 }} onPress={() => signOut().catch(() => {})} />
          <Text variant="small" style={{ marginTop: 10, textAlign: 'center', fontFamily: fonts.regular }}>
            تُسجَّل موافقتك مع وقتها ورقم الإصدار وبصمة النص لتوثيقها.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
