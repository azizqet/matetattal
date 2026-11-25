import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, Switch as RNSwitch, View } from 'react-native';
import { EmptyState, ErrorState, Skeleton, useToast } from '../components/feedback';
import { Button, Header, IconButton, T } from '../components/ui';
import { useCatalog } from '../hooks/data';
import { useI18n } from '../i18n';
import { deleteSavedSearch, savedSearches, updateSavedSearch } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatKwd } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

export default function SavedSearches() {
  const { c } = useTheme();
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const { userId } = useAuth();
  const catalog = useCatalog();
  const q = useQuery({ queryKey: ['saved-searches', userId], queryFn: savedSearches, enabled: !!userId });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('account.savedSearches')} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={{ padding: space.lg, gap: space.md }}
        ListEmptyComponent={q.isLoading ? <Skeleton h={110} r={radius.lg} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
          : <EmptyState icon="bookmark" title={t('saved.empty')} body={t('saved.emptyBody')} />}
        renderItem={({ item: s }) => {
          const parts = [
            s.query && `«${s.query}»`, s.filters.category_id && catalog.catName(s.filters.category_id),
            s.filters.governorate_id && catalog.placeName(s.filters.governorate_id, s.filters.area_id),
            (s.filters.min_price || s.filters.max_price) && `${s.filters.min_price ? formatKwd(s.filters.min_price, lang) : '0'} – ${s.filters.max_price ? formatKwd(s.filters.max_price, lang) : '∞'}`,
          ].filter(Boolean);
          return (
            <View style={{ padding: space.lg, gap: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <T v="bodyStrong" style={{ flex: 1 }}>{s.name}</T>
                <IconButton name="trash" label={t('common.delete')} onPress={async () => { try { await deleteSavedSearch(s.id); qc.invalidateQueries({ queryKey: ['saved-searches'] }); } catch (e) { toast.error(e); } }} />
              </View>
              {parts.length > 0 && <T v="small" muted>{parts.join(' · ')}</T>}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <T v="small" style={{ flex: 1 }}>{t('search.notifyMatches')}</T>
                <RNSwitch value={s.notify} trackColor={{ true: c.primary, false: c.lineStrong }} thumbColor="#FFF"
                  onValueChange={async (v) => { try { await updateSavedSearch(s.id, v); qc.invalidateQueries({ queryKey: ['saved-searches'] }); } catch (e) { toast.error(e); } }} />
              </View>
              <Button small kind="secondary" title={t('saved.run')} icon="search"
                onPress={() => router.push({ pathname: '/search', params: { filters: JSON.stringify({ ...s.filters, q: s.query || undefined }) } })} />
            </View>
          );
        }}
      />
    </View>
  );
}
