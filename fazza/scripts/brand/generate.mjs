// Renders the FAZZA brand assets to PNG with headless Chromium (Playwright).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { iconSvg, wordmarkSvg } from "./marks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const mobile = resolve(root, "apps/mobile/assets/brand");
const admin = resolve(root, "apps/admin/public");
const store = resolve(root, "store/assets");
const fontBold = resolve(root, "apps/mobile/node_modules/@expo-google-fonts/ibm-plex-sans-arabic/700Bold/IBMPlexSansArabic_700Bold.ttf");
for (const d of [mobile, admin, store]) mkdirSync(d, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(svg, w, h, out, { transparent = true } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.locator("svg").first().screenshot({ omitBackground: transparent, type: "png" });
  writeFileSync(out, buf);
  console.log("wrote", out.replace(root + "/", ""));
}

const sized = (svg, w, h) => svg.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
const fontUrl = `file://${fontBold}`;

await render(iconSvg(), 1024, 1024, `${mobile}/icon.png`, { transparent: false });
await render(iconSvg({ transparent: true, scale: 0.62 }), 1024, 1024, `${mobile}/adaptive-foreground.png`);
await render(iconSvg({ transparent: true, mono: true, scale: 0.62 }), 1024, 1024, `${mobile}/adaptive-monochrome.png`);
await render(sized(iconSvg({ transparent: true, mono: true, scale: 0.9 }), 96, 96), 96, 96, `${mobile}/notification-icon.png`);
await render(sized(iconSvg(), 48, 48), 48, 48, `${mobile}/favicon.png`, { transparent: false });
await render(iconSvg({ scale: 1 }).replace('<rect width="1024" height="1024" rx="0" fill="url(#bg)"/><rect width="1024" height="1024" rx="0" fill="url(#hl)"/>',
  '<circle cx="512" cy="512" r="512" fill="url(#bg)"/><circle cx="512" cy="512" r="512" fill="url(#hl)"/>'), 1024, 1024, `${mobile}/splash-icon.png`);
await render(iconSvg({ scale: 1 }).replace('<rect width="1024" height="1024" rx="0" fill="url(#bg)"/><rect width="1024" height="1024" rx="0" fill="url(#hl)"/>',
  '<circle cx="512" cy="512" r="512" fill="url(#bg)"/><circle cx="512" cy="512" r="512" fill="url(#hl)"/>'), 1024, 1024, `${mobile}/splash-icon-dark.png`);
await render(wordmarkSvg({ fontUrl }), 1400, 420, `${mobile}/wordmark.png`);
await render(wordmarkSvg({ fontUrl, dark: true }), 1400, 420, `${mobile}/wordmark-dark.png`);
// admin
await render(sized(iconSvg(), 192, 192), 192, 192, `${admin}/icon-192.png`, { transparent: false });
await render(sized(iconSvg(), 512, 512), 512, 512, `${admin}/icon-512.png`, { transparent: false });
writeFileSync(`${admin}/favicon.svg`, iconSvg());
// store
await render(iconSvg({ size: 512 }).replace('width="512" height="512"', 'width="512" height="512"'), 512, 512, `${store}/play-icon-512.png`, { transparent: false });
await render(sized(iconSvg(), 1024, 1024), 1024, 1024, `${store}/app-store-icon-1024.png`, { transparent: false });
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <style>@font-face{font-family:Plex;src:url('${fontUrl}')} text{font-family:Plex,'DejaVu Sans',Arial,sans-serif}</style>
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3466FF"/><stop offset="1" stop-color="#0F2A99"/></linearGradient></defs>
  <rect width="1024" height="500" fill="url(#g)"/>
  <circle cx="900" cy="80" r="220" fill="#fff" opacity="0.06"/><circle cx="120" cy="470" r="160" fill="#fff" opacity="0.06"/>
  <g transform="translate(640 70) scale(0.36)">${iconSvg({ transparent: true }).replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>
  <text x="560" y="220" text-anchor="end" font-size="104" font-weight="700" fill="#fff">فزّاع</text>
  <text x="560" y="300" text-anchor="end" font-size="40" font-weight="700" fill="#DCE5FF">توصيل أسرع… بسعرك أنت</text>
  <text x="560" y="360" text-anchor="end" font-size="30" font-weight="700" letter-spacing="6" fill="#fff" opacity="0.85">FAZZA · KUWAIT DELIVERY</text>
</svg>`;
await render(feature, 1024, 500, `${store}/play-feature-graphic-1024x500.png`, { transparent: false });
await browser.close();
