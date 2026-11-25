import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { saveSearch } from '../lib/api';
import { useRequireAuth } from '../lib/auth';
import type { SearchFilters } from '../lib/types';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';
import type { FeedLayout } from './AdFeed';
import { Sheet, useToast } from './feedback';
import { activeFilterCount } from './FilterSheet';
import { Icon } from './Icon';
import { Button, Input, Switch } from './ui';

export function ResultsToolbar({ filters, base, onOpenFilters, layout, setLayout, defaultName }: {
  filters: SearchFilters; base?: SearchFilters; onOpenFilters: () => void; layout: FeedLayout; setLayout: (l: FeedLayout) => void; defaultName: string;
}) {
  const { c } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const guard = useRequireAuth();
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const n = activeFilterCount(filters, base);

  const pill = (label: string, icon: Parameters<typeof Icon>[0]['name'], onPress: () => void, active = false, testID?: string) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} testID={testID}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? c.primary : c.line, backgroundColor: active ? c.primarySoft : c.bg }}>
      <Icon name={icon} size={17} color={active ? c.primary : c.text} />
      <Text style={{ fontFamily: font.medium, fontSize: 13, color: active ? c.primary : c.text }}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm }}>
        {pill(n ? `${t('search.filters')} · ${n}` : t('search.filters'), 'filter', onOpenFilters, n > 0, 'open-filters')}
        {pill(t('search.saveSearch'), 'bookmark', () => guard('default', () => { setName(defaultName); setSaveOpen(true); }), false, 'save-search')}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')} accessibilityRole="button" accessibilityLabel={layout === 'grid' ? t('home.list') : t('home.grid')} hitSlop={8}
          style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
          <Icon name={layout === 'grid' ? 'list' : 'grid'} size={18} color={c.text} />
        </Pressable>
      </View>
      <Sheet visible={saveOpen} onClose={() => setSaveOpen(false)} title={t('search.saveSearch')} scroll={false}
        footer={<Button title={t('common.save')} loading={busy} testID="confirm-save-search" onPress={async () => {
          setBusy(true);
          try { await saveSearch(name.trim() || defaultName, filters, notify); toast.success('search.saved'); setSaveOpen(false); }
          catch (e) { toast.error(e); } finally { setBusy(false); }
        }} />}>
        <View style={{ gap: space.md }}>
          <Input label={t('search.searchName')} value={name} onChangeText={setName} maxLength={60} />
          <Switch label={t('search.notifyMatches')} value={notify} onValueChange={setNotify} />
        </View>
      </Sheet>
    </>
  );
}
