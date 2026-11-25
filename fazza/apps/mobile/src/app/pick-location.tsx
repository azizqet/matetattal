import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { MapView, PROVIDER_DEFAULT, type Region } from "@/components/map/Map";
import { Button, Chips, Icon, T, TextField } from "@/components/ui";
import { useAreas, useErrorAlert, useLang } from "@/lib/hooks";
import { KUWAIT_CENTER, currentPosition, inKuwait, reverseGeocode } from "@/lib/location";
import { supabase } from "@/lib/supabase";
import { draftOrder } from "@/state/draftOrder";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/theme/ThemeProvider";

interface Saved { id: string; label: string; area_id: number | null; address_text: string; notes: string | null; lat: number; lng: number }

export default function PickLocation() {
  const { target } = useLocalSearchParams<{ target: "pickup" | "dropoff" | "address" }>();
  const { t } = useTranslation();
  const lang = useLang();
  const { colors, radius } = useTheme();
  const { session } = useAuth();
  const qc = useQueryClient();
  const showError = useErrorAlert();
  const map = useRef<MapView>(null);
  const existing = target === "pickup" || target === "dropoff" ? draftOrder.get()[target] : null;
  const [center, setCenter] = useState({ latitude: existing?.lat ?? KUWAIT_CENTER.latitude, longitude: existing?.lng ?? KUWAIT_CENTER.longitude });
  const [address, setAddress] = useState(existing?.address ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [areaId, setAreaId] = useState<number | null>(existing?.area_id ?? null);
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("");
  const [saveFav, setSaveFav] = useState(target === "address");
  const [busy, setBusy] = useState(false);
  const { data: areaData } = useAreas();
  const { data: saved } = useQuery({
    queryKey: ["addresses"],
    queryFn: async () => (await supabase.from("saved_addresses").select("*").order("created_at", { ascending: false })).data as Saved[],
  });

  const moveTo = (lat: number, lng: number, delta = 0.02) => {
    const r: Region = { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta };
    setCenter({ latitude: lat, longitude: lng });
    map.current?.animateToRegion(r, 500);
  };

  useEffect(() => {
    if (existing) return;
    currentPosition().then((p) => { if (p && inKuwait(p)) moveTo(p.latitude, p.longitude, 0.01); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearestArea = (lat: number, lng: number) => {
    const areas = areaData?.areas ?? [];
    let best: { id: number; d: number } | null = null;
    for (const a of areas) {
      const d = (a.lat - lat) ** 2 + (a.lng - lng) ** 2;
      if (!best || d < best.d) best = { id: a.id, d };
    }
    return best && best.d < 0.0009 ? best.id : null; // within ~3 km
  };

  const onRegion = async (r: Region) => {
    setCenter({ latitude: r.latitude, longitude: r.longitude });
    setAreaId(nearestArea(r.latitude, r.longitude));
    const a = await reverseGeocode({ latitude: r.latitude, longitude: r.longitude });
    if (a) setAddress(a);
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (areaData?.areas ?? []).filter((a) => a.name_ar.includes(q) || a.name_en.toLowerCase().includes(q)).slice(0, 8);
  }, [query, areaData]);

  const areaName = (id: number | null) => {
    const a = areaData?.areas.find((x) => x.id === id);
    return a ? (lang === "ar" ? a.name_ar : a.name_en) : "";
  };

  const ok = inKuwait(center);
  const confirm = async () => {
    const addr = address.trim() || areaName(areaId) || `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`;
    setBusy(true);
    try {
      if (saveFav && session) {
        const { error } = await supabase.from("saved_addresses").insert({
          user_id: session.user.id, label: label.trim() || addr.slice(0, 40), area_id: areaId, address_text: addr,
          notes: notes.trim() || null, lat: center.latitude, lng: center.longitude,
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["addresses"] });
      }
      if (target === "pickup" || target === "dropoff") {
        draftOrder.set({ [target]: { lat: center.latitude, lng: center.longitude, address: addr, notes: notes.trim() || undefined, area_id: areaId } });
      }
      router.back();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <MapView ref={map} provider={PROVIDER_DEFAULT} style={{ flex: 1 }} showsUserLocation
        initialRegion={{ ...center, latitudeDelta: existing ? 0.01 : 0.3, longitudeDelta: existing ? 0.01 : 0.3 }}
        onRegionChangeComplete={onRegion} />
      <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 300, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
        <View style={{ alignItems: "center", marginBottom: 36 }}>
          <View style={{ backgroundColor: colors.primary, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff" }}>
            <Icon name={target === "dropoff" ? "flag" : "cube"} size={18} color="#fff" />
          </View>
          <View style={{ width: 3, height: 16, backgroundColor: colors.primary }} />
        </View>
      </View>
      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0, padding: 14, gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => router.back()} style={{ width: 50, height: 54, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <TextField testID="area-search" value={query} onChangeText={setQuery} placeholder={t("picker.searchArea")} icon="search" />
          </View>
        </View>
        {results.length ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: "hidden" }}>
            <FlatList data={results} keyboardShouldPersistTaps="handled" keyExtractor={(a) => String(a.id)} renderItem={({ item }) => (
              <Pressable onPress={() => { setQuery(""); setAreaId(item.id); setAddress(lang === "ar" ? item.name_ar : item.name_en); moveTo(item.lat, item.lng, 0.02); }}
                style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", gap: 10 }}>
                <Icon name="location-outline" size={18} color={colors.primary} />
                <T>{lang === "ar" ? item.name_ar : item.name_en}</T>
                <T color="faint" v="small">{lang === "ar" ? areaData?.governorates.find((g) => g.id === item.governorate_id)?.name_ar : areaData?.governorates.find((g) => g.id === item.governorate_id)?.name_en}</T>
              </Pressable>
            )} />
          </View>
        ) : null}
      </SafeAreaView>
      <Pressable onPress={() => currentPosition().then((p) => p && moveTo(p.latitude, p.longitude, 0.008))}
        style={{ position: "absolute", end: 16, bottom: 316, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", elevation: 4 }}>
        <Icon name="locate" color={colors.primary} />
      </Pressable>
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, gap: 10 }}>
        <T v="h3">{target === "pickup" ? t("order.choosePickup") : target === "dropoff" ? t("order.chooseDropoff") : t("account.addresses")}</T>
        {saved?.length && target !== "address" ? (
          <Chips value={null} onChange={(id) => {
            const s = saved.find((x) => x.id === id);
            if (s) { setAddress(s.address_text); setNotes(s.notes ?? ""); setAreaId(s.area_id); moveTo(s.lat, s.lng, 0.008); }
          }} options={saved.slice(0, 6).map((s) => ({ value: s.id, label: s.label, icon: "bookmark" as const }))} />
        ) : null}
        <TextField testID="address-text" value={address} onChangeText={setAddress} placeholder={t("picker.addressPh")} icon="map-outline" />
        <TextField value={notes} onChangeText={setNotes} placeholder={t("order.notes")} />
        {target !== "address" ? (
          <Pressable onPress={() => setSaveFav((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name={saveFav ? "checkbox" : "square-outline"} color={colors.primary} />
            <T v="small">{t("picker.saveAddress")}</T>
          </Pressable>
        ) : null}
        {saveFav ? <TextField value={label} onChangeText={setLabel} placeholder={t("picker.label")} /> : null}
        {!ok ? <T color="danger" v="small">{t("picker.outside")}</T> : <T v="caption" color="faint">{t("picker.moveMap")}</T>}
        <Button testID="use-location" title={t("picker.useThis")} disabled={!ok} loading={busy} onPress={confirm} />
      </SafeAreaView>
    </View>
  );
}
