// Web smoke test (rendering, RTL, navigation, runtime errors). Supabase REST is answered with the
// real reference data exported from a local database (see e2e/export_fixtures.sh); ads are empty.
// Run: npm run e2e:web
// visits main screens at iPhone size, collects console errors and screenshots.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const WEB = process.env.WEB_DIR || path.join(__dirname, '..', 'dist-web');
const FIX = path.join(__dirname, 'fixtures');
const OUT = process.env.SHOTS_DIR || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(WEB, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(WEB, 'index.html');
  const ext = path.extname(f);
  res.setHeader('content-type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' }[ext] || 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(8099);

const fixture = (t) => JSON.parse(fs.readFileSync(path.join(FIX, `${t}.json`), 'utf8'));

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: 'ar-KW' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(m.text()); });
    await page.route('https://fikra-test.supabase.co/**', async (route) => {
      const u = new URL(route.request().url());
      const m = u.pathname.match(/\/rest\/v1\/(\w+)/);
      const rpc = u.pathname.match(/\/rest\/v1\/rpc\/(\w+)/);
      if (rpc) return route.fulfill({ json: rpc[1] === 'search_suggestions' ? [] : rpc[1] === 'search_ads' ? [] : null });
      if (m && fs.existsSync(path.join(FIX, `${m[1]}.json`))) {
        let rows = fixture(m[1]);
        if (m[1] === 'pages' && u.searchParams.get('slug')) rows = rows.filter((r) => `eq.${r.slug}` === u.searchParams.get('slug'))[0] ?? null;
        return route.fulfill({ json: rows });
      }
      if (m) return route.fulfill({ json: [] });
      return route.fulfill({ status: 200, json: {} });
    });
    const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(OUT, `${scheme}-${name}.png`) }); };
    await page.goto('http://localhost:8099/');
    await page.waitForTimeout(2600); // animated splash
    await shot('01-home');
    const dir = await page.evaluate(() => document.documentElement.dir);
    results.push(`[${scheme}] document dir = ${dir}`);
    await page.goto('http://localhost:8099/categories'); await page.waitForTimeout(2400); await shot('02-categories');
    await page.goto('http://localhost:8099/category/cars'); await page.waitForTimeout(2400); await shot('03-category-cars');
    await page.goto('http://localhost:8099/search'); await page.waitForTimeout(2400); await shot('04-search');
    await page.goto('http://localhost:8099/auth/sign-up'); await page.waitForTimeout(2400); await shot('05-signup');
    await page.goto('http://localhost:8099/auth/sign-in?reason=post'); await page.waitForTimeout(2400); await shot('06-signin');
    await page.goto('http://localhost:8099/account'); await page.waitForTimeout(2400); await shot('07-account');
    await page.goto('http://localhost:8099/page/terms'); await page.waitForTimeout(2400); await shot('08-terms');
    await page.goto('http://localhost:8099/chats'); await page.waitForTimeout(2400); await shot('09-chats');
    results.push(`[${scheme}] errors: ${errors.length ? errors.join(' | ') : 'none'}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(results.join('\n'));
})();
