// Screenshot of the categories tab with one section expanded (uses fixtures; run after expo export).
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const WEB = path.join(__dirname, '..', 'dist-web'); const FIX = path.join(__dirname, 'fixtures'); const OUT = process.argv[2];
const server = http.createServer((req, res) => { let f = path.join(WEB, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(WEB, 'index.html');
  res.setHeader('content-type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf' }[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res); }).listen(8097);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'ar-KW' })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route('https://fikra-test.supabase.co/**', (r) => { const m = new URL(r.request().url()).pathname.match(/\/rest\/v1\/(\w+)/);
    if (m && fs.existsSync(path.join(FIX, `${m[1]}.json`))) return r.fulfill({ json: JSON.parse(fs.readFileSync(path.join(FIX, `${m[1]}.json`), 'utf8')) });
    return r.fulfill({ json: m ? [] : {} }); });
  await p.goto('http://localhost:8097/categories'); await p.waitForTimeout(2600);
  await p.locator('[data-testid="cat-cars"]').first().click(); await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(OUT, 'categories-expanded.png') });
  const subs = await p.locator('[data-testid^="sub-row-"]').count();
  console.log(JSON.stringify({ subs, errs })); await b.close(); server.close();
})();
