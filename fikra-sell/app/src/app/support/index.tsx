import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Linking, Pressable, View } from 'react-native';
import { EmptyState, ErrorState, Sheet, Skeleton, useToast } from '../../components/feedback';
import { Badge, Button, Header, IconButton, Input, T } from '../../components/ui';
import { useCatalog } from '../../hooks/data';
import { useI18n } from '../../i18n';
import { createTicket, tickets } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { relativeTime } from '../../lib/format';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

export default function Support() {
  const { c } = useTheme();
  const { t, lang } = useI18n();
  const toast = useToast();
  const { userId } = useAuth();
  const catalog = useCatalog();
  const supportEmail = catalog.setting('support_email', '') as string;
  const q = useQuery({ queryKey: ['tickets', userId], queryFn: tickets, enabled: !!userId });
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('support.title')} right={<IconButton name="plus" label={t('support.newTicket')} onPress={() => setOpen(true)} testID="new-ticket" />} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(x) => String(x.id)}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        ListEmptyComponent={q.isLoading ? <Skeleton h={70} r={radius.md} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
          : <EmptyState icon="help" title={t('support.empty')} body={t('support.emptyBody')} action={t('support.newTicket')} onAction={() => setOpen(true)} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/support/${item.id}`)} style={{ padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{`#${item.id} · ${item.subject}`}</T>
              <Badge label={t(`support.${item.status}`)} tone={item.status === 'pending' ? 'accent' : item.status === 'closed' ? 'neutral' : 'primary'} />
            </View>
            <T v="caption" faint>{relativeTime(item.updated_at, lang)}</T>
          </Pressable>
        )}
        ListFooterComponent={supportEmail ? (
          <Pressable onPress={() => Linking.openURL(`mailto:${supportEmail}`)} style={{ paddingTop: space.lg }}>
            <T v="small" muted center>{t('support.contactEmail', { email: supportEmail })}</T>
          </Pressable>
        ) : undefined}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('support.newTicket')}
        footer={<Button title={t('support.submit')} loading={busy} disabled={subject.trim().length < 3 || !body.trim()} testID="submit-ticket" onPress={async () => {
          setBusy(true);
          try { const id = await createTicket(subject.trim(), body.trim()); toast.success('support.sent'); setOpen(false); setSubject(''); setBody(''); q.refetch(); router.push(`/support/${id}`); }
          catch (e) { toast.error(e); } finally { setBusy(false); }
        }} />}>
        <View style={{ gap: space.md }}>
          <Input label={t('support.subject')} value={subject} onChangeText={setSubject} maxLength={120} testID="ticket-subject" />
          <Input label={t('support.message')} value={body} onChangeText={setBody} multiline maxLength={4000} testID="ticket-body" />
        </View>
      </Sheet>
    </View>
  );
}
