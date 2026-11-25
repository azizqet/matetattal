import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { View } from "react-native";
import { T } from "@/components/ui/T";

// Same geometry as scripts/brand/marks.mjs (original FAZZA mark).
export const PIN = "M512 168C352 168 236 288 236 446C236 650 512 862 512 862S788 650 788 446C788 288 672 168 512 168Z";
export const F_MARK = "M430 318h196a30 30 0 0 1 0 60H500v62h104a30 30 0 0 1 0 60H500v86a35 35 0 0 1-70 0V348a30 30 0 0 1 30-30z";

export function LogoMark({ size = 72, rounded = true }: { size?: number; rounded?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3466FF" /><Stop offset="0.55" stopColor="#1E46D8" /><Stop offset="1" stopColor="#0F2A99" />
        </LinearGradient>
        <RadialGradient id="hl" cx="0.25" cy="0.15" r="0.75">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" /><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#2F5BFF" /><Stop offset="1" stopColor="#1433B0" /></LinearGradient>
        <LinearGradient id="pin" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#DCE5FF" /></LinearGradient>
      </Defs>
      <Rect width="1024" height="1024" rx={rounded ? 230 : 0} fill="url(#bg)" />
      <Rect width="1024" height="1024" rx={rounded ? 230 : 0} fill="url(#hl)" />
      <Rect x="92" y="380" width="150" height="34" rx="17" fill="#fff" opacity={0.9} />
      <Rect x="132" y="452" width="110" height="34" rx="17" fill="#fff" opacity={0.9} />
      <Rect x="168" y="524" width="74" height="34" rx="17" fill="#fff" opacity={0.9} />
      <Path d={PIN} fill="url(#pin)" />
      <Path d={F_MARK} fill="url(#fg)" />
    </Svg>
  );
}

export function Wordmark({ size = 56, light }: { size?: number; light?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <LogoMark size={size} />
      <View>
        <T v="h1" color={light ? "white" : "text"} style={{ fontSize: size * 0.5, lineHeight: size * 0.66 }}>فزّاع</T>
        <T w="bold" color={light ? "#DCE5FF" : "primary"} style={{ letterSpacing: 4, fontSize: size * 0.24, lineHeight: size * 0.32 }}>FAZZA</T>
      </View>
    </View>
  );
}
