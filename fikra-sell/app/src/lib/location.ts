import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

/** Never prompts — used to decide whether to show the "allow location" card. */
export async function locationGranted(): Promise<boolean> {
  try { return (await Location.getForegroundPermissionsAsync()).granted; } catch { return false; }
}

/** Asks (only when the user taps), then returns coordinates rounded to ~110 m. */
export async function currentCoords(ask: boolean): Promise<Coords | null> {
  try {
    const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return { lat: r(pos.coords.latitude), lng: r(pos.coords.longitude) };
  } catch {
    return null;
  }
}

/** Kuwait bounding box check (ads outside Kuwait are not geo-tagged). */
export const inKuwait = (c: Coords) => c.lat > 28.5 && c.lat < 30.2 && c.lng > 46.5 && c.lng < 48.6;
