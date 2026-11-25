# فزّاع | FAZZA

منصة توصيل كويتية تربط العملاء بالمناديب: العميل ينشئ الطلب، والمناديب يرسلون عروض أسعار، والعميل يختار. التطبيق لا يحدد سعر التوصيل.

| الجزء | المسار | التقنية |
|---|---|---|
| تطبيق الجوال (عميل + مندوب في حساب واحد) | `apps/mobile` | Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router |
| لوحة تحكم المالك | `apps/admin` | Vite · React 19 · TypeScript |
| الموقع العام (الخصوصية، الشروط، طلب حذف الحساب) | `apps/site` + `scripts/site/build.mjs` | HTML ثابت |
| الخادم وقاعدة البيانات | `supabase/` | Supabase (PostgreSQL 17, Auth, Realtime, Storage, Edge Functions, pg_cron) |
| منطق مشترك (الفلس، الهاتف، الأخطاء) | `packages/shared` | TypeScript بدون اعتماديات |
| الاختبارات | `tests/` | Vitest · Playwright · Postgres |
| أصول المتجر | `store/` | أيقونات، صور المتجر، صورة Google Play |

## التشغيل محلياً (5 دقائق)

```bash
cd fazza
supabase start                              # Docker مطلوب
cp supabase/functions/.env.example supabase/functions/.env
supabase db reset                           # يطبق كل الـ migrations
cd apps/mobile && npm ci && cp .env.example .env.local   # ضع URL و ANON KEY المحليين
npx expo start
cd ../admin && npm ci && cp .env.example .env.local && npm run dev
cd ../../tests && npm ci && npm test        # unit + backend + E2E
```

## المستندات
- [دليل الإعداد والنشر](docs/SETUP.md)
- [تقرير الاختبارات](docs/TEST_REPORT.md)
- [الأمان](docs/SECURITY.md)
- [النسخ الاحتياطي والاستعادة](docs/BACKUP.md)
- [قائمة المتطلبات المتبقية قبل النشر](docs/RELEASE_CHECKLIST.md)
- [بيانات المتجر](store/STORE_LISTING.md) · [خصوصية التطبيق و Data Safety](store/PRIVACY_DATA_SAFETY.md) · [ملاحظات المراجعين](store/REVIEW_NOTES.md)
- [مسودات الشروط والخصوصية](docs/legal/)

## المبادئ المعمارية
- **كل قاعدة عمل تُنفَّذ في الخادم**: إنشاء الطلب، العروض، القبول، تغيير الحالات، العمولة، حد المديونية، الإيصالات — دوال PostgreSQL بصلاحية `SECURITY DEFINER` مع تحقق صريح من المستخدم. العميل لا يملك صلاحية كتابة مباشرة على الطلبات أو الأرصدة.
- **RLS على كل الجداول** + قائمة سماح صريحة للدوال (`20261125000800_function_lockdown.sql`).
- **المال بالفلس** (أعداد صحيحة) والعمولة بالنقاط الأساسية `bps` مع تقريب نصف للأعلى؛ سجل مالي append-only مع قيد فريد يمنع تكرار عمولة الطلب.
- **التزامن**: قبول العرض يقفل صف الطلب وصف المندوب (`FOR UPDATE`) + فهرس فريد لعرض مقبول واحد لكل طلب.
- **بدون OTP/SMS**: التسجيل عبر Edge Function تستخدم Auth Admin API الرسمي؛ رقم الهاتف «غير موثّق» في `profiles.phone_verified` حتى يوثقه الفريق يدوياً. خطاف `send_sms` يرفض أي OTP، وخطاف `password_verification_attempt` يقفل الحساب بعد 5 محاولات فاشلة.
