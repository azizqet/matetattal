# دليل الإعداد والنشر — فزّاع

> المتطلبات: حساب Supabase (خطة Pro يُنصح بها للإنتاج: نسخ احتياطي يومي + PITR)، حساب Expo/EAS، Apple Developer Program، Google Play Console، مفتاح Google Maps لأندرويد، نطاق (domain) للوحة التحكم والموقع العام.

## 1) مشروع Supabase
1. أنشئ مشروعاً جديداً (المنطقة الأقرب للكويت المتاحة، مثل `me-central-1` أو `eu-central-1`). **لا تستخدم مشروع «ماتعطل» الحالي.**
2. اربط المجلد ثم ادفع المخطط:
   ```bash
   cd fazza
   supabase link --project-ref <REF>
   supabase db push            # يطبق كل ملفات supabase/migrations
   ```
3. فعّل امتداد **pg_cron** (Database → Extensions) ثم أعد تشغيل الـ migration الخاصة بالجدولة إن لزم:
   ```sql
   select cron.schedule('fazza-maintenance', '* * * * *', 'select public.run_maintenance()');
   ```
4. **المصادقة (Authentication → Providers / Settings):**
   - Email: **معطّل**.
   - Phone: **مفعّل**، و «Enable phone confirmations»: **معطّل**.
   - مزود الرسائل: اختر **Send SMS Hook** وأشر إلى `pg-functions://postgres/public/hook_send_sms_refuse_otp` (يرفض أي OTP — لا تُرسل أي رسالة).
   - Allow new users to sign up: **معطّل** (التسجيل يتم فقط عبر Edge Function `auth-signup`).
   - Minimum password length: 8، Password requirements: letters and digits.
   - Hooks → **Password Verification Attempt** → `public.hook_password_verification_attempt` (متاح في خطط Team/Enterprise؛ إن لم يتوفر اترك `FAZZA_AUTH_HOOK_ENABLED=false` فيطبق القفل من دالة `auth-login`).
5. **Edge Functions:**
   ```bash
   supabase functions deploy auth-signup auth-login admin-reset-password delete-account public-request push-dispatch --no-verify-jwt
   supabase secrets set PUSH_WEBHOOK_SECRET=$(openssl rand -hex 32) FAZZA_AUTH_HOOK_ENABLED=true EXPO_ACCESS_TOKEN=<optional>
   ```
6. **الإشعارات الفورية:** خزّن رابط الدالة والسر في Vault (SQL editor):
   ```sql
   select vault.create_secret('https://<REF>.supabase.co/functions/v1/push-dispatch', 'push_dispatch_url');
   select vault.create_secret('<same PUSH_WEBHOOK_SECRET>', 'push_webhook_secret');
   ```
7. **المالك:** سجّل حساب المالك من التطبيق، ثم نفّذ `scripts/admin/create-owner.sql` وبعدها:
   `select public.bootstrap_owner('+965XXXXXXXX');` — يُضاف باقي الموظفين من لوحة التحكم (المستخدمون → صلاحية إدارية).
8. من لوحة التحكم → الإعدادات: أدخل هاتف/واتساب الدعم، رابط الدفع المعتمد وتعليمات الدفع، رابط طلب حذف الحساب، وراجع الشروط وسياسة الخصوصية بعد المراجعة القانونية.

## 2) تطبيق الجوال (EAS)
```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init                      # ينشئ projectId
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<REF>.supabase.co --environment production
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <publishable key> --environment production
npx eas-cli@latest env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value <key> --environment production --visibility sensitive
npx eas-cli@latest env:create --name EAS_PROJECT_ID --value <id> --environment production
npx eas-cli@latest credentials               # تُنشأ وتُحفظ مفاتيح التوقيع في EAS
npm run build:android                        # ينتج AAB موقّعاً للمتجر
npm run build:ios                            # ينتج IPA للرفع إلى App Store Connect
npm run submit:android && npm run submit:ios
```
- **Google Maps:** فعّل «Maps SDK for Android» وقيّد المفتاح باسم الحزمة `kw.fazza.app` وبصمة SHA‑1 لشهادة Play App Signing.
- **الإشعارات:** ارفع مفتاح APNs (Apple) وملف FCM v1 service account (Google) في `eas credentials`.
- مُعرّف الحزمة: iOS و Android = `kw.fazza.app` (غيّره في `app.config.ts` إن رغبت قبل أول رفع).

## 3) لوحة التحكم والموقع العام
```bash
cd apps/admin && VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run build   # ارفع dist/ على أي استضافة ثابتة (Cloudflare Pages/Netlify)
SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/site/build.mjs                # ارفع apps/site/dist/
```
- استخدم نطاقاً منفصلاً للوحة (مثل `admin.fazza.kw`) وفعّل ملف `public/_headers` (CSP وX‑Frame‑Options). الصلاحيات تُفرض من قاعدة البيانات، ولا يوجد أي مفتاح سري في اللوحة.
- روابط المتجر: `https://<site>/privacy.html`, `/terms.html`, `/delete-account.html`.

## 4) النسخ الاحتياطي
راجع [BACKUP.md](BACKUP.md). أضف أسرار GitHub: `FAZZA_SUPABASE_DB_URL`, `FAZZA_BACKUP_PASSPHRASE` لتفعيل النسخ الليلي المشفّر.
