# ملاحظات لمراجعي App Store / Google Play (تُلصق في خانة Review Notes)

**English (paste into App Review Information):**
FAZZA is a marketplace that connects customers with independent delivery drivers in Kuwait. Drivers propose a delivery price; customers accept an offer. The delivery fee is paid by the customer directly to the driver (cash) for a physical service performed outside the app — no digital goods are sold.

Demo accounts (Kuwait phone numbers, sign in with phone + password — no SMS/OTP is used):
- Customer: +965 XXXX XXXX / password: ********
- Driver (approved & activated): +965 XXXX XXXX / password: ********

How to test the full flow with one device: sign in as the customer → "New delivery" → choose pickup and drop-off (search an area, e.g. "Salmiya") → send. Sign out, sign in as the driver → Requests → open the order → send an offer. Sign back in as the customer → the offer appears → Accept → chat/track. You can also switch roles from Account → "Switch to driver mode".

Account deletion: Account → Delete account (permanent, in-app). Location is requested only while using the app (no background location).
Drivers' one-time activation fee and commissions relate to the driver's use of the platform for physical delivery services and are collected outside the app by bank transfer and manually verified by our staff.

**ملاحظة داخلية:** أنشئ الحسابين بالسكربت `scripts/admin/create-reviewer-accounts.mjs` على الخادم الإنتاجي، واكتب الأرقام وكلمة المرور هنا قبل الإرسال، وأوقف الحسابين من لوحة التحكم بعد الاعتماد إن رغبت.
