# بناء تطبيق «ماتعطل» لـ Android عبر EAS

## الإعدادات الحالية
| البند | القيمة |
|---|---|
| معرّف التطبيق (Android و iOS) | `com.matattal.app` (نهائي بعد أول رفع على Google Play) |
| اسم مشروع Expo (slug) | `matetattal` |
| إدارة رقم الإصدار (versionCode) | تلقائية على خوادم Expo (`appVersionSource: remote`) |
| مصدر بيانات التوقيع | خوادم Expo (`credentialsSource: remote`) |

### ملفات البناء (eas.json)
- **preview**: ملف APK للتجربة الداخلية، يُثبَّت مباشرة على أي جهاز Android. لا يُرفع للمتجر.
- **production**: ملف AAB الخاص بـ Google Play، ويزيد رقم الإصدار تلقائياً.

## مفتاح التوقيع (Keystore)
- **لا توجد مفاتيح أو كلمات مرور في المستودع، ولن تُنشأ محلياً.**
- عند أول بناء ينشئ Expo مفتاحاً عشوائياً آمناً على خوادمه ويحفظه في حسابك. كل البناءات التالية تستخدم المفتاح نفسه.
- ⚠️ **مهم جداً بعد أول بناء:** نزّل نسخة احتياطية من المفتاح وخزّنها في مكان آمن، لأن فقدانه يمنع تحديث التطبيق على Google Play مستقبلاً. حالياً التنزيل لا يتم إلا من الكمبيوتر بالأمر `eas credentials -p android` ثم «Download credentials»، لذلك استخدم كمبيوتر لهذه الخطوة عندما يتوفر.

## التشغيل من الآيفون (بدون كمبيوتر)
**المتطلب:** سر `EXPO_TOKEN` في المستودع، وهو نفس الرمز المستخدم في نسخة التجربة. الخطوات في `تجربة-التطبيق-من-الآيفون.md` (الخطوات 1–3).

1. افتح Pull Request رقم 1: https://github.com/azizqet/matetattal/pull/1
2. من **Labels** أضف وسماً اسمه `android-build` (أنشئه إذا لم يكن موجوداً).
3. يبدأ GitHub Actions الإعداد ويرسل البناء إلى Expo، وفي ملخص التشغيل يظهر رابط صفحة البناء.
4. بعد 10–20 دقيقة يجهز ملف APK في صفحة البناء على expo.dev، ومنها يمكن تثبيته على جهاز Android.

لإعادة البناء: أزل الوسم ثم أضفه مرة أخرى. بعد الدمج في main سيظهر زر **Run workflow** مع اختيار preview أو production.

## من الكمبيوتر (اختياري)
```bash
cd mobile
npm install
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build -p android --profile preview
```

## ما لا يحدث (حسب الطلب)
- لا رفع إلى Google Play ولا `eas submit`.
- لا نشر عام للتطبيق.
