// Supabase Auth «Send SMS Hook» ← بوابة kwtsms.com الكويتية: إرسال رمز OTP حقيقي إلى أرقام الكويت (+965).
// Supabase Auth يولّد الرمز ويتحقق منه وينهي صلاحيته؛ هذه الدالة ترسله فقط. لا رموز ثابتة أو وهمية.
//
// الأسرار تُضبط من لوحة Supabase ← Edge Functions ← Secrets (لا تُكتب في الكود ولا في التطبيق ولا GitHub أبداً):
//   SEND_SMS_HOOK_SECRET  : يولّده Supabase عند تفعيل الـ Hook (صيغة v1,whsec_...)
//   KWTSMS_USERNAME / KWTSMS_PASSWORD : بيانات API من صفحة «API» في حساب kwtsms (ليست بيانات دخول الموقع)
//   KWTSMS_SENDER         : اسم المرسل المعتمد حرفياً (حساس لحالة الأحرف). KWT-SMS للتجربة فقط.
//   KWTSMS_TEST           : "1" = وضع تجربة (الرسالة تدخل الطابور ولا تُرسل)، "0" = إرسال حقيقي. الافتراضي "1".
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY : متوفرة تلقائياً في Edge Functions (لحدود الإرسال لكل رقم).
//
// API kwtSMS (التوثيق الرسمي v4.1: https://www.kwtsms.com/api-documentation.html):
//   POST https://www.kwtsms.com/API/send/  ·  Content-Type: application/json
//   {username, password, sender, mobile: "965XXXXXXXX" (أرقام فقط، بدون + أو 00), message, test}
//   اللغة تُكتشف تلقائياً (العربي UCS-2: 70 حرفاً للرسالة الواحدة).
//   نجاح: {"result":"OK","msg-id":…,"balance-after":…} · خطأ: {"result":"ERROR","code":"ERRxxx","description":…}
//
// الحماية:
//   • التحقق من توقيع Supabase (Standard Webhooks) قبل أي شيء → لا أحد غيره يقدر يرسل رسائل على حسابك.
//   • أرقام الجوال الكويتية فقط (965 + 5/6/9 + 7 أرقام)، والرمز لا يُكتب في السجلات أبداً.
//   • حدود لكل رقم في قاعدة البيانات (sms_hook_reserve): رسالة كل 55 ثانية، 5 بالساعة، 10 باليوم.
//     فوقها حدود Supabase Auth: 60 ثانية بين الطلبات لنفس المستخدم، وحد المشروع بالساعة، وحد محاولات التحقق.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const KW_MOBILE = /^965[569]\d{7}$/;

// رسائل تظهر للمستخدم (Supabase يمررها للتطبيق كخطأ)
const LIMIT_MSG: Record<string, string> = {
  cooldown: 'you can only request this after 60 seconds',
  hourly: 'sms rate limit: too many codes for this number this hour',
  daily: 'sms rate limit: too many codes for this number today',
};
// أخطاء kwtSMS التي تعني أن الإعداد يحتاج تدخّل المالك (تُسجَّل بوضوح في سجلات الدالة)
const KWT_HINT: Record<string, string> = {
  ERR001: 'API off on this kwtSMS account', ERR003: 'wrong API username/password (or API access not approved yet)',
  ERR004: 'account has no API access', ERR005: 'account blocked', ERR008: 'sender id banned',
  ERR010: 'balance is zero', ERR011: 'not enough balance', ERR024: 'API lockdown: IP not allowed',
  ERR025: 'invalid number', ERR026: 'no route for this country', ERR028: 'same number too soon',
};

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
const masked = (m: string) => m.slice(0, 5) + '***';

async function reserve(mobile: string): Promise<string | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('limits unavailable');
  const res = await fetch(`${url}/rest/v1/rpc/sms_hook_reserve`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_phone: mobile }),
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) throw new Error('limits check failed ' + res.status);
  return (await res.json()) as string | null;
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

  // حدود لكل رقم (تفشل مغلقة: إذا تعذّر الفحص لا تُرسل رسالة)
  try {
    const blocked = await reserve(mobile);
    if (blocked) {
      console.warn('sms limited', masked(mobile), blocked);
      return fail(429, LIMIT_MSG[blocked] ?? 'sms rate limit');
    }
  } catch (e) {
    console.error('sms limits check error', String(e));
    return fail(503, 'sms provider error limits');
  }

  let res: Response;
  try {
    res = await fetch('https://www.kwtsms.com/API/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        username, password, sender, mobile, test,
        // اسم التطبيق في الرسالة (متطلب شركات الاتصالات لرسائل OTP)، وأقل من 70 حرفاً = رسالة واحدة
        message: `رمز التحقق في ماتعطل: ${otp}\nلا تشاركه مع أحد`,
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return fail(502, 'sms provider unreachable');
  }
  const body = await res.json().catch(() => ({}));
  if (body?.result !== 'OK') {
    const code = String(body?.code ?? res.status);
    console.error('kwtsms send failed', code, KWT_HINT[code] ?? body?.description ?? '', masked(mobile));
    return fail(502, 'sms provider error ' + code);
  }
  console.log('kwtsms sent', masked(mobile), 'test=' + test, 'balance=' + (body['balance-after'] ?? '?'));
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
