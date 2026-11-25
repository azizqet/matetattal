import { createClient } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL ?? '', import.meta.env.VITE_SUPABASE_KEY ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'fikra-admin' },
});
export const configured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_KEY;

export type Role = 'user' | 'moderator' | 'admin' | 'owner';
export type Perm = 'ads' | 'reports' | 'users' | 'categories' | 'locations' | 'commerce' | 'banners' | 'notifications' | 'pages' | 'support' | 'settings' | 'revenue' | 'audit' | 'staff';
export const ALL_PERMS: Perm[] = ['ads', 'reports', 'users', 'categories', 'locations', 'commerce', 'banners', 'notifications', 'pages', 'support', 'settings', 'revenue', 'audit'];
export const PERM_LABEL: Record<Perm, string> = {
  ads: 'الإعلانات', reports: 'البلاغات', users: 'المستخدمون', categories: 'الأقسام', locations: 'المناطق', commerce: 'الباقات والتمييز',
  banners: 'البنرات', notifications: 'الإشعارات', pages: 'الصفحات', support: 'الدعم الفني', settings: 'الإعدادات', revenue: 'الإيرادات', audit: 'سجل العمليات', staff: 'المشرفون',
};

export type Me = { id: string; name: string; email: string; role: Role; perms: Set<Perm> };
export const MeContext = createContext<Me | null>(null);
export const useMe = () => useContext(MeContext)!;
export const can = (me: Me, p: Perm) => me.role === 'owner' || me.role === 'admin' || me.perms.has(p);

const MESSAGES: Record<string, string> = {
  forbidden: 'ليس لديك صلاحية لهذا الإجراء', reason_required: 'اكتب السبب', cannot_ban_staff: 'لا يمكن حظر مشرف (المالك فقط)',
  owner_only: 'هذا الإجراء للمالك فقط', user_not_found: 'المستخدم غير موجود', ad_not_found: 'الإعلان غير موجود',
  broadcast_limit: 'تجاوزت حد الإرسال في الساعة', invalid_input: 'بيانات غير صحيحة', package_not_found: 'الباقة غير موجودة',
};
export function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (MESSAGES[m]) return MESSAGES[m];
  if (/row-level security|permission denied/i.test(m)) return MESSAGES.forbidden;
  if (/duplicate key/i.test(m)) return 'القيمة موجودة مسبقاً';
  if (/violates foreign key/i.test(m)) return 'لا يمكن الحذف لارتباطه ببيانات أخرى (عطّله بدلاً من ذلك)';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'تعذّر الاتصال بالخادم';
  return m;
}

// ── Toasts ─────────────────────────────────────────────────────────────
type ToastFn = (msg: string, err?: boolean) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<{ msg: string; err: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback<ToastFn>((msg, err = false) => {
    window.clearTimeout(timer.current);
    setT({ msg, err });
    timer.current = window.setTimeout(() => setT(null), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={`toast ${t.err ? 'err' : ''}`} role="status"><i />{t.msg}</div>}
    </ToastCtx.Provider>
  );
}

/** Run an async admin action with toast feedback. */
export function useAction() {
  const toast = useToast();
  return useCallback(async (fn: () => Promise<unknown>, ok = 'تم') => {
    try { await fn(); toast(ok); return true; } catch (e) { toast(errMsg(e), true); return false; }
  }, [toast]);
}

/** Minimal data hook: load(), loading, error, reload. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn().then((d) => { if (alive) { setData(d); setError(null); } }).catch((e) => { if (alive) setError(errMsg(e)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((x) => x + 1), setData };
}

export async function q<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString('ar-KW-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtKwd = (n?: number | string | null) => (n === null || n === undefined ? '—' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(Number(n))} د.ك`);
export const publicUrl = (bucket: string, path?: string | null) => (path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : '');

// ── UI bits ────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

export function Status({ s }: { s: string }) {
  const map: Record<string, string> = {
    active: 'نشط', pending: 'قيد المراجعة', rejected: 'مرفوض', expired: 'منتهي', sold: 'مباع', hidden: 'مخفي',
    open: 'مفتوح', resolved: 'تمت المعالجة', dismissed: 'مرفوض', closed: 'مغلق', paid: 'مدفوع', failed: 'فشل', cancelled: 'ملغي', refunded: 'مسترجع',
  };
  return <span className={`badge ${s}`}>{map[s] ?? s}</span>;
}

export function Loading() { return <div className="empty">جارٍ التحميل…</div>; }
export function Empty({ text = 'لا توجد بيانات' }: { text?: string }) { return <div className="empty">{text}</div>; }
export function ErrorBox({ msg, retry }: { msg: string; retry?: () => void }) {
  return <div className="empty"><div className="err">{msg}</div>{retry && <button className="btn sec sm" onClick={retry} style={{ marginTop: 8 }}>إعادة المحاولة</button>}</div>;
}

/** Single-series vertical bars (magnitude over 14 days). Hover shows the value. */
export function Bars({ data, label }: { data: { x: string; y: number }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 180, P = 24, max = Math.max(1, ...data.map((d) => d.y));
  const bw = (W - P * 2) / data.length;
  return (
    <div style={{ position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H + 24}`} role="img" aria-label={label}>
        {[0.5, 1].map((g) => <line key={g} className="grid-line" x1={P} x2={W - P} y1={H - (H - 20) * g} y2={H - (H - 20) * g} />)}
        <text className="axis" x={W - P} y={H - (H - 20) - 4} textAnchor="end">{max}</text>
        {data.map((d, i) => {
          const h = Math.max(d.y ? 3 : 0, ((H - 20) * d.y) / max);
          const x = P + i * bw + bw * 0.2;
          return (
            <g key={d.x} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={P + i * bw} y={0} width={bw} height={H} fill="transparent" />
              <rect className="mark" x={x} y={H - h} width={bw * 0.6} height={h} rx={4} style={{ fill: hover === i ? 'var(--accent)' : undefined }} />
              {(i % 3 === 0 || i === data.length - 1) && <text className="axis" x={x + bw * 0.3} y={H + 16} textAnchor="middle">{d.x.slice(5)}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div style={{ position: 'absolute', top: 0, insetInlineStart: 0, background: 'var(--text)', color: 'var(--bg)', borderRadius: 8, padding: '4px 10px', fontSize: 12 }}>
          {data[hover].x}: <b>{data[hover].y}</b>
        </div>
      )}
    </div>
  );
}

export function HBars({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div>
      {rows.map((r) => (
        <div className="hbar" key={r.label} title={`${r.label}: ${r.n}`}>
          <span>{r.label}</span>
          <div className="track"><div className="fill" style={{ width: `${(r.n / max) * 100}%` }} /></div>
          <span className="n">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export function Pager({ page, setPage, hasMore }: { page: number; setPage: (p: number) => void; hasMore: boolean }) {
  return (
    <div className="pager">
      <button className="btn sec sm" disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</button>
      <span className="faint">صفحة {page + 1}</span>
      <button className="btn sec sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>التالي</button>
    </div>
  );
}
