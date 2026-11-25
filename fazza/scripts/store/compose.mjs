// Composes captioned store screenshots from raw app screenshots (store/raw) with headless Chromium.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const font = `data:font/ttf;base64,${readFileSync(`${root}/apps/mobile/node_modules/@expo-google-fonts/ibm-plex-sans-arabic/700Bold/IBMPlexSansArabic_700Bold.ttf`).toString("base64")}`;

const SHOTS = [
  ["04-home", "اطلب توصيل أي شيء في الكويت", "Deliver anything across Kuwait"],
  ["08-offers", "قارن عروض المناديب واختر الأنسب", "Compare driver offers, pick the best"],
  ["11-tracking", "تتبّع المندوب مباشرة حتى بابك", "Track your driver live to your door"],
  ["10-chat", "تواصل مباشرة مع المندوب", "Chat and call your driver"],
  ["23-driver-dashboard", "للمناديب: أرباحك وطلباتك في مكان واحد", "Drivers: earnings and orders in one place"],
  ["25-driver-offer", "حدّد سعرك بنفسك", "Set your own price"],
  ["27-driver-wallet", "محفظة شفافة: عمولة على الطلبات المكتملة فقط", "Transparent wallet: commission on completed orders only"],
  ["01-onboarding", "فزّاع… توصيل أسرع بسعرك أنت", "FAZZA — faster delivery at your price"],
];
const TARGETS = [{ name: "ios-6.9", w: 1290, h: 2796 }, { name: "android-phone", w: 1080, h: 2160 }];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of TARGETS) {
  for (const lang of ["ar", "en"]) {
    const out = `${root}/store/screenshots/${t.name}/${lang}`;
    mkdirSync(out, { recursive: true });
    for (const [i, [file, ar, en]] of SHOTS.entries()) {
      const img = readFileSync(`${root}/store/raw/${file}.png`).toString("base64");
      const shotH = Math.round(t.h * 0.74);
      const shotW = Math.round(shotH * (430 / 932));
      await page.setViewportSize({ width: t.w, height: t.h });
      await page.setContent(`<html dir="${lang === "ar" ? "rtl" : "ltr"}"><head><style>
        @font-face{font-family:Plex;src:url('${font}')}
        body{margin:0;width:${t.w}px;height:${t.h}px;overflow:hidden;font-family:Plex,'DejaVu Sans',sans-serif;
          background:radial-gradient(circle at 15% 8%,#5b84ff 0,transparent 45%),linear-gradient(160deg,#3466FF,#1E46D8 50%,#0F2A99);display:flex;flex-direction:column;align-items:center}
        h1{color:#fff;font-size:${Math.round(t.w * 0.068)}px;line-height:1.35;text-align:center;margin:${Math.round(t.h * 0.055)}px ${Math.round(t.w * 0.08)}px ${Math.round(t.h * 0.035)}px;font-weight:700}
        .phone{width:${shotW}px;height:${shotH}px;border-radius:${Math.round(shotW * 0.11)}px;overflow:hidden;border:${Math.round(t.w * 0.012)}px solid #0B1435;
          box-shadow:0 40px 90px rgba(6,15,61,.55);background:#fff}
        .phone img{width:100%;height:100%;object-fit:cover;object-position:top}
      </style></head><body><h1>${lang === "ar" ? ar : en}</h1><div class="phone"><img src="data:image/png;base64,${img}"></div></body></html>`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, "0")}-${file}.jpg`, type: "jpeg", quality: 90 });
    }
    console.log("wrote", out);
  }
}
await browser.close();
