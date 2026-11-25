# سيـ فكرة ـل · FIKRA SELL

تطبيق إعلانات مبوبة للبيع والشراء في دولة الكويت — iOS وAndroid — مع لوحة إدارة ويب ونظام تصميم حصري (FIKRA DESIGN SYSTEM).

| | |
|---|---|
| التطبيق | React Native · Expo SDK 58 · Expo Router · TypeScript |
| الخادم | Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions, pg_cron) |
| لوحة الإدارة | React 19 · Vite · TypeScript (موقع ثابت) |
| البناء والنشر | EAS Build / Update / Submit — مشروع Expo: `@azizqet/fikra-sell` |
| المعرّفات | iOS `com.fikrasell.app` · Android `com.fikrasell.app` · Scheme `fikrasell://` |

## الهيكل
```
app/                 تطبيق الجوال (Expo)
  src/app/           الشاشات (Expo Router)
  src/components/    مكوّنات نظام التصميم (Icon, Brand, AdCard, TabBar, …)
  src/lib/           Supabase، المصادقة، الـ API، الصور، الإشعارات، التنسيق
  src/i18n/          العربية (افتراضية) والإنجليزية
  src/theme/         الرموز اللونية (مستخرجة من الشعار) والوضع الداكن
  e2e/               اختبار المتصفح
admin/               لوحة الإدارة
supabase/
  migrations/        11 ملف ترحيل (المخطط، RLS، الدوال، التخزين، البيانات المرجعية)
  functions/push/    دالة الإشعارات الفورية (Expo Push)
  tests/             اختبارات الأمان والسلوك (110 تحقق)
  seed/              مولّد البيانات المرجعية + الصفحات القانونية
brand/               أدوات الهوية + الملفات المصدرة (+ مكان الشعار الأصلي: brand/source/)
store/               رسومات المتجر
docs/                النشر، المتاجر، التصميم، الأمان، الاختبارات، الحالة
```

## البدء السريع
```bash
cd app && npm install && cp .env.example .env   # ضع رابط Supabase والمفتاح العام
npx expo start                                   # امسح QR بتطبيق Expo Go
```

## الأوامر
| الأمر | الوصف |
|---|---|
| `npm run typecheck` / `npm run lint` / `npm test` | الفحوص (داخل `app/`) |
| `npm run e2e:web` | اختبار المتصفح بالشاشات الرئيسية |
| `npm run brand` | استخراج ألوان الشعار الأصلي وتوليد كل الأيقونات |
| `PGHOST=… supabase/tests/run_local.sh` | اختبارات قاعدة البيانات على Postgres محلي |
| `npm run build` (داخل `admin/`) | بناء لوحة الإدارة |

## الوثائق
- [دليل التشغيل والنشر](docs/DEPLOY.md) — Supabase، Expo Go، TestFlight، Google Play، لوحة الإدارة
- [بيانات المتاجر](docs/STORE.md) — الأوصاف، الكلمات المفتاحية، App Privacy، Data Safety، متطلبات المحتوى
- [نظام التصميم](docs/DESIGN.md)
- [الأمان والخصوصية والنظام التجاري](docs/SECURITY.md)
- [تقرير الاختبارات](docs/TEST_REPORT.md)
- [الحالة والجدول الزمني](docs/STATUS.md)
