import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { FlatList, View } from 'react-native';
import { EmptyState, ErrorState, Skeleton, useToast } from '../components/feedback';
import { Avatar, Button, Header, T } from '../components/ui';
import { useI18n } from '../i18n';
import { blockedUsers, unblockUser } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

export default function Blocked() {
  const { c } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const { userId } = useAuth();
  const q = useQuery({ queryKey: ['blocked', userId], queryFn: blockedUsers, enabled: !!userId });
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('blocked.title')} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(b) => b.blocked_id}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        ListEmptyComponent={q.isLoading ? <Skeleton h={60} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <EmptyState icon="block" title={t('blocked.empty')} />}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Avatar path={item.profile?.avatar_path} name={item.profile?.full_name} />
            <T v="bodyStrong" style={{ flex: 1 }}>{item.profile?.full_name ?? '—'}</T>
            <Button small kind="secondary" title={t('common.unblock')} onPress={async () => { try { await unblockUser(item.blocked_id); toast.success('blocked.unblocked'); q.refetch(); } catch (e) { toast.error(e); } }} />
          </View>
        )}
      />
    </View>
  );
}
