// Builds the public static site (landing, privacy, terms, account deletion request) into apps/site/dist.
// Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/site/build.mjs
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = `${root}/apps/site/dist`;
mkdirSync(out, { recursive: true });
const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.SUPABASE_ANON_KEY ?? "";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function md(file) {
  const lines = readFileSync(`${root}/docs/legal/${file}`, "utf8").trim().split("\n");
  let html = `<h1>${esc(lines[0])}</h1>`;
  let inList = false;
  for (const l of lines.slice(1)) {
    const t = l.trim();
    if (!t) { if (inList) { html += "</ul>"; inList = false; } continue; }
    if (t.startsWith("- ")) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${esc(t.slice(2))}</li>`; continue; }
    if (inList) { html += "</ul>"; inList = false; }
    if (/^\d+\.\s/.test(t)) html += `<h2>${esc(t)}</h2>`;
    else if (t.startsWith("(")) html += `<p class="note">${esc(t)}</p>`;
    else html += `<p>${esc(t)}</p>`;
  }
  return html + (inList ? "</ul>" : "");
}

const css = `:root{--p:#1E46D8;--bg:#F5F7FF;--t:#0B1640;--m:#4D5A85}*{box-sizing:border-box}body{margin:0;font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;background:var(--bg);color:var(--t);line-height:1.8}
header{background:linear-gradient(135deg,#3466FF,#1E46D8,#0F2A99);color:#fff;padding:22px 16px}header .w{display:flex;gap:12px;align-items:center}header img{width:48px;height:48px;border-radius:14px}
header a{color:#fff;text-decoration:none}.w{max-width:860px;margin:0 auto;padding:0 16px}main .w{background:#fff;border-radius:20px;padding:24px;margin-top:-10px;box-shadow:0 10px 30px #0b1e6b14}
h1{font-size:24px}h2{font-size:18px;margin-top:22px}.note{color:#B54708;background:#FFF4E5;padding:8px 12px;border-radius:10px}nav{display:flex;gap:14px;flex-wrap:wrap;margin:16px auto}nav a{color:var(--p);font-weight:600}
input,textarea{font:inherit;width:100%;padding:12px;border:1.5px solid #E3E8F7;border-radius:12px;margin:6px 0 12px}button{font:inherit;font-weight:700;background:var(--p);color:#fff;border:0;border-radius:12px;padding:12px 20px;cursor:pointer}
.ok{background:#E3F8EE;color:#0E7A47;padding:12px;border-radius:12px}.err{background:#FFECEB;color:#B42318;padding:12px;border-radius:12px}footer{text-align:center;color:var(--m);padding:30px 16px;font-size:14px}`;

function page(file, title, lang, body) {
  writeFileSync(`${out}/${file}`, `<!doctype html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><link rel="icon" href="icon-192.png"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet"><style>${css}</style></head>
<body><header><div class="w"><a href="index.html"><img src="icon-192.png" alt=""></a><div><b style="font-size:22px">فزّاع · FAZZA</b><div style="opacity:.85">توصيل أسرع… بسعرك أنت</div></div></div></header>
<main><nav class="w"><a href="index.html">الرئيسية</a><a href="terms.html">الشروط</a><a href="privacy.html">الخصوصية</a><a href="terms-en.html">Terms</a><a href="privacy-en.html">Privacy</a><a href="delete-account.html">حذف الحساب / Delete account</a></nav>
<div class="w">${body}</div></main><footer>© FAZZA — Kuwait</footer></body></html>`);
}

page("index.html", "فزّاع FAZZA", "ar", `<h1>فزّاع — منصة توصيل كويتية</h1><p>اطلب توصيل أي شيء داخل الكويت، واستقبل عروض أسعار من المناديب القريبين، واختر الأنسب حسب السعر والتقييم ووقت الوصول.</p>
<p>FAZZA connects customers and independent drivers across Kuwait. Drivers send price offers; customers choose.</p>`);
page("terms.html", "الشروط والأحكام — فزّاع", "ar", md("terms_ar.md"));
page("terms-en.html", "Terms — FAZZA", "en", md("terms_en.md"));
page("privacy.html", "سياسة الخصوصية — فزّاع", "ar", md("privacy_ar.md"));
page("privacy-en.html", "Privacy Policy — FAZZA", "en", md("privacy_en.md"));
page("delete-account.html", "حذف الحساب — فزّاع", "ar", `<h1>طلب حذف الحساب · Account deletion request</h1>
<p>يمكنك حذف حسابك فوراً من داخل التطبيق: <b>حسابي ← حذف الحساب</b>. إذا لم تتمكن من الدخول، أرسل الطلب هنا وسيتواصل معك الدعم على رقمك المسجّل للتحقق من الهوية ثم يحذف الحساب.</p>
<p dir="ltr">You can delete your account instantly in the app: <b>Account → Delete account</b>. If you can't sign in, submit this form; support will call your registered number to verify your identity and delete the account.</p>
<p>يُحذف: الحساب، الاسم، الصور، مستندات المناديب، العناوين، رموز الإشعارات. يُحتفظ مجهّلاً: السجلات المالية وسجل الطلبات للالتزامات المحاسبية والقانونية.<br><span dir="ltr">Deleted: account, name, photos, driver documents, addresses, push tokens. Kept anonymised: financial and order records required by accounting/legal rules.</span></p>
<form id="f"><label>الاسم الكامل / Full name<input name="full_name" required minlength="2" maxlength="80"></label>
<label>رقم الهاتف المسجّل / Registered phone<input name="phone" required dir="ltr" placeholder="+965 5000 0000"></label>
<label>ملاحظة (اختياري) / Note (optional)<textarea name="note" maxlength="1000"></textarea></label><button>إرسال الطلب / Submit</button></form><div id="r"></div>
<script>document.getElementById("f").addEventListener("submit",async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const r=document.getElementById("r");
try{const res=await fetch(${JSON.stringify(URL)}+"/functions/v1/public-request",{method:"POST",headers:{"Content-Type":"application/json",apikey:${JSON.stringify(KEY)}},body:JSON.stringify({kind:"account_deletion",...d})});
const j=await res.json();if(res.ok){r.className="ok";r.textContent="تم استلام طلبك وسيتواصل معك الدعم. Request received — support will contact you.";e.target.reset();}else{r.className="err";r.textContent=j.error==="FZ_INVALID_PHONE"?"رقم الهاتف غير صحيح / Invalid phone":"تعذر الإرسال، حاول لاحقاً / Could not send, try later";}}
catch{r.className="err";r.textContent="تعذر الاتصال / Network error";}});</script>`);
copyFileSync(`${root}/apps/admin/public/icon-192.png`, `${out}/icon-192.png`);
console.log("site built ->", out);
