# دليل التشغيل والنشر — سيـ فكرة ـل (FIKRA SELL)

هذا الدليل يأخذك من الكود إلى: رابط Expo Go + QR، لوحة الإدارة على الإنترنت، نسخة TestFlight، ونسخة Google Play (AAB).

> الأوامر تُنفَّذ من مجلد `fikra-sell/`. لا تضع أي مفتاح سري داخل الكود أو GitHub — المفاتيح السرية تُحفظ في Supabase (Function secrets) وEAS (Environment variables) فقط.

---

## 0) المتطلبات

| الأداة | الغرض |
|---|---|
| Node.js 22 | تشغيل التطبيق ولوحة الإدارة |
| حساب Expo (`azizqet`) | مشروع `@azizqet/fikra-sell` جاهز (ID: `2a70f95d-19f4-4a15-9ef6-ec2ccca4b9aa`) |
| مشروع Supabase مستقل | قاعدة البيانات + المصادقة + التخزين + Realtime |
| Apple Developer + App Store Connect | TestFlight وApp Store |
| Google Play Console | الاختبار الداخلي والنشر |

---

## 1) قاعدة البيانات (Supabase)

1. أنشئ مشروعاً جديداً باسم `fikra-sell` (المنطقة المقترحة: `eu-central-1` أو `ap-south-1` الأقرب للكويت).
   - الخطة المجانية تسمح بمشروعين نشطين فقط لكل مالك؛ أوقف (Pause) مشروعاً غير مستخدم أو رقِّ الخطة.
2. طبّق ملفات الترحيل بالترتيب (`supabase/migrations/0001` → `0011`):
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   أو من SQL Editor بلصق الملفات بالترتيب.
3. **تعطيل تأكيد البريد (دخول مباشر بعد التسجيل):**
   Dashboard → Authentication → Sign In / Providers → Email → أطفئ **Confirm email**.
   (أو `npx supabase config push` لأن `supabase/config.toml` يضبط `enable_confirmations = false` وحدود المحاولات).
4. Authentication → URL Configuration: أضف `fikrasell://reset-password` و`fikrasell://**` إلى Redirect URLs (لاستعادة كلمة المرور).
5. Authentication → Rate Limits: اترك القيم من `config.toml` (20 تسجيل/دخول لكل IP كل 5 دقائق).
6. **أول مالك للوحة الإدارة:** سجّل حساباً من التطبيق ثم نفّذ مرة واحدة في SQL Editor:
   ```sql
   update public.profiles set role = 'owner' where id = (select id from auth.users where email = 'YOUR@EMAIL');
   ```
7. **الإشعارات الفورية (اختياري الآن، ضروري للنسخ الرسمية):**
   ```bash
   npx supabase functions deploy push --no-verify-jwt
   npx supabase secrets set PUSH_WEBHOOK_SECRET=<random-64-chars>
   ```
   ثم في SQL Editor:
   ```sql
   insert into private.config values
     ('push_url', 'https://<ref>.supabase.co/functions/v1/push'),
     ('push_secret', '<نفس القيمة>')
   on conflict (key) do update set value = excluded.value;
   ```
8. **النسخ الاحتياطي:** الخطة المجانية لا تتضمن نسخاً يومياً قابلاً للاسترجاع. شغّل أسبوعياً:
   ```bash
   npx supabase db dump --data-only -f backups/$(date +%F).sql   # البيانات
   npx supabase db dump -f backups/schema-$(date +%F).sql         # المخطط
   ```
   واحفظها خارج GitHub (مثلاً تخزين سحابي خاص). في الخطة المدفوعة فعّل Point-in-Time Recovery.

## 2) ربط التطبيق

```bash
cd app
cp .env.example .env              # للتطوير المحلي فقط (لا يُرفع إلى GitHub)
# EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
# EXPO_PUBLIC_SUPABASE_KEY=<Publishable key>
npm install
npx expo start                     # امسح QR بتطبيق Expo Go
```

