import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Card, Empty, Loading, Screen, Text } from '@/components/ui';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function Notifications() {
  const { session } = useSession();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: api.getNotifications, enabled: !!session });
  useEffect(() => {
    if (session && q.data?.some((n) => !n.read_at)) {
      api.markNotificationsRead(session.user.id).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })).catch(() => {});
    }
  }, [q.data, session, qc]);
  if (q.isLoading) return <Loading />;
  return (
    <Screen edges={['bottom']}>
      {q.data?.length ? q.data.map((n) => (
        <Card key={n.id} style={{ marginBottom: 10, borderColor: n.read_at ? colors.line : colors.primary }}>
          <Text variant="title">{n.title}</Text>
          {n.body ? <Text variant="muted">{n.body}</Text> : null}
          <Text variant="small">{new Date(n.created_at).toLocaleString('ar-KW')}</Text>
        </Card>
      )) : <Empty icon="bell-outline" title="لا توجد إشعارات" />}
    </Screen>
  );
}
