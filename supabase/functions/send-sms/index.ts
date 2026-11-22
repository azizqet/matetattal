// Supabase Auth «Send SMS Hook» → بوابة kwtsms.com الكويتية (رسالة OTP حقيقية).
// ⚠️ غير منشورة. تُنشر فقط بعد موافقة المالك وتجهيز حساب kwtsms واسم مرسل (Sender ID) معتمد.
//
// الأسرار (تُضبط من لوحة Supabase ← Edge Functions ← Secrets، ولا تُكتب في الكود أبداً):
//   SEND_SMS_HOOK_SECRET  : يولّده Supabase عند تفعيل الـ Hook (صيغة v1,whsec_...)
//   KWTSMS_USERNAME / KWTSMS_PASSWORD : بيانات API من صفحة «API» في حساب kwtsms (ليست بيانات الدخول)
//   KWTSMS_SENDER         : اسم المرسل المعتمد (Transactional) كما هو حرفياً
//   KWTSMS_TEST           : "1" = وضع تجربة (لا تُرسل الرسالة فعلياً)، "0" = إرسال حقيقي. الافتراضي "1" للأمان.
//
// الحماية: التوقيع يُتحقق منه قبل أي شيء (لا يقدر أحد استدعاء الدالة لإرسال رسائل على حسابك)،
// ولا تُقبل إلا أرقام كويتية (965 + 8 أرقام)، ولا يُكتب الرمز في السجلات.
// حدود المحاولات: يضبطها Supabase Auth (Rate Limits) + مهلة 60 ثانية في التطبيق + kwtsms يرفض تكرار نفس الرقم بسرعة (ERR028).
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const KW_MOBILE = /^965[569]\d{7}$/;

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'method not allowed');
  const secret = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
  const username = Deno.env.get('KWTSMS_USERNAME');
  const password = Deno.env.get('KWTSMS_PASSWORD');
  const sender = Deno.env.get('KWTSMS_SENDER');
  const test = Deno.env.get('KWTSMS_TEST') === '0' ? '0' : '1';
  if (!secret || !username || !password || !sender) return fail(500, 'sms hook not configured');

  const raw = await req.text();
  let payload: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    payload = new Webhook(secret).verify(raw, Object.fromEntries(req.headers)) as typeof payload;
  } catch {
    return fail(401, 'invalid signature');
  }

  const mobile = String(payload.user?.phone ?? '').replace(/\D/g, '').replace(/^00/, '');
  const otp = String(payload.sms?.otp ?? '');
  if (!KW_MOBILE.test(mobile)) return fail(400, 'only Kuwaiti mobile numbers are supported');
  if (!/^\d{4,10}$/.test(otp)) return fail(400, 'invalid otp');

  const res = await fetch('https://www.kwtsms.com/API/send/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      username, password, sender, mobile, test,
      message: `رمز التحقق في تطبيق ماتعطل: ${otp}\nلا تشارك الرمز مع أحد.`,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (body?.result !== 'OK') {
    // لا نسجّل الرمز ولا الرقم كاملاً
    console.error('kwtsms send failed', body?.code ?? res.status, body?.description ?? '', mobile.slice(0, 5) + '***');
    return fail(502, 'sms provider error ' + (body?.code ?? res.status));
  }
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
