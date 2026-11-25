#!/usr/bin/env node
// FIKRA DESIGN SYSTEM · asset builder
// Renders every app / store asset from vector sources with headless Chromium.
// If brand/source/fikra-logo.png exists it is embedded UNCHANGED (original
// pixels, original colours); otherwise the interim «فكرة» wordmark is used.
//
//   node brand/tools/build_assets.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // npm i -D playwright (or global install)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_APP = path.join(ROOT, 'app/assets/brand');
const OUT_BRAND = path.join(ROOT, 'brand/exports');
const OUT_STORE = path.join(ROOT, 'store/graphics');
for (const d of [OUT_APP, OUT_BRAND, OUT_STORE]) fs.mkdirSync(d, { recursive: true });

// Colours: from the generated tokens (extracted from the logo when available)
const tokens = fs.readFileSync(path.join(ROOT, 'app/src/theme/brand.generated.ts'), 'utf8');
const pickColor = (k) => tokens.match(new RegExp(`${k}: '(#[0-9A-Fa-f]{6})'`))[1];
const PRIMARY = pickColor('primary');
const INK = pickColor('ink');

const fontDir = path.join(ROOT, 'app/node_modules/@expo-google-fonts/readex-pro');
const fontFile = (w) => fs.readdirSync(path.join(fontDir, w)).find((f) => f.endsWith('.ttf'));
const font = (w) => `data:font/ttf;base64,${fs.readFileSync(path.join(fontDir, w, fontFile(w))).toString('base64')}`;
const FONT_CSS = `
@font-face { font-family: Readex; font-weight: 700; src: url(${font('700Bold')}); }
@font-face { font-family: Readex; font-weight: 500; src: url(${font('500Medium')}); }`;

const logoPath = path.join(ROOT, 'brand/source/fikra-logo.png');
const hasLogo = fs.existsSync(logoPath);
const LOGO = hasLogo ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}` : null;
if (hasLogo) {
  fs.copyFileSync(logoPath, path.join(OUT_APP, 'fikra-logo.png'));
  fs.copyFileSync(logoPath, path.join(OUT_BRAND, 'fikra-logo-original.png'));
}

const BRIGHT = pickColor('primaryBright');

// Interim mark (until the official logo file is added): the «فكرة» wordmark in turquoise.
const wordmark = (size, color = PRIMARY) =>
  `<div style="font-family:Readex;font-weight:700;font-size:${size * 0.42}px;line-height:1;color:${color};direction:rtl">فكرة</div>`;

const mark = (size, opts = {}) => (LOGO && !opts.mono
  ? `<img src="${LOGO}" style="max-width:${size}px;max-height:${size}px;object-fit:contain"/>`
  : `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">${wordmark(size, opts.color ?? PRIMARY)}</div>`);

const lockup = (h, ink = INK) => LOGO ? `<img src="${LOGO}" style="height:${h * 1.4}px"/>` : `
<div style="display:flex;flex-direction:row-reverse;align-items:center;font-family:Readex;font-weight:700;direction:ltr">
  <span style="font-size:${h * 0.78}px;color:${ink};line-height:1">سيـ</span>
  <span style="width:${h * 0.32}px;height:${Math.max(3, h * 0.075)}px;background:${BRIGHT};border-radius:3px;margin-top:${h * 0.2}px"></span>
  <span style="font-size:${h * 0.78}px;color:${PRIMARY};line-height:1">فكرة</span>
  <span style="width:${h * 0.32}px;height:${Math.max(3, h * 0.075)}px;background:${BRIGHT};border-radius:3px;margin-top:${h * 0.2}px"></span>
  <span style="font-size:${h * 0.78}px;color:${ink};line-height:1">ـل</span>
</div>`;

const page = (w, h, body, bg = 'transparent') => `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
html,body{margin:0;width:${w}px;height:${h}px;background:${bg};overflow:hidden}
.c{width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column}</style></head>
<body><div class="c">${body}</div></body></html>`;

const jobs = [
  // App icon: white field, mark at ~62%
  ['app', 'icon.png', 1024, 1024, page(1024, 1024, mark(640), '#FFFFFF'), false],
  // Android adaptive icon: content inside the 66% safe zone
  ['app', 'adaptive-foreground.png', 1024, 1024, page(1024, 1024, mark(560)), true],
  ['app', 'adaptive-monochrome.png', 1024, 1024, page(1024, 1024, mark(560, { color: '#FFFFFF', mono: true })), true],
  ['app', 'splash-icon.png', 512, 512, page(512, 512, mark(400)), true],
  ['app', 'splash-icon-dark.png', 512, 512, page(512, 512, mark(400, { color: '#FFFFFF' })), true],
  ['app', 'notification-icon.png', 96, 96, page(96, 96, mark(84, { color: '#FFFFFF', mono: true })), true],
  ['app', 'favicon.png', 64, 64, page(64, 64, mark(58), '#FFFFFF'), false],
  // Brand exports
  ['brand', 'lockup-light.png', 1600, 600, page(1600, 600, lockup(220), '#FFFFFF'), false],
  ['brand', 'lockup-dark.png', 1600, 600, page(1600, 600, lockup(220, '#F2F4F4'), '#0C0E0E'), false],
  ['brand', 'lockup-transparent.png', 1600, 600, page(1600, 600, lockup(220)), true],
  ['brand', 'mark-1024.png', 1024, 1024, page(1024, 1024, mark(900)), true],
  // Google Play feature graphic 1024×500
  ['store', 'play-feature-graphic.png', 1024, 500, page(1024, 500, `
     <div style="display:flex;flex-direction:column;align-items:center;gap:26px">${lockup(110)}
     <div style="font-family:Readex;font-weight:500;font-size:30px;color:#5E6766;direction:rtl">بيع وشراء بفكرة أذكى · FIKRA SELL</div>
     <div style="width:120px;height:4px;background:${PRIMARY};border-radius:2px"></div></div>`, '#FFFFFF'), false],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
for (const [dir, name, w, h, html, transparent] of jobs) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const out = path.join(dir === 'app' ? OUT_APP : dir === 'brand' ? OUT_BRAND : OUT_STORE, name);
  await p.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
  console.log('✓', path.relative(ROOT, out));
}
await browser.close();

// Logo module for the app (exact original file + aspect ratio)
if (hasLogo) {
  const png = fs.readFileSync(logoPath);
  const w = png.readUInt32BE(16), hgt = png.readUInt32BE(20);
  fs.writeFileSync(path.join(ROOT, 'app/src/theme/logo.generated.ts'),
    `// GENERATED by brand/tools/build_assets.mjs — original «فكرة» logo, unmodified.\n` +
    `export const logoSource: number | null = require('../../assets/brand/fikra-logo.png');\nexport const logoAspect = ${(w / hgt).toFixed(4)};\n`);
  console.log('✓ app/src/theme/logo.generated.ts (original logo linked)');
} else {
  console.log('ℹ original logo not found at brand/source/fikra-logo.png — interim mark used');
}
