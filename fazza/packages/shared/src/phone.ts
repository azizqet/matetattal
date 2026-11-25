// Keep in sync with supabase/functions/_shared/validation.ts and public.normalize_kw_phone()
export function normalizeKwPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^0-9+]/g, "");
  if (s.startsWith("+965")) s = s.slice(4);
  else if (s.startsWith("00965")) s = s.slice(5);
  else if (s.startsWith("965") && s.length === 11) s = s.slice(3);
  return /^[4569]\d{7}$/.test(s) ? `+965${s}` : null;
}

/** +96550001234 -> "5000 1234" */
export function displayKwPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const local = e164.replace(/^\+965/, "");
  return local.length === 8 ? `${local.slice(0, 4)} ${local.slice(4)}` : e164;
}

export function passwordIsStrong(pw: string): boolean {
  return typeof pw === "string" && pw.length >= 8 && pw.length <= 72 && /[A-Za-z؀-ۿ]/.test(pw) && /\d/.test(pw);
}
