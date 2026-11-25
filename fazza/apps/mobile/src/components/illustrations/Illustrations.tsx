/**
 * Original pseudo-3D illustrations for FAZZA (vector, theme-friendly, no third-party assets).
 * Depth is produced with layered gradients, highlights and soft contact shadows.
 */
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

function Shared() {
  return (
    <Defs>
      <RadialGradient id="pinBody" cx="0.35" cy="0.3" r="0.8">
        <Stop offset="0" stopColor="#7C9BFF" /><Stop offset="0.45" stopColor="#3466FF" /><Stop offset="1" stopColor="#1433B0" />
      </RadialGradient>
      <RadialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#0B1E6B" stopOpacity="0.35" /><Stop offset="1" stopColor="#0B1E6B" stopOpacity="0" />
      </RadialGradient>
      <LinearGradient id="boxTop" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFE2B0" /><Stop offset="1" stopColor="#F6C67A" /></LinearGradient>
      <LinearGradient id="boxLeft" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#E9A94F" /><Stop offset="1" stopColor="#D08A2E" /></LinearGradient>
      <LinearGradient id="boxRight" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#D69335" /><Stop offset="1" stopColor="#B87320" /></LinearGradient>
      <LinearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="1" stopColor="#E7EDFF" /></LinearGradient>
      <LinearGradient id="phone" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#1E2B5C" /><Stop offset="1" stopColor="#0B1435" /></LinearGradient>
      <LinearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFE07A" /><Stop offset="1" stopColor="#E7A915" /></LinearGradient>
      <LinearGradient id="green" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#5BE49B" /><Stop offset="1" stopColor="#12B76A" /></LinearGradient>
      <LinearGradient id="blueCard" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#3466FF" /><Stop offset="1" stopColor="#1636B3" /></LinearGradient>
    </Defs>
  );
}

/** The FAZZA mascot: a friendly glossy location pin. */
function Mascot({ x, y, s = 1, wave = false }: { x: number; y: number; s?: number; wave?: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Ellipse cx="0" cy="92" rx="46" ry="10" fill="url(#shadow)" />
      {wave ? <Path d="M44 10 q26 -18 34 -44" stroke="#1E46D8" strokeWidth="12" strokeLinecap="round" fill="none" /> : null}
      <Path d="M-44 14 q-18 14 -16 34" stroke="#1636B3" strokeWidth="12" strokeLinecap="round" fill="none" />
      <Path d="M0 -70C-42 -70 -70 -40 -70 -2C-70 44 0 88 0 88S70 44 70 -2C70 -40 42 -70 0 -70Z" fill="url(#pinBody)" />
      <Ellipse cx="-26" cy="-42" rx="18" ry="10" fill="#FFFFFF" opacity="0.45" transform="rotate(-30 -26 -42)" />
      <Circle cx="0" cy="-6" r="40" fill="url(#glass)" />
      <Circle cx="-14" cy="-12" r="6.5" fill="#0B1640" />
      <Circle cx="14" cy="-12" r="6.5" fill="#0B1640" />
      <Circle cx="-12" cy="-14" r="2" fill="#fff" />
      <Circle cx="16" cy="-14" r="2" fill="#fff" />
      <Ellipse cx="-24" cy="4" rx="6" ry="3.5" fill="#FF8FA3" opacity="0.6" />
      <Ellipse cx="24" cy="4" rx="6" ry="3.5" fill="#FF8FA3" opacity="0.6" />
      <Path d="M-12 6 q12 12 24 0" stroke="#0B1640" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* cap */}
      <Path d="M-34 -36 q34 -30 68 0 z" fill="#0F2A99" />
      <Rect x="-6" y="-58" width="12" height="8" rx="4" fill="#FFFFFF" />
      <Path d="M20 -38 q22 0 30 8 q-16 4 -30 0z" fill="#0F2A99" />
    </G>
  );
}

function Box({ cx, cy, s }: { cx: number; cy: number; s: number }) {
  const w = s * 0.87;
  return (
    <G>
      <Ellipse cx={cx} cy={cy + s * 1.55} rx={s * 1.05} ry={s * 0.22} fill="url(#shadow)" />
      <Path d={`M${cx - w} ${cy} L${cx} ${cy + s * 0.5} L${cx} ${cy + s * 1.5} L${cx - w} ${cy + s} Z`} fill="url(#boxLeft)" />
      <Path d={`M${cx + w} ${cy} L${cx} ${cy + s * 0.5} L${cx} ${cy + s * 1.5} L${cx + w} ${cy + s} Z`} fill="url(#boxRight)" />
      <Path d={`M${cx} ${cy - s * 0.5} L${cx + w} ${cy} L${cx} ${cy + s * 0.5} L${cx - w} ${cy} Z`} fill="url(#boxTop)" />
      <Path d={`M${cx - w * 0.5} ${cy - s * 0.25} L${cx + w * 0.5} ${cy + s * 0.25} L${cx + w * 0.5} ${cy + s * 0.45} L${cx - w * 0.5} ${cy - s * 0.05} Z`} fill="#FFFFFF" opacity="0.55" />
      <Path d={`M${cx + w * 0.5} ${cy + s * 0.25} L${cx + w * 0.5} ${cy + s * 1.25}`} stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth={s * 0.12} />
    </G>
  );
}

