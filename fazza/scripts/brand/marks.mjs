// FAZZA original brand mark: a location pin whose counter is a forward-moving "F" with speed lines.
export const PIN = "M512 168C352 168 236 288 236 446C236 650 512 862 512 862S788 650 788 446C788 288 672 168 512 168Z";
export const F_MARK = "M430 318h196a30 30 0 0 1 0 60H500v62h104a30 30 0 0 1 0 60H500v86a35 35 0 0 1-70 0V348a30 30 0 0 1 30-30z";
export const SPEED = [
  { x: 92, y: 380, w: 150 },
  { x: 132, y: 452, w: 110 },
  { x: 168, y: 524, w: 74 },
];

export function iconSvg({ size = 1024, transparent = false, mono = false, scale = 1, rounded = false } = {}) {
  const t = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  const bg = transparent ? "" : `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3466FF"/><stop offset="0.55" stop-color="#1E46D8"/><stop offset="1" stop-color="#0F2A99"/>
      </linearGradient>
      <radialGradient id="hl" cx="0.25" cy="0.15" r="0.75">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1024" height="1024" rx="${rounded ? 230 : 0}" fill="url(#bg)"/><rect width="1024" height="1024" rx="${rounded ? 230 : 0}" fill="url(#hl)"/>`;
  const fill = mono ? "#FFFFFF" : "#FFFFFF";
  const inner = mono ? "#000000" : "url(#fg)";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    ${bg}
    <defs>
      <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F5BFF"/><stop offset="1" stop-color="#1433B0"/></linearGradient>
      <linearGradient id="pinShade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE5FF"/></linearGradient>
      <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="26" stdDeviation="28" flood-color="#06134D" flood-opacity="${transparent || mono ? 0 : 0.45}"/></filter>
      <mask id="cut"><rect width="1024" height="1024" fill="#fff"/><path d="${F_MARK}" fill="#000"/></mask>
    </defs>
    <g transform="${t}">
      ${SPEED.map((s) => `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="34" rx="17" fill="${fill}" opacity="${mono ? 1 : 0.9}"/>`).join("")}
      <g filter="url(#sh)">
        ${mono ? `<path d="${PIN}" fill="#fff" mask="url(#cut)"/>` : `<path d="${PIN}" fill="url(#pinShade)"/><path d="${F_MARK}" fill="${inner}"/>`}
      </g>
    </g>
  </svg>`;
}

export function wordmarkSvg({ dark = false, width = 1400, height = 420, fontUrl }) {
  const text = dark ? "#FFFFFF" : "#0F1E5C";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1400 420">
    <style>@font-face{font-family:Plex;src:url('${fontUrl}')} text{font-family:Plex,'DejaVu Sans',Arial,sans-serif}</style>
    <g transform="translate(0 10) scale(0.4)">${iconSvg({ rounded: true }).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
    <text x="470" y="215" font-size="200" font-weight="700" fill="${text}">فزّاع</text>
    <text x="478" y="345" font-size="118" font-weight="700" letter-spacing="18" fill="#1E46D8">FAZZA</text>
  </svg>`;
}
