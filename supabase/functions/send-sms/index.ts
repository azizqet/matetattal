// Supabase Auth «Send SMS Hook» ← بوابة kwtsms.com الكويتية: إرسال رمز OTP حقيقي إلى أرقام الكويت (+965).
// الأسرار تُضبط من لوحة Supabase ← Edge Functions ← Secrets (لا تُكتب في الكود ولا في التطبيق أبداً):
//   SEND_SMS_HOOK_SECRET  : يولّده Supabase عند تفعيل الـ Hook (صيغة v1,whsec_...)
//   KWTSMS_USERNAME / KWTSMS_PASSWORD : بيانات API من صفحة «API» في حساب kwtsms (ليست بيانات دخول الموقع)
//   KWTSMS_SENDER         : اسم المرسل المعتمد (Transactional) حرفياً
//   KWTSMS_TEST           : "1" = وضع تجربة (لا تُرسل الرسالة)، "0" = إرسال حقيقي. الافتراضي "1" للأمان.
//
// الحماية:
//   • التحقق من توقيع Supabase قبل أي شيء → لا أحد غيره يقدر يستخدم الدالة لإرسال رسائل على حسابك.
//   • أرقام الجوال الكويتية فقط (965 + 5/6/9 + 7 أرقام)، والرمز لا يُكتب في السجلات.
//   • حدود الإرسال والتحقق يطبقها Supabase Auth (60 ثانية بين الرسائل لنفس الرقم، حد للرسائل بالساعة،
//     حد لمحاولات التحقق، وانتهاء صلاحية الرمز)، و kwtsms يرفض تكرار نفس الرقم بسرعة (ERR028).
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

  let res: Response;
  try {
    res = await fetch('https://www.kwtsms.com/API/send/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        username, password, sender, mobile, test,
        // رسالة قصيرة (أقل من 70 حرفاً عربياً = رسالة واحدة)
        message: `رمز التحقق في ماتعطل: ${otp}\nلا تشاركه مع أحد`,
      }),
    });
  } catch {
    return fail(502, 'sms provider unreachable');
  }
  const body = await res.json().catch(() => ({}));
  if (body?.result !== 'OK') {
    console.error('kwtsms send failed', body?.code ?? res.status, body?.description ?? '', mobile.slice(0, 5) + '***');
    return fail(502, 'sms provider error ' + (body?.code ?? res.status));
  }
  console.log('kwtsms sent', mobile.slice(0, 5) + '***', 'test=' + test, 'balance=' + (body['balance-after'] ?? '?'));
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
