import { useEffect, useState, type ReactNode } from "react";
import { formatKwd } from "@fazza/shared";
import { errText, signedUrl } from "./lib/api";
import { lang, tr } from "./lib/i18n";

export const kwd = (f: number | null | undefined) => formatKwd(f ?? 0, lang());

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ""}`}>
      {title || actions ? <header className="card-h"><h3>{title}</h3><div className="row">{actions}</div></header> : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone = "primary", hint }: { label: string; value: ReactNode; tone?: string; hint?: string }) {
  return (
    <div className={`stat tone-${tone}`}>
      <div className="stat-v">{value}</div>
      <div className="stat-l">{label}</div>
      {hint ? <div className="stat-h">{hint}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "primary" }: { children: ReactNode; tone?: string }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function toneOf(s: string) {
  if (["completed", "approved", "active", "resolved"].includes(s)) return "success";
  if (["cancelled", "rejected", "suspended", "expired", "deleted"].includes(s)) return "danger";
  if (["pending", "open", "delivered", "in_progress"].includes(s)) return "warning";
  return "primary";
}

export function Btn({ children, onClick, kind = "primary", disabled, busy, type = "button", small }: {
  children: ReactNode; onClick?: () => unknown; kind?: "primary" | "ghost" | "danger" | "success"; disabled?: boolean; busy?: boolean; type?: "button" | "submit"; small?: boolean;
}) {
  return (
    <button type={type} className={`btn btn-${kind} ${small ? "btn-sm" : ""}`} disabled={disabled || busy} onClick={onClick}>
      {busy ? <span className="spin" /> : null}{children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="card-h"><h3>{title}</h3><button className="x" onClick={onClose} aria-label="close">×</button></header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="row end">{footer}</footer> : null}
      </div>
    </div>
  );
}

let toastSet: ((t: { msg: string; tone: string } | null) => void) | null = null;
export function toast(msg: string, tone = "success") { toastSet?.({ msg, tone }); setTimeout(() => toastSet?.(null), 3500); }
export function toastError(e: unknown) { toast(errText(e), "danger"); }
export function Toaster() {
  const [t, setT] = useState<{ msg: string; tone: string } | null>(null);
  useEffect(() => { toastSet = setT; return () => { toastSet = null; }; }, []);
  return t ? <div className={`toast tone-${t.tone}`} role="status">{t.msg}</div> : null;
}

/** Async data hook with reload. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fn().then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => alive && setError(errText(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, loading, error, reload: () => setN((x) => x + 1) };
}

export function Loader({ error }: { error?: string | null }) {
  return error ? <div className="alert tone-danger">{error}</div> : <div className="loader"><span className="spin" /> {tr("جارِ التحميل…", "Loading…")}</div>;
}

export function Empty({ text }: { text?: string }) {
  return <div className="empty">{text ?? tr("لا توجد بيانات", "No data")}</div>;
}

export function BarChart({ data, height = 160 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="chart" style={{ height }} role="img" aria-label="chart">
      {data.map((d) => (
        <div key={d.label} className="bar-wrap" title={`${d.label}: ${kwd(d.value)}`}>
          <div className="bar" style={{ height: `${(d.value / max) * 100}%` }} />
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function SignedImage({ bucket, path, alt }: { bucket: string; path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    signedUrl(bucket, path).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [bucket, path]);
  if (!url) return <div className="thumb ph" />;
  const pdf = path.toLowerCase().endsWith(".pdf");
  return pdf ? <a className="thumb" href={url} target="_blank" rel="noreferrer">PDF</a> :
    <a href={url} target="_blank" rel="noreferrer"><img className="thumb" src={url} alt={alt} referrerPolicy="no-referrer" /></a>;
}
