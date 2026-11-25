import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { BulbLoader, EmptyState, ErrorState } from '../../components/feedback';
import { Header, T } from '../../components/ui';
import { useI18n } from '../../i18n';
import { getPage } from '../../lib/api';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

/** Renders the minimal Markdown used by the legal pages (headings, bullets, bold). */
function Markdown({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.md }}>
      {text.split('\n').map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        const strip = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1');
        if (line.startsWith('# ')) return null; // title shown in header
        if (line.startsWith('## ')) return <T key={i} v="h3" style={{ marginTop: space.md }}>{strip(line.slice(3))}</T>;
        if (/^[-*] /.test(line)) return (
          <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, marginTop: 10 }} />
            <T style={{ flex: 1 }}>{strip(line.slice(2))}</T>
          </View>
        );
        return <T key={i}>{strip(line)}</T>;
      })}
    </View>
  );
}

export default function PageScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const { t, pick } = useI18n();
  const q = useQuery({ queryKey: ['page', slug], queryFn: () => getPage(slug), staleTime: 60 * 60_000 });
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={q.data ? pick(q.data.title_ar, q.data.title_en) : ''} />
      {q.isLoading ? <BulbLoader /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <EmptyState title={t('errors.not_found')} /> : (
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 60 }}>
          <Markdown text={pick(q.data.body_ar, q.data.body_en)} />
        </ScrollView>
      )}
    </View>
  );
}
