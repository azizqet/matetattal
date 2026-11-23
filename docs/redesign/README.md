# ماتعطل v4: إعادة التصميم

> **الحالة:** منشورة على الصفحة الرئيسية https://mat3tl.com (تمت الموافقة من المالك). النسخة السابقة محفوظة في `backup/index-live-2026-11-23.html`.

## مكان الملفات

| المسار | الوصف |
|---|---|
| `preview/index.html` | تطبيق العملاء الجديد (SPA بتوجيه `#/`، يعمل على GitHub Pages بدون إعداد) |
| `preview/admin.html` | لوحة الإدارة، منفصلة ومحمية (الصلاحية يتحقق منها الخادم) |
| `preview/js/core.js` | الاتصال بالخادم، الحسابات، الأيقونات، عناصر الواجهة |
| `preview/js/app.js` · `preview/js/admin.js` | منطق التطبيق ولوحة الإدارة |
| `preview/css/app.css` · `preview/css/admin.css` | نظام التصميم |
| `preview/manifest.webmanifest` · `preview/sw.js` · `preview/icons/` | ملفات PWA |
| `backup/index-live-2026-11-23.html` | نسخة مطابقة للموقع المنشور وقت البدء |
| `docs/redesign/screens/` | صور الواجهات |

لا يحتاج المشروع أي build. كل الملفات ثابتة.

## تغييرات قاعدة البيانات (Supabase، كلها إضافات فقط)

| Migration | المحتوى |
|---|---|
| `backup_20261123_redesign_snapshot` | نسخة احتياطية كاملة للجداول والسياسات والدوال في schema `backup_20261123_redesign` |
| `redesign_v4_accounts_ads_stats` | `register_account` للتسجيل بالهاتف وكلمة السر بدون OTP، جدول `ad_campaigns` مع الحماية والسياسات، `live_ads`، `track_ad`، `track_event`، جدول `site_stats_daily`، عمود `companies.featured_until`، إشعارات تغيير الحالة |
| `redesign_v4_guard_fix` | تصحيح ترتيب فحص الصلاحية في `guard_ad_campaign` |
| `ads_bucket_owner_select` | السماح للمالك والمدير بقراءة ملفاته في bucket `ads`، وهذا شرط لحذفها |

لم يُحذف ولم يُعدَّل أي صف من البيانات الحالية. حسابات الاختبار وملفاته حُذفت بعد الاختبار.

## خطوات النشر (بعد موافقة المالك)

1. **معاينة حيّة بدون المساس بالرئيسية:** دمج الفرع في `main`. تظهر النسخة الجديدة على `https://mat3tl.com/preview/` والصفحة الرئيسية الحالية تبقى كما هي.
2. التجربة على الجوال: التسجيل، انضم الآن، أعلن معنا، ولوحة الإدارة `https://mat3tl.com/preview/admin.html` بحساب المالك.
3. **الاعتماد النهائي:** نقل محتوى `preview/` إلى جذر المستودع، أو تحويل `index.html` الجذر إلى `preview/`، مع إبقاء `CNAME` كما هو.
4. اختياري: تفعيل *Leaked password protection* من إعدادات Supabase Auth.
