# App Privacy (Apple) و Data Safety (Google Play)

لا تتبّع (No tracking)، لا إعلانات، لا بيع بيانات. جميع البيانات مشفّرة أثناء النقل (TLS). يمكن طلب الحذف داخل التطبيق ومن الرابط الخارجي.

| نوع البيانات | Apple category | Google category | الغرض | مرتبط بالهوية | اختياري |
|---|---|---|---|---|---|
| الاسم | Contact Info → Name | Personal info → Name | App functionality | نعم | لا |
| رقم الهاتف | Contact Info → Phone Number | Personal info → Phone number | App functionality, Account management | نعم | لا |
| الموقع الدقيق (أثناء الاستخدام فقط) | Location → Precise Location | Location → Precise location | App functionality | نعم | نعم (يمكن اختيار الموقع يدوياً من البحث) |
| الصور (طلبات، إثبات، إيصالات) | User Content → Photos or Videos | Photos and videos → Photos | App functionality | نعم | نعم للعميل / مطلوبة للمندوب |
| مستندات المندوب (بطاقة مدنية، رخصة، دفتر مركبة) | Sensitive Info / Other User Content | Personal info → Other info (Government ID) | Account verification (fraud prevention) | نعم | مطلوبة للمناديب فقط |
| الرسائل داخل التطبيق | User Content → Other User Content | Messages → Other in-app messages | App functionality | نعم | نعم |
| التقييمات والبلاغات والدعم | User Content → Customer Support / Other | App activity → Other user-generated content | App functionality, Customer support | نعم | نعم |
| بيانات مالية للمندوب (عمولات، إيصالات) | Financial Info → Other Financial Info | Financial info → Purchase history / Other | App functionality | نعم | مطلوبة للمناديب |
| رمز الإشعارات للجهاز | Identifiers → Device ID | Device or other IDs | App functionality | نعم | نعم (عند السماح بالإشعارات) |
| سجلات أمنية (محاولات الدخول) | Diagnostics → Other | App info and performance → Other | Security, fraud prevention | نعم | لا |

**Google Data Safety — أسئلة عامة**
- Is all collected data encrypted in transit? **Yes**
- Do you provide a way for users to request that their data is deleted? **Yes** (in-app + `https://<site>/delete-account.html`)
- Data shared with third parties: **No** (service providers acting on our behalf — Supabase, Expo/APNs/FCM, Google/Apple Maps — are not "sharing" under Play's definition). Between users: customer ↔ driver name/phone/location after offer acceptance (core functionality, disclosed in the privacy policy).
- Background location: **not collected**.

**صلاحيات الجهاز وسبب طلبها (تُطلب عند الحاجة فقط)**
- الموقع (While Using): عند اختيار عنوان أو عرض الطلبات القريبة أو أثناء الطلب النشط للمندوب. لا يوجد موقع في الخلفية (`ACCESS_BACKGROUND_LOCATION` محجوب صراحة).
- الكاميرا: عند تصوير الطلب/المستند/الإثبات/الإيصال.
- الصور: عند اختيار صورة من المعرض.
- الإشعارات: بعد تسجيل الدخول لإشعارات العروض والحالة والمحادثة.
- الميكروفون وجهات الاتصال ونافذة النظام: **محجوبة**.
