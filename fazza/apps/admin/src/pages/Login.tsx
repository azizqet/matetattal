import { useState, type FormEvent } from "react";
import { normalizeKwPhone } from "@fazza/shared";
import { Btn, Field } from "../components";
import { callFunction, errText } from "../lib/api";
import { setLang, tr, useLang } from "../lib/i18n";
import { supabase } from "../lib/supabase";

export default function Login({ denied, onSignOut }: { denied: boolean; onSignOut: () => void }) {
  const l = useLang();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const p = normalizeKwPhone(phone);
    if (!p) return setError(errText(new Error("FZ_INVALID_PHONE")));
    setBusy(true);
    try {
      const r = await callFunction<{ session: { access_token: string; refresh_token: string } }>("auth-login", { phone: p, password }, false);
      await supabase.auth.setSession(r.session);
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="row"><img src="/icon-192.png" alt="FAZZA" /><div><h2>فزّاع</h2><div style={{ color: "var(--muted)" }}>{tr("لوحة تحكم المالك", "Owner dashboard")}</div></div></div>
        {denied ? <div className="alert tone-danger">{tr("هذا الحساب لا يملك صلاحيات إدارية.", "This account has no admin permissions.")} <a href="#" onClick={onSignOut}>{tr("خروج", "Sign out")}</a></div> : null}
        <Field label={tr("رقم الهاتف", "Phone number")}><input id="phone" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+965 5000 0000" autoComplete="username" /></Field>
        <Field label={tr("كلمة المرور", "Password")}><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        {error ? <div className="alert tone-danger">{error}</div> : null}
        <Btn type="submit" busy={busy}>{tr("دخول", "Sign in")}</Btn>
        <div className="row end"><Btn small kind="ghost" onClick={() => setLang(l === "ar" ? "en" : "ar")}>{l === "ar" ? "English" : "العربية"}</Btn></div>
      </form>
    </div>
  );
}
