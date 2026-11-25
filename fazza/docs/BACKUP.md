# النسخ الاحتياطي والاستعادة

| الطبقة | الآلية |
|---|---|
| قاعدة البيانات (Supabase Pro) | نسخ يومي تلقائي + Point‑in‑Time Recovery (يُفعَّل من Database → Backups) |
| نسخ مستقل مشفّر | `scripts/backup/backup.sh` (أدوار + مخطط + بيانات تشمل حسابات Auth وبيانات Storage الوصفية) مشفّر AES‑256 (`openssl -pbkdf2`) — يعمل ليلياً عبر `.github/workflows/fazza-backup.yml` |
| ملفات التخزين (صور، مستندات، إيصالات) | نسخ دوري عبر S3‑compatible endpoint الخاص بـ Supabase Storage باستخدام rclone: `rclone sync supabase:driver-docs backup:fazza/driver-docs` (وكذلك receipts و order-files و avatars) إلى حاوية خاصة مشفّرة |

## الاستعادة
```bash
# 1) مشروع جديد أو قاعدة فارغة: طبّق المخطط
supabase link --project-ref <NEW_REF> && supabase db push
# 2) البيانات
CONFIRM=yes BACKUP_PASSPHRASE='...' SUPABASE_DB_URL='postgresql://...' ./scripts/backup/restore.sh backups/<STAMP>.tar.enc
# 3) الملفات: rclone sync backup:fazza/<bucket> newsupabase:<bucket>
```
سكربت الاستعادة يتحقق من SHA‑256، ويعطّل المشغلات أثناء التحميل (`session_replication_role = replica`) لأن بين الجداول مراجع دائرية، ويرفض العمل بدون `CONFIRM=yes`.

## تمرين التعافي (مُختبر)
`npm run test:backup` في `tests/`: ينشئ نسخة مشفّرة ← يمسح القاعدة بالكامل ← يستعيد ← يتحقق من تطابق أعداد الصفوف في 10 جداول، ومن اتساق أرصدة المناديب مع السجل المالي، ومن قدرة المستخدم على تسجيل الدخول بكلمة مروره الأصلية. **النتيجة: ناجح.**
