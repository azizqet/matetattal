import React, { useState } from 'react';
import { View } from 'react-native';
import { useI18n, type TKey } from '../i18n';
import { report } from '../lib/api';
import { space } from '../theme/tokens';
import { Sheet, useToast } from './feedback';
import { Button, Chip, Input } from './ui';

const REASONS = ['scam', 'prohibited', 'offensive', 'spam', 'wrong_category', 'duplicate', 'sold', 'other'] as const;

export function ReportSheet({ visible, onClose, targetType, targetId, reasons }: {
  visible: boolean; onClose: () => void; targetType: 'ad' | 'user' | 'conversation' | 'message'; targetId: string; reasons?: (typeof REASONS)[number][];
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const list = reasons ?? (targetType === 'ad' ? REASONS : (['scam', 'offensive', 'spam', 'other'] as const));

  return (
    <Sheet visible={visible} onClose={onClose} title={t('report.title')}
      footer={<Button title={t('report.submit')} disabled={!reason} loading={busy} testID="submit-report" onPress={async () => {
        setBusy(true);
        try { await report(targetType, targetId, reason!, details.trim()); toast.show(t('report.thanks'), 'success'); setReason(null); setDetails(''); onClose(); }
        catch (e) { toast.error(e); } finally { setBusy(false); }
      }} />}>
      <View style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {list.map((r) => <Chip key={r} testID={`reason-${r}`} label={t(`report.${r}` as TKey)} active={reason === r} onPress={() => setReason(r)} />)}
        </View>
        <Input label={t('report.details')} value={details} onChangeText={setDetails} multiline maxLength={1000} placeholder={t('common.optional')} />
      </View>
    </Sheet>
  );
}
