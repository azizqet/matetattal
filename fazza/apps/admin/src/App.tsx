import type { Session } from "@supabase/supabase-js";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Btn, Toaster } from "./components";
import { rpc } from "./lib/api";
import { setLang, tr, useLang } from "./lib/i18n";
import { supabase } from "./lib/supabase";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Drivers from "./pages/Drivers";
import Users from "./pages/Users";
import Orders from "./pages/Orders";
import Payments from "./pages/Payments";
import Finance from "./pages/Finance";
import Tickets from "./pages/Tickets";
import Ratings from "./pages/Ratings";
import Promos from "./pages/Promos";
import Areas from "./pages/Areas";
import Broadcast from "./pages/Broadcast";
import Settings from "./pages/Settings";
import LiveMap from "./pages/LiveMap";
import Audit from "./pages/Audit";

export interface Me { user_id: string; role: "owner" | "admin" | "finance" | "support"; full_name: string; phone: string }

const ROUTES: { path: string; ar: string; en: string; icon: string; roles?: Me["role"][]; el: (me: Me) => ReactNode }[] = [
  { path: "overview", ar: "نظرة عامة", en: "Overview", icon: "◉", el: () => <Overview /> },
  { path: "drivers", ar: "المناديب", en: "Drivers", icon: "🛵", roles: ["admin", "support"], el: () => <Drivers /> },
  { path: "users", ar: "المستخدمون", en: "Users", icon: "👥", el: (me) => <Users me={me} /> },
  { path: "orders", ar: "الطلبات", en: "Orders", icon: "📦", el: () => <Orders /> },
  { path: "payments", ar: "إيصالات السداد", en: "Receipts", icon: "🧾", roles: ["admin", "finance"], el: () => <Payments /> },
  { path: "finance", ar: "التقارير المالية", en: "Finance", icon: "💰", roles: ["admin", "finance"], el: () => <Finance /> },
  { path: "tickets", ar: "الدعم والبلاغات", en: "Support", icon: "💬", roles: ["admin", "support"], el: () => <Tickets /> },
  { path: "ratings", ar: "التقييمات", en: "Ratings", icon: "★", roles: ["admin", "support"], el: () => <Ratings /> },
  { path: "map", ar: "خريطة المناديب", en: "Live map", icon: "🗺", roles: ["admin", "support"], el: () => <LiveMap /> },
  { path: "broadcast", ar: "الإشعارات", en: "Notifications", icon: "📣", roles: ["admin", "support"], el: () => <Broadcast /> },
  { path: "promos", ar: "أكواد الخصم", en: "Promo codes", icon: "🏷", roles: ["admin"], el: () => <Promos /> },
  { path: "areas", ar: "المحافظات والمناطق", en: "Areas", icon: "📍", roles: ["admin"], el: () => <Areas /> },
  { path: "settings", ar: "الإعدادات والمحتوى", en: "Settings", icon: "⚙", roles: ["admin"], el: () => <Settings /> },
  { path: "audit", ar: "سجل التدقيق", en: "Audit log", icon: "🛡", roles: ["admin"], el: () => <Audit /> },
];

function useHash() {
  return useSyncExternalStore((f) => { window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); },
    () => window.location.hash.replace(/^#\/?/, "") || "overview");
}

export default function App() {
  useLang();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [meState, setMeState] = useState<{ uid: string; me: Me | null } | null>(null);
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("fazza.admin.theme") === "dark");
  const hash = useHash();

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("fazza.admin.theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    rpc<Me | null>("admin_me").then((m) => setMeState({ uid, me: m ?? null })).catch(() => setMeState({ uid, me: null }));
  }, [uid]);
  const me: Me | null | undefined = !session ? null : meState?.uid === uid ? meState!.me : undefined;

  if (session === undefined || (session && me === undefined)) return <div className="loader full"><span className="spin" /></div>;
  if (!session || !me) {
    return <><Login denied={!!session && me === null} onSignOut={() => supabase.auth.signOut()} /><Toaster /></>;
  }

  const allowed = ROUTES.filter((r) => !r.roles || me.role === "owner" || r.roles.includes(me.role));
  const route = allowed.find((r) => r.path === hash.split("/")[0]) ?? allowed[0];

  return (
    <div className="shell">
      <aside className={`side ${menu ? "open" : ""}`}>
        <div className="brand"><img src="/icon-192.png" alt="" /><div><b>فزّاع</b><small>FAZZA Admin</small></div></div>
        <nav>
          {allowed.map((r) => (
            <a key={r.path} href={`#/${r.path}`} className={route.path === r.path ? "active" : ""} onClick={() => setMenu(false)}>
              <span aria-hidden>{r.icon}</span>{tr(r.ar, r.en)}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          <div><b>{me.full_name}</b><small>{me.role}</small></div>
          <div className="row">
            <Btn small kind="ghost" onClick={() => setLang(document.documentElement.lang === "ar" ? "en" : "ar")}>{tr("English", "العربية")}</Btn>
            <Btn small kind="ghost" onClick={() => setDark((d) => !d)}>{dark ? "☀" : "☾"}</Btn>
          </div>
          <Btn small kind="ghost" onClick={() => supabase.auth.signOut()}>{tr("تسجيل الخروج", "Sign out")}</Btn>
        </div>
      </aside>
      {menu ? <div className="scrim" onClick={() => setMenu(false)} /> : null}
      <main>
        <div className="topbar">
          <button className="burger" aria-label="menu" onClick={() => setMenu(true)}>☰</button>
          <h1>{tr(route.ar, route.en)}</h1>
        </div>
        {route.el(me)}
      </main>
      <Toaster />
    </div>
  );
}
