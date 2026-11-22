import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAreas } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';
import { Button, Chip, Icon, Row, Text, useToast } from './ui';

/** زر المنطقة الحالية + نافذة اختيار المنطقة أو تحديد الموقع */
export function AreaPill({ light }: { light?: boolean }) {
  const { area } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="اختيار المنطقة"
        style={[st.pill, light && { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.35)' }]}>
        <Icon name="map-marker" size={16} color={light ? colors.accent : colors.primary} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: light ? '#fff' : colors.text }}>{area || 'كل الكويت'}</Text>
        <Icon name="chevron-down" size={16} color={light ? '#fff' : colors.muted} />
      </Pressable>
      <AreaSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AreaSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { area, setArea, locate, locating } = useSession();
  const { data: areas } = useAreas();
  const toast = useToast();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="إغلاق" />
      <View style={st.sheet}>
        <View style={st.handle} />
        <Text variant="h2">وين موقعك؟</Text>
        <Text variant="muted" style={{ marginBottom: 12 }}>نرتّب لك الشركات حسب الأقرب إليك.</Text>
        <Button title="حدد موقعي تلقائياً" icon="crosshairs-gps" loading={locating}
          onPress={async () => { const r = await locate(); if (r.message) toast(r.message); if (r.ok) onClose(); }} />
        <ScrollView style={{ maxHeight: 260, marginTop: 14 }}>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip label="كل الكويت" active={!area} onPress={() => { setArea(null); onClose(); }} />
            {(areas ?? []).map((a) => (
              <Chip key={a.id} label={a.name_ar} active={area === a.name_ar} onPress={() => { setArea(a.name_ar); onClose(); }} />
            ))}
          </Row>
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 7 },
  backdrop: { flex: 1, backgroundColor: 'rgba(10,20,40,0.45)' },
  sheet: { direction: 'rtl', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34, width: '100%', maxWidth: 640, alignSelf: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 12 },
});