لإتاحة القيم لبناءات EAS:
```bash
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_KEY --value <publishable-key> --visibility plaintext
# كرر لـ preview و development
```
> مفتاح Publishable/anon مصمم ليكون داخل التطبيق؛ كل الصلاحيات محمية بـ Row Level Security. **لا تستخدم مفتاح service_role في التطبيق أبداً.**

## 3) رابط Expo Go + QR (للتجربة المباشرة)

```bash
cd app
npx eas-cli update --channel preview --environment preview --message "FIKRA SELL preview"
```
يطبع الأمر رابط صفحة التحديث على expo.dev وفيها QR يفتح في Expo Go على الآيفون والأندرويد.

ما لا يعمل داخل Expo Go: الإشعارات الفورية على أندرويد (قيود Expo Go منذ SDK 53). كل الوظائف الأخرى تعمل، والإشعارات داخل التطبيق تعمل دائماً.

## 4) Development Build (يدعم الإشعارات الفورية)

```bash
npx eas-cli build --profile development --platform android   # APK للتثبيت المباشر
npx eas-cli build --profile development --platform ios       # يتطلب تسجيل أجهزة: eas device:create
```

## 5) iOS — TestFlight ثم App Store

1. في App Store Connect أنشئ تطبيقاً جديداً: الاسم **FIKRA SELL** (أو «سيـ فكرة ـل»)، Bundle ID `com.fikrasell.app`، SKU `fikra-sell`.
2. أنشئ App Store Connect API Key (Users and Access → Integrations → Keys، صلاحية App Manager) واحفظ ملف `.p8` خارج المستودع.
3. ```bash
   npx eas-cli credentials        # اختر iOS ← production ← أضف ASC API Key؛ EAS يُنشئ الشهادات تلقائياً
   npx eas-cli build --profile production --platform ios
   npx eas-cli submit --platform ios --latest
   ```
4. في TestFlight: أضف المختبِرين الداخليين ثم اختبر حسب «قائمة الاختبار اليدوي» في `docs/TEST_REPORT.md`.
5. أكمل بيانات المتجر من `docs/STORE.md` (الوصف، الكلمات المفتاحية، App Privacy، حساب المراجعة) ثم «Submit for Review».

## 6) Android — AAB ثم Google Play

```bash
npx eas-cli build --profile production --platform android     # ينتج .aab ويولّد مفتاح التوقيع ويحفظه في EAS
```
1. Play Console → Create app → اسم FIKRA SELL، الحزمة `com.fikrasell.app`.
2. ارفع أول AAB يدوياً إلى Internal testing (مطلوب لأول مرة).
3. أنشئ Service Account بصلاحية الإصدار واحفظ JSON خارج المستودع، ثم لاحقاً: `npx eas-cli submit --platform android --latest`.
4. أكمل Data safety وContent rating وTarget audience من `docs/STORE.md`.

## 7) لوحة الإدارة

```bash
cd admin
cp .env.example .env    # VITE_SUPABASE_URL / VITE_SUPABASE_KEY (Publishable key فقط)
npm install && npm run build      # الناتج في admin/dist (موقع ثابت)
```
انشره على أي استضافة ثابتة تدعم HTTPS (EAS Hosting، Netlify، Cloudflare Pages، Vercel). اللوحة لا تحمل أي مفتاح سري؛ الدخول يتطلب حساباً بدور `moderator/admin/owner`، وكل عملية تتحقق منها قاعدة البيانات.

## 8) استبدال الشعار المؤقت بالشعار الأصلي

```bash
cp /path/to/original-fikra-logo.png brand/source/fikra-logo.png
cd app && npm run brand
```
يستخرج الأمر الألوان الدقيقة من بكسلات الشعار، ويحدّث `brand.generated.ts` للتطبيق واللوحة، ويعيد توليد أيقونة 1024×1024 والأيقونة التكيفية وشاشة البداية وأيقونة الإشعارات وملفات الهوية. ثم أعد البناء/التحديث.
