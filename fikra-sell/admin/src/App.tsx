import type { Session } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';
import { can, configured, errMsg, MeContext, q, supabase, type Me, type Perm, type Role } from './lib';
import * as P from './pages';

type Route = { path: string; label: string; perm?: Perm; el: () => React.ReactElement };
const ROUTES: Route[] = [
  { path: 'dashboard', label: 'الإحصائيات', el: () => <P.Dashboard /> },
  { path: 'ads', label: 'الإعلانات', perm: 'ads', el: () => <P.Ads /> },
  { path: 'reports', label: 'البلاغات', perm: 'reports', el: () => <P.Reports /> },
  { path: 'users', label: 'المستخدمون', perm: 'users', el: () => <P.Users /> },
  { path: 'categories', label: 'الأقسام والحقول', perm: 'categories', el: () => <P.Categories /> },
  { path: 'locations', label: 'المحافظات والمناطق', perm: 'locations', el: () => <P.Locations /> },
  { path: 'commerce', label: 'الباقات والأكواد', perm: 'commerce', el: () => <P.Commerce /> },
  { path: 'banners', label: 'البنرات الإعلانية', perm: 'banners', el: () => <P.Banners /> },
  { path: 'notify', label: 'إرسال إشعارات', perm: 'notifications', el: () => <P.Broadcasts /> },
  { path: 'support', label: 'الدعم الفني', perm: 'support', el: () => <P.Support /> },
  { path: 'revenue', label: 'الإيرادات', perm: 'revenue', el: () => <P.Revenue /> },
  { path: 'pages', label: 'الشروط والخصوصية', perm: 'pages', el: () => <P.Pages /> },
  { path: 'audit', label: 'سجل العمليات', perm: 'audit', el: () => <P.Audit /> },
  { path: 'settings', label: 'إعدادات التطبيق', perm: 'settings', el: () => <P.Settings /> },
];

function useHash() {
  const [h, setH] = useState(window.location.hash.replace('#/', '') || 'dashboard');
  useEffect(() => {
    const f = () => setH(window.location.hash.replace('#/', '') || 'dashboard');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

function Login({ error: initialError }: { error?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? '');
  return (
    <div className="login">
      <form className="card" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError('');
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        setBusy(false);
        if (err) setError(/invalid login/i.test(err.message) ? 'البريد أو كلمة المرور غير صحيحة' : errMsg(err));
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 22 }}>سيـ فكرة ـل</div>
          <div className="faint" style={{ letterSpacing: 3 }}>FIKRA SELL · ADMIN</div>
        </div>
        {!configured && <div className="err">لم يتم ضبط VITE_SUPABASE_URL و VITE_SUPABASE_KEY</div>}
        <label className="f">البريد الإلكتروني<input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="f">كلمة المرور<input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <div className="err" role="alert">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? '…' : 'دخول'}</button>
        <div className="faint" style={{ textAlign: 'center' }}>الدخول مسموح لفريق الإدارة فقط. جميع العمليات مسجّلة.</div>
      </form>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [me, setMe] = useState<Me | null>(null);
  const [denied, setDenied] = useState('');
  const [menu, setMenu] = useState(false);
  const [counts, setCounts] = useState<{ reports: number; pending: number; tickets: number }>({ reports: 0, pending: 0, tickets: 0 });
  const route = useHash();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setMe(null); return; }
    (async () => {
      try {
        const prof = (await q(supabase.from('profiles').select('id, full_name, role, is_banned').eq('id', session.user.id).single())) as unknown as { id: string; full_name: string; role: Role; is_banned: boolean };
        if (prof.role === 'user' || prof.is_banned) {
          setDenied('هذا الحساب لا يملك صلاحية الدخول للوحة الإدارة.');
          await supabase.auth.signOut();
          return;
        }
        const perms = (await q(supabase.from('staff_permissions').select('permission').eq('user_id', prof.id))) as { permission: Perm }[];
        setMe({ id: prof.id, name: prof.full_name, email: session.user.email ?? '', role: prof.role, perms: new Set(perms.map((x) => x.permission)) });
        setDenied('');
      } catch (e) { setDenied(errMsg(e)); }
    })();
  }, [session]);

  useEffect(() => {
    if (!me) return;
    const load = async () => {
      const [r, a, t] = await Promise.all([
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('ads').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      ]);
      setCounts({ reports: r.count ?? 0, pending: a.count ?? 0, tickets: t.count ?? 0 });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [me, route]);

  if (session === undefined) return null;
  if (!session || !me) return <Login error={denied} />;

  const allowed = ROUTES.filter((r) => !r.perm || can(me, r.perm));
  const current = allowed.find((r) => r.path === route) ?? allowed[0];
  const badge = (p: string) => (p === 'reports' ? counts.reports : p === 'ads' ? counts.pending : p === 'support' ? counts.tickets : 0);

  return (
    <MeContext.Provider value={me}>
      <div className="shell">
        <aside className={`side ${menu ? 'open' : ''}`} onClick={() => setMenu(false)}>
          <div className="brand"><span style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--primary)' }} /><div>سيـ فكرة ـل<small>ADMIN</small></div></div>
          <nav className="nav">
            {allowed.map((r) => (
              <a key={r.path} href={`#/${r.path}`} className={current.path === r.path ? 'on' : ''}>
                {r.label}{badge(r.path) > 0 && <span className="count">{badge(r.path)}</span>}
              </a>
            ))}
          </nav>
          <div style={{ padding: '16px 8px', borderTop: '1px solid var(--line)', marginTop: 16 }}>
            <div style={{ fontWeight: 600 }}>{me.name}</div>
            <div className="faint">{me.email} · {{ owner: 'المالك', admin: 'مدير', moderator: 'مشرف', user: '' }[me.role]}</div>
            <button className="btn sec sm" style={{ marginTop: 10 }} onClick={() => supabase.auth.signOut()}>تسجيل الخروج</button>
          </div>
        </aside>
        <main className="main">
          <div className="top">
            <button className="btn sec burger" onClick={() => setMenu(true)} aria-label="القائمة">☰</button>
            <h1>{current.label}</h1>
          </div>
          {current.el()}
        </main>
      </div>
    </MeContext.Provider>
  );
}
