/** Server error codes (raised as "FZ_*") and their user-facing messages. */
export const ERROR_MESSAGES: Record<string, { ar: string; en: string }> = {
  FZ_BAD_REQUEST: { ar: "طلب غير صالح", en: "Invalid request" },
  FZ_SERVER_ERROR: { ar: "حدث خطأ في الخادم، حاول لاحقاً", en: "Server error, please try again" },
  FZ_NETWORK: { ar: "تعذّر الاتصال بالإنترنت", en: "No internet connection" },
  FZ_RATE_LIMITED: { ar: "محاولات كثيرة، انتظر قليلاً ثم حاول مجدداً", en: "Too many attempts, please wait and retry" },
  FZ_INVALID_NAME: { ar: "الاسم غير صالح", en: "Invalid name" },
  FZ_INVALID_PHONE: { ar: "رقم الهاتف الكويتي غير صحيح", en: "Invalid Kuwaiti phone number" },
  FZ_WEAK_PASSWORD: { ar: "كلمة المرور 8 أحرف على الأقل وتحتوي حروفاً وأرقاماً", en: "Password must be 8+ characters with letters and numbers" },
  FZ_TERMS_REQUIRED: { ar: "يجب الموافقة على الشروط والأحكام", en: "You must accept the terms" },
  FZ_PHONE_TAKEN: { ar: "رقم الهاتف مسجّل مسبقاً", en: "This phone number is already registered" },
  FZ_INVALID_CREDENTIALS: { ar: "رقم الهاتف أو كلمة المرور غير صحيحة", en: "Wrong phone number or password" },
  FZ_LOGIN_LOCKED: { ar: "تم إيقاف تسجيل الدخول مؤقتاً بسبب محاولات خاطئة متكررة (15 دقيقة)", en: "Login temporarily locked after repeated failures (15 min)" },
  FZ_ACCOUNT_SUSPENDED: { ar: "الحساب موقوف. تواصل مع الدعم الفني", en: "Account suspended. Please contact support" },
  FZ_NOT_AUTHENTICATED: { ar: "يرجى تسجيل الدخول", en: "Please sign in" },
  FZ_FORBIDDEN: { ar: "غير مسموح", en: "Not allowed" },
  FZ_NOT_FOUND: { ar: "غير موجود", en: "Not found" },
  FZ_MAINTENANCE: { ar: "التطبيق في صيانة حالياً", en: "The app is under maintenance" },
  FZ_NOT_DRIVER: { ar: "سجّل كمندوب أولاً", en: "Register as a driver first" },
  FZ_DRIVER_EXISTS: { ar: "لديك طلب تسجيل مندوب قائم", en: "You already have a driver application" },
  FZ_INVALID_PLATE: { ar: "رقم اللوحة غير صالح", en: "Invalid plate number" },
  FZ_PLATE_TAKEN: { ar: "رقم اللوحة مسجّل لمندوب آخر", en: "Plate number already registered" },
  FZ_MISSING_DOCUMENTS: { ar: "يرجى رفع جميع المستندات المطلوبة", en: "Please upload all required documents" },
  FZ_INVALID_DOCUMENTS: { ar: "المستندات غير صالحة", en: "Invalid documents" },
  FZ_INVALID_DOCUMENT_PATH: { ar: "ملف غير صالح", en: "Invalid file" },
  FZ_INVALID_IMAGE_PATH: { ar: "صورة غير صالحة", en: "Invalid image" },
  FZ_INVALID_ORDER: { ar: "بيانات الطلب غير صالحة", en: "Invalid order data" },
  FZ_INVALID_LOCATION: { ar: "الموقع غير صالح", en: "Invalid location" },
  FZ_TOO_MANY_OPEN_ORDERS: { ar: "لديك عدد كبير من الطلبات المفتوحة", en: "You have too many open orders" },
  FZ_NOT_APPROVED_DRIVER: { ar: "حساب المندوب غير مفعّل بعد", en: "Driver account not approved yet" },
  FZ_DRIVER_OFFLINE: { ar: "فعّل وضع متصل أولاً", en: "Go online first" },
  FZ_INVALID_PRICE: { ar: "السعر غير صالح", en: "Invalid price" },
  FZ_INVALID_ETA: { ar: "الوقت المتوقع غير صالح", en: "Invalid ETA" },
  FZ_OWN_ORDER: { ar: "لا يمكنك تقديم عرض على طلبك", en: "You can't offer on your own order" },
  FZ_ORDER_NOT_OPEN: { ar: "الطلب لم يعد متاحاً", en: "This order is no longer available" },
  FZ_ORDER_EXPIRED: { ar: "انتهت مهلة الطلب", en: "This order has expired" },
  FZ_TOO_MANY_ACTIVE: { ar: "وصلت للحد الأقصى من الطلبات النشطة", en: "You reached the max active orders" },
  FZ_OFFER_NOT_PENDING: { ar: "العرض لم يعد متاحاً", en: "This offer is no longer available" },
  FZ_DRIVER_UNAVAILABLE: { ar: "المندوب غير متاح حالياً، اختر عرضاً آخر", en: "Driver unavailable, choose another offer" },
  FZ_INVALID_TRANSITION: { ar: "لا يمكن تغيير الحالة الآن", en: "Status can't be changed now" },
  FZ_PROOF_REQUIRED: { ar: "يرجى تصوير إثبات الاستلام/التسليم", en: "Please take a proof photo" },
  FZ_REASON_REQUIRED: { ar: "يرجى كتابة السبب", en: "Please write a reason" },
  FZ_CANCEL_NOT_ALLOWED: { ar: "لا يمكن الإلغاء بعد الاستلام. تواصل مع الدعم", en: "Can't cancel after pickup. Contact support" },
  FZ_NOT_COMPLETED: { ar: "الطلب غير مكتمل", en: "Order not completed" },
  FZ_RATING_WINDOW_CLOSED: { ar: "انتهت مدة التقييم", en: "Rating period has ended" },
  FZ_INVALID_RATING: { ar: "تقييم غير صالح", en: "Invalid rating" },
  FZ_ALREADY_RATED: { ar: "تم التقييم مسبقاً", en: "Already rated" },
  FZ_INVALID_AMOUNT: { ar: "المبلغ غير صالح", en: "Invalid amount" },
  FZ_ALREADY_ACTIVATED: { ar: "الحساب مفعّل مسبقاً", en: "Already activated" },
  FZ_TOO_MANY_PENDING: { ar: "لديك إيصالات قيد المراجعة", en: "You have receipts under review" },
  FZ_PROMO_INVALID: { ar: "كود الخصم غير صالح", en: "Invalid promo code" },
  FZ_PROMO_USED: { ar: "استخدمت هذا الكود مسبقاً", en: "Promo code already used" },
  FZ_INVALID_TICKET: { ar: "طلب غير صالح", en: "Invalid request" },
  FZ_ACTIVE_ORDERS: { ar: "لا يمكن حذف الحساب أثناء وجود طلبات نشطة", en: "Can't delete the account while orders are active" },
  FZ_ALREADY_REVIEWED: { ar: "تمت المراجعة مسبقاً", en: "Already reviewed" },
  FZ_INVALID_DECISION: { ar: "إجراء غير صالح", en: "Invalid action" },
  FZ_INVALID_RANGE: { ar: "الفترة غير صالحة", en: "Invalid date range" },
  FZ_ACCOUNT_DELETED: { ar: "تم حذف الحساب", en: "Account deleted" },
  "FZ_CANNOT_RECEIVE:pending_review": { ar: "حسابك قيد المراجعة من الإدارة", en: "Your account is under review" },
  "FZ_CANNOT_RECEIVE:rejected": { ar: "تم رفض طلب التسجيل", en: "Your application was rejected" },
  "FZ_CANNOT_RECEIVE:driver_suspended": { ar: "حساب المندوب موقوف", en: "Driver account suspended" },
  "FZ_CANNOT_RECEIVE:activation_unpaid": { ar: "ادفع رسوم التفعيل وارفع الإيصال", en: "Pay the activation fee and upload the receipt" },
  "FZ_CANNOT_RECEIVE:debt_limit": { ar: "بلغت العمولات المستحقة الحد المسموح. سدّد لإعادة التفعيل", en: "Unpaid commissions reached the limit. Pay to resume" },
  "FZ_CANNOT_RECEIVE:account_suspended": { ar: "الحساب موقوف", en: "Account suspended" },
};

/** Extracts the FZ code from a Postgres/Edge error message. */
export function extractErrorCode(message: string | undefined | null): string {
  if (!message) return "FZ_SERVER_ERROR";
  const m = message.match(/FZ_[A-Z_]+(?::[a-z_]+)?/);
  if (m) return m[0];
  if (/network|fetch|timed? ?out|Failed to fetch/i.test(message)) return "FZ_NETWORK";
  return "FZ_SERVER_ERROR";
}

export function errorMessage(codeOrMessage: string, locale: "ar" | "en"): string {
  const code = codeOrMessage.startsWith("FZ_") ? codeOrMessage : extractErrorCode(codeOrMessage);
  return ERROR_MESSAGES[code]?.[locale] ?? ERROR_MESSAGES.FZ_SERVER_ERROR[locale];
}
