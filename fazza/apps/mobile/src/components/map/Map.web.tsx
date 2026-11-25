// Web fallback (used for automated UI tests/screenshots only — the product ships on iOS/Android).
import { forwardRef, useImperativeHandle, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
export interface Region { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }
export const PROVIDER_DEFAULT = undefined;
export const MAP_SUPPORTED = false;

export const MapView = forwardRef<unknown, { style?: StyleProp<ViewStyle>; children?: ReactNode; initialRegion?: Region; region?: Region; onRegionChangeComplete?: (r: Region) => void; showsUserLocation?: boolean; provider?: unknown; showsMyLocationButton?: boolean; toolbarEnabled?: boolean }>(
  function MapView({ style, children }, ref) {
    useImperativeHandle(ref, () => ({ animateToRegion: () => undefined, fitToCoordinates: () => undefined }));
    return (
      <View style={[{ backgroundColor: "#DCE5FF", overflow: "hidden" }, style]}>
        {[0, 1, 2, 3, 4, 5].map((i) => <View key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: `${i * 18 + 6}%`, height: 10, backgroundColor: "#fff", opacity: 0.8 }} />)}
        {[0, 1, 2, 3].map((i) => <View key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${i * 27 + 10}%`, width: 12, backgroundColor: "#fff", opacity: 0.8 }} />)}
        {children ? null : null}
      </View>
    );
  },
);
export function Marker(_: { children?: ReactNode; [k: string]: unknown }) { return null; }
export function Polyline(_: { [k: string]: unknown }) { return null; }
