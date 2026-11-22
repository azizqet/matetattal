-- ✅ بموافقة المالك (2026-11-22): إغلاق ثغرة جدول الإعلانات القديم listings.
-- كان أي شخص (حتى بدون حساب) يقدر ينشر إعلاناً يظهر فوراً عبر create_listing بدون موافقة.
-- لا يستخدمه التطبيق ولا الموقع الحالي. لا حذف لأي بيانات (5 إعلانات تجريبية باقية).
-- اختُبر قبل التطبيق داخل معاملة أُلغيت (8 فحوص). للتراجع: grant execute ... to anon, authenticated.
revoke execute on function public.create_listing(text,text,numeric,text,text,text,text,integer,integer,text,text[],boolean) from public, anon, authenticated;
revoke execute on function public.bump_listing(bigint,text) from public, anon, authenticated;
revoke execute on function public.delete_listing(bigint,text) from public, anon, authenticated;
revoke execute on function public.report_listing(bigint,text) from public, anon, authenticated;
revoke execute on function public.track_listing(bigint,text) from public, anon, authenticated;
