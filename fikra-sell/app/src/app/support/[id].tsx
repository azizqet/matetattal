import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BulbLoader, useToast } from '../../components/feedback';
import { Button, Header, Input, T } from '../../components/ui';
import { useI18n } from '../../i18n';
import { replyTicket, ticketMessages } from '../../lib/api';
import { relativeTime } from '../../lib/format';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

export default function Ticket() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['ticket', id], queryFn: () => ticketMessages(Number(id)), refetchInterval: 30_000 });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={`#${id}`} />
      {q.isLoading ? <BulbLoader /> : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: space.lg, gap: space.md }}
          renderItem={({ item }) => (
            <View style={{ alignSelf: item.is_staff ? 'flex-start' : 'flex-end', maxWidth: '85%', gap: 4 }}>
              {item.is_staff && <T v="caption" color={c.primary}>{t('support.staff')}</T>}
              <View style={{ padding: space.md, borderRadius: radius.lg, backgroundColor: item.is_staff ? c.surface : c.primarySoft }}><T>{item.body}</T></View>
              <T v="caption" faint>{relativeTime(item.created_at, lang)}</T>
            </View>
          )}
        />
      )}
      <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md, paddingBottom: insets.bottom + space.md, borderTopWidth: 1, borderTopColor: c.line, alignItems: 'flex-end' }}>
        <Input containerStyle={{ flex: 1 }} value={body} onChangeText={setBody} placeholder={t('support.message')} multiline style={{ minHeight: 44 }} />
        <Button small title={t('common.send')} loading={busy} disabled={!body.trim()} onPress={async () => {
          setBusy(true);
          try { await replyTicket(Number(id), body.trim()); setBody(''); q.refetch(); } catch (e) { toast.error(e); } finally { setBusy(false); }
        }} />
      </View>
    </KeyboardAvoidingView>
  );
}
