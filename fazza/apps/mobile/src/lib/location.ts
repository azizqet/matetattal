import * as Location from "expo-location";
import { Linking, Platform } from "react-native";
import { Alert } from "@/lib/alert";
import i18n from "./i18n";

export interface LatLng { latitude: number; longitude: number }
export const KUWAIT_CENTER: LatLng = { latitude: 29.3375, longitude: 47.9744 };
export const KUWAIT_BOUNDS = { minLat: 28.4, maxLat: 30.2, minLng: 46.5, maxLng: 48.7 };

export function inKuwait(p: LatLng): boolean {
  return p.latitude >= KUWAIT_BOUNDS.minLat && p.latitude <= KUWAIT_BOUNDS.maxLat &&
    p.longitude >= KUWAIT_BOUNDS.minLng && p.longitude <= KUWAIT_BOUNDS.maxLng;
}

/** Foreground permission only, requested when the user needs it. */
export async function ensureLocationPermission(explain = true): Promise<boolean> {
  const cur = await Location.getForegroundPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) {
    if (explain) {
      Alert.alert(i18n.t("perm.locationTitle"), i18n.t("perm.locationBody"), [
        { text: i18n.t("common.cancel"), style: "cancel" },
        { text: i18n.t("perm.openSettings"), onPress: () => Linking.openSettings() },
      ]);
    }
    return false;
  }
  const r = await Location.requestForegroundPermissionsAsync();
  return r.granted;
}

export async function currentPosition(): Promise<LatLng | null> {
  if (!(await ensureLocationPermission())) return null;
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: p.coords.latitude, longitude: p.coords.longitude };
  } catch {
    return null;
  }
}

export async function reverseGeocode(p: LatLng): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const [a] = await Location.reverseGeocodeAsync(p);
    if (!a) return null;
    return [a.district ?? a.subregion, a.street, a.streetNumber].filter(Boolean).join("، ") || a.formattedAddress || null;
  } catch {
    return null;
  }
}

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.latitude - a.latitude);
  const dLng = toR(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.latitude)) * Math.cos(toR(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Rough ETA for city driving in Kuwait (~28 km/h average incl. traffic). */
export function etaMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 1000 / 28 * 60));
}

export function openNavigation(dest: LatLng) {
  const ll = `${dest.latitude},${dest.longitude}`;
  const options = [
    { text: "Google Maps", url: `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving` },
    { text: "Waze", url: `https://waze.com/ul?ll=${ll}&navigate=yes` },
    ...(Platform.OS === "ios" ? [{ text: "Apple Maps", url: `http://maps.apple.com/?daddr=${ll}&dirflg=d` }] : []),
  ];
  Alert.alert(i18n.t("nav.chooseApp"), undefined, [
    ...options.map((o) => ({ text: o.text, onPress: () => Linking.openURL(o.url) })),
    { text: i18n.t("common.cancel"), style: "cancel" as const },
  ]);
}