export function ParcelScene({ width = 300 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.8} viewBox="0 0 320 256">
      <Shared />
      <Circle cx="160" cy="128" r="112" fill="#3466FF" opacity="0.08" />
      <Circle cx="160" cy="128" r="80" fill="#3466FF" opacity="0.08" />
      <Box cx={205} cy={120} s={48} />
      <Mascot x={110} y={130} s={0.95} wave />
      <Path d="M238 46 l6 -16 l6 16 l16 6 l-16 6 l-6 16 l-6 -16 l-16 -6z" fill="#F5B400" />
      <Circle cx="60" cy="60" r="6" fill="#6C8CF7" />
      <Circle cx="276" cy="190" r="5" fill="#6C8CF7" />
    </Svg>
  );
}

export function OffersScene({ width = 300 }: { width?: number }) {
  const card = (y: number, price: string, stars: number, hi = false) => (
    <G>
      <Rect x="112" y={y} width="150" height="44" rx="12" fill={hi ? "url(#blueCard)" : "url(#glass)"} />
      <Circle cx="132" cy={y + 22} r="11" fill={hi ? "#FFFFFF" : "#C7D4FF"} opacity={hi ? 0.9 : 1} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Circle key={i} cx={152 + i * 10} cy={y + 22} r={3.6} fill={i < stars ? "#F5B400" : hi ? "#ffffff55" : "#C7D4FF"} />
      ))}
      <Rect x="210" y={y + 12} width="44" height="20" rx="10" fill={hi ? "#FFFFFF" : "#1E46D8"} />
      <Rect x="218" y={y + 19} width={price.length * 5} height="6" rx="3" fill={hi ? "#1E46D8" : "#FFFFFF"} />
    </G>
  );
  return (
    <Svg width={width} height={width * 0.8} viewBox="0 0 320 256">
      <Shared />
      <Circle cx="170" cy="128" r="112" fill="#3466FF" opacity="0.08" />
      <Ellipse cx="185" cy="242" rx="80" ry="10" fill="url(#shadow)" />
      <Rect x="98" y="20" width="178" height="222" rx="28" fill="url(#phone)" />
      <Rect x="106" y="30" width="162" height="204" rx="22" fill="#F3F6FF" />
      <Rect x="160" y="36" width="54" height="8" rx="4" fill="#0B1435" />
      {card(58, "1.250", 5, true)}
      {card(110, "1.500", 4)}
      {card(162, "2.000", 4)}
      <Mascot x={70} y={150} s={0.7} wave />
      <Circle cx="292" cy="70" r="16" fill="url(#gold)" />
      <Path d="M286 70 l5 5 l9 -11" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export function TrackingScene({ width = 300 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.8} viewBox="0 0 320 256">
      <Shared />
      <G transform="translate(160 140) skewX(-12) scale(1 0.72) translate(-150 -110)">
        <Rect x="0" y="0" width="300" height="220" rx="26" fill="url(#glass)" />
        <Path d="M0 70 H300 M0 150 H300 M90 0 V220 M210 0 V220" stroke="#C7D4FF" strokeWidth="14" />
        <Path d="M40 180 C 90 170, 100 110, 150 110 S 230 60, 260 40" stroke="#1E46D8" strokeWidth="8" strokeDasharray="14 10" fill="none" strokeLinecap="round" />
      </G>
      <Ellipse cx="248" cy="78" rx="18" ry="5" fill="url(#shadow)" />
      <Path d="M248 22c-14 0-24 10-24 23c0 18 24 33 24 33s24-15 24-33c0-13-10-23-24-23z" fill="url(#green)" />
      <Circle cx="248" cy="45" r="9" fill="#fff" />
      <Mascot x={150} y={118} s={0.75} />
      <Circle cx="58" cy="196" r="12" fill="#1E46D8" />
      <Circle cx="58" cy="196" r="5" fill="#fff" />
    </Svg>
  );
}

export function WalletScene({ width = 220 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.75} viewBox="0 0 240 180">
      <Shared />
      <Ellipse cx="120" cy="164" rx="80" ry="10" fill="url(#shadow)" />
      <Rect x="40" y="48" width="160" height="108" rx="20" fill="url(#blueCard)" />
      <Rect x="40" y="48" width="160" height="30" rx="15" fill="#ffffff" opacity="0.12" />
      <Rect x="150" y="88" width="62" height="36" rx="14" fill="#0F2A99" />
      <Circle cx="170" cy="106" r="7" fill="url(#gold)" />
      {[0, 1, 2].map((i) => <Ellipse key={i} cx="70" cy={46 - i * 9} rx="22" ry="8" fill="url(#gold)" stroke="#C98F0B" strokeWidth="1.5" />)}
    </Svg>
  );
}

export function ShieldScene({ width = 220 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.75} viewBox="0 0 240 180">
      <Shared />
      <Ellipse cx="120" cy="166" rx="60" ry="9" fill="url(#shadow)" />
      <Path d="M120 14 L184 36 V86 C184 126 154 150 120 162 C86 150 56 126 56 86 V36 Z" fill="url(#blueCard)" />
      <Path d="M120 14 L184 36 V86 C184 96 182 106 178 114 L120 14Z" fill="#fff" opacity="0.12" />
      <Path d="M92 88 l20 20 l38 -42" stroke="#fff" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function EmptyBoxScene({ width = 200 }: { width?: number }) {
  return (
    <Svg width={width} height={width * 0.8} viewBox="0 0 240 192">
      <Shared />
      <Box cx={120} cy={60} s={52} />
      <Circle cx="190" cy="40" r="6" fill="#6C8CF7" />
      <Circle cx="44" cy="70" r="4" fill="#6C8CF7" />
    </Svg>
  );
}

export { Mascot };
