// ينسخ تطبيق الويب (جذر المستودع) إلى mobile/www ليُضمَّن داخل التطبيق
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..'), out = join(here, '..', 'www');
rmSync(out, { recursive: true, force: true }); mkdirSync(join(out, 'icons'), { recursive: true });
for (const f of ['index.html', 'admin.html', 'manifest.webmanifest']) cpSync(join(root, f), join(out, f));
for (const d of ['css', 'js']) cpSync(join(root, d), join(out, d), { recursive: true });
// الأيقونات الخفيفة فقط (بدون صور الـ splash الكبيرة الخاصة بالويب)
for (const f of readdirSync(join(root, 'icons'))) if (!/^splash-|^og\./.test(f)) cpSync(join(root, 'icons', f), join(out, 'icons', f));
// علامة أن الملفات تعمل داخل التطبيق الأصلي
let html = readFileSync(join(out, 'index.html'), 'utf8');
html = html.replace('<html lang="ar" dir="rtl">', '<html lang="ar" dir="rtl" data-native="1">');
writeFileSync(join(out, 'index.html'), html);
console.log('www ready:', out);
