import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { TicketThread, ticketTone } from '@/components/Support';
import { Badge, Empty, Loading, Row, Screen, Text } from '@/components/ui';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { TICKET_STATUS_AR } from '@/lib/utils';

export default function TicketScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { session } = useSession();
  const q = useQuery({ queryKey: ['tickets', 'one', id], queryFn: () => api.getTicket(id), enabled: Number.isFinite(id) && !!session, refetchInterval: 30_000 });
  if (q.isLoading) return <Loading />;
  const t = q.data;
  if (!t || !session) return <Empty icon="headset" title="الطلب غير موجود" />;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: `طلب دعم #${t.id}` }} />
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Text variant="title" style={{ flex: 1 }}>{t.subject}</Text>
          <Badge label={TICKET_STATUS_AR[t.status]} tone={ticketTone(t.status)} />
        </Row>
        <TicketThread ticket={t} uid={session.user.id} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
