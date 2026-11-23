// السطحات والونشات (المرحلة 1B): لكل سطحة حالة مستقلة — متاح / مشغول / غير متصل.
// صاحب الشركة يغيّر الحالة يدوياً، ووقت التحديث يحدده الخادم. العميل يرى آخر حالة ووقتها.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import * as api from '@/lib/api';
import { colors, fonts } from '@/lib/theme';
import type { ServiceRequest, Vehicle, VehicleKind, VehicleStatus } from '@/lib/types';
import { arabicError, timeAgoAr, VEHICLE_KIND_AR, VEHICLE_STATUS_AR, vehicleCounts } from '@/lib/utils';
import { Badge, Button, Card, Chip, Field, Row, SectionTitle, Text, useToast } from './ui';

const STATUSES: VehicleStatus[] = ['available', 'busy', 'offline'];
const KINDS: VehicleKind[] = ['flatbed', 'wrecker', 'other'];
export const statusTone = (s: string) => (s === 'available' ? 'green' : s === 'busy' ? 'yellow' : 'gray') as 'green' | 'yellow' | 'gray';
const dotColor = (s: string) => (s === 'available' ? '#16A34A' : s === 'busy' ? '#D97706' : '#98A3B8');

export function StatusDot({ status }: { status: string }) {
  return <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dotColor(status) }} />;
}

/** شارة مختصرة لبطاقة الشركة: «2 متاح الآن» */
export function AvailableVehiclesBadge({ vehicles }: { vehicles?: Pick<Vehicle, 'status' | 'is_active'>[] }) {
  const n = vehicleCounts(vehicles);
  if (!n.total) return null;
  return n.available > 0
    ? <Badge label={`${n.available} ${n.available === 1 ? 'سطحة متاحة' : 'متاح'} الآن`} tone="green" />
    : <Badge label="لا توجد سطحة متاحة الآن" tone="gray" />;
}

/** عرض للعميل في صفحة الشركة (يتحدث كل 30 ثانية) */
export function VehicleStatusList({ companyId, initial }: { companyId: number; initial?: Vehicle[] }) {
  const q = useQuery({
    queryKey: ['vehicles', companyId], queryFn: () => api.getCompanyVehicles(companyId),
    initialData: initial, refetchInterval: 30_000,
  });
  const list = (q.data ?? []).filter((v) => v.is_active);
  if (!list.length) return null;
  const n = vehicleCounts(list);
  return (
    <>
      <SectionTitle title="السطحات الآن" action={<Text variant="small">{n.available} متاح من {n.total}</Text>} />
      <Card testID="vehicle-status-list">
        {list.map((v, i) => (
          <Row key={v.id} gap={10} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <StatusDot status={v.status} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold }}>{v.label}</Text>
              <Text variant="small">{VEHICLE_KIND_AR[v.kind]} · آخر تحديث {timeAgoAr(v.status_updated_at)}</Text>
            </View>
            <Badge label={VEHICLE_STATUS_AR[v.status]} tone={statusTone(v.status)} />
          </Row>
        ))}
        <Text variant="small" style={{ marginTop: 6 }}>الحالة يحدّثها مقدم الخدمة. تأكد منه عند التواصل.</Text>
      </Card>
    </>
  );
}

/** إدارة السطحات من لوحة الشركة */
export function VehicleManager({ companyId }: { companyId: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['vehicles', companyId], queryFn: () => api.getCompanyVehicles(companyId) });
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<VehicleKind>('flatbed');
  const [showHidden, setShowHidden] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['vehicles', companyId] }); qc.invalidateQueries({ queryKey: ['my-companies'] }); };
  const onError = (e: unknown) => toast(arabicError(e));
  const add = useMutation({ mutationFn: () => api.addVehicle(companyId, label.trim(), kind), onSuccess: () => { setLabel(''); refresh(); toast('تمت إضافة السطحة. حالتها «غير متصل» حتى تغيّرها'); }, onError });
  const setStatus = useMutation({ mutationFn: (v: { id: number; s: VehicleStatus }) => api.setVehicleStatus(v.id, v.s), onSuccess: refresh, onError });
  const setActive = useMutation({ mutationFn: (v: { id: number; on: boolean }) => api.setVehicleActive(v.id, v.on), onSuccess: refresh, onError });

  const all = q.data ?? [];
  const active = all.filter((v) => v.is_active);
  const hidden = all.filter((v) => !v.is_active);
  return (
    <>
      <SectionTitle title="السطحات والونشات" />
      <Card testID="vehicle-manager">
        <Text variant="small">كل سطحة لها حالة مستقلة يراها العميل مع وقت آخر تحديث.</Text>
        {active.map((v) => (
          <View key={v.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={8}><StatusDot status={v.status} /><Text style={{ fontFamily: fonts.bold }}>{v.label}</Text><Text variant="small">{VEHICLE_KIND_AR[v.kind]}</Text></Row>
              <Text variant="small">{timeAgoAr(v.status_updated_at)}</Text>
            </Row>
            <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {STATUSES.map((s) => (
                <Chip key={s} label={VEHICLE_STATUS_AR[s]} active={v.status === s}
                  onPress={() => (v.status === s ? undefined : setStatus.mutate({ id: v.id, s }))} />
              ))}
              <Button small kind="ghost" icon="eye-off-outline" title="إيقاف" onPress={() => setActive.mutate({ id: v.id, on: false })} />
            </Row>
          </View>
        ))}
        {!active.length && !q.isLoading ? <Text variant="muted" style={{ marginTop: 8 }}>لا توجد سطحات. أضف سطحاتك ليعرف العميل المتاح منها.</Text> : null}

        <Row style={{ alignItems: 'flex-end', marginTop: 4 }}>
          <View style={{ flex: 1 }}><Field label="اسم مختصر للسطحة" value={label} onChangeText={setLabel} maxLength={40} placeholder="مثال: سطحة 1" testID="vehicle-label" /></View>
        </Row>
        <Text variant="small" style={{ marginTop: 4 }}>لا تكتب رقم اللوحة كاملاً.</Text>
        <Row style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {KINDS.map((k) => <Chip key={k} label={VEHICLE_KIND_AR[k]} active={kind === k} onPress={() => setKind(k)} />)}
        </Row>
        <Button small title="إضافة سطحة" icon="plus" style={{ marginTop: 10 }} disabled={!label.trim()} loading={add.isPending} onPress={() => add.mutate()} testID="vehicle-add" />

        {hidden.length ? (
          <>
            <Button small kind="ghost" title={showHidden ? 'إخفاء الموقوفة' : `السطحات الموقوفة (${hidden.length})`} onPress={() => setShowHidden(!showHidden)} />
            {showHidden ? hidden.map((v) => (
              <Row key={v.id} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text variant="muted">{v.label}</Text>
                <Button small kind="soft" title="إعادة تفعيل" onPress={() => setActive.mutate({ id: v.id, on: true })} />
              </Row>
            )) : null}
          </>
        ) : null}
      </Card>
    </>
  );
}

/** قبول طلب مع اختيار السطحة (اختياري)، أو تحديد سطحة لطلب مقبول */
export function RequestVehicleActions({ r, companyId, onDone }: { r: ServiceRequest; companyId: number; onDone: () => void }) {
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const q = useQuery({ queryKey: ['vehicles', companyId], queryFn: () => api.getCompanyVehicles(companyId) });
  const vehicles = (q.data ?? []).filter((v) => v.is_active)
    .sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status));
  const accept = useMutation({
    mutationFn: (vid: number | null) => (r.status === 'new' ? api.acceptRequestWithVehicle(r.id, vid) : api.assignRequestVehicle(r.id, vid)),
    onSuccess: () => { setPicking(false); onDone(); toast(r.status === 'new' ? 'تم قبول الطلب' : 'تم تحديد السطحة'); },
    onError: (e) => toast(arabicError(e)),
  });

  const isNew = r.status === 'new';
  if (!isNew && !['accepted', 'on_way'].includes(r.status)) return null;
  if (!vehicles.length) {
    return isNew ? <Button small title="قبول" loading={accept.isPending} onPress={() => accept.mutate(null)} /> : null;
  }
  if (!picking) {
    return <Button small title={isNew ? 'قبول' : r.vehicle_id ? 'تغيير السطحة' : 'تحديد سطحة'} kind={isNew ? 'primary' : 'soft'} icon="tow-truck" onPress={() => setPicking(true)} testID={`accept-${r.id}`} />;
  }
  return (
    <View style={{ width: '100%', marginTop: 6 }}>
      <Text variant="label">{isNew ? 'اختر السطحة التي ستنفذ الطلب' : 'اختر السطحة'}</Text>
      <Row style={{ flexWrap: 'wrap' }}>
        {vehicles.map((v) => (
          <Chip key={v.id} label={`${v.label} · ${VEHICLE_STATUS_AR[v.status]}`} active={r.vehicle_id === v.id} onPress={() => accept.mutate(v.id)} />
        ))}
      </Row>
      <Row style={{ marginTop: 6 }}>
        {isNew ? <Button small kind="soft" title="قبول بدون تحديد" loading={accept.isPending} onPress={() => accept.mutate(null)} /> : null}
        <Button small kind="ghost" title="إلغاء" onPress={() => setPicking(false)} />
      </Row>
    </View>
  );
}
