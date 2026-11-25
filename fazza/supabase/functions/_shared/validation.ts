// Keep in sync with packages/shared/src/phone.ts and public.normalize_kw_phone()
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeKwPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[٠-٩۰-۹]/g, (d) => {
    const a = ARABIC_DIGITS.indexOf(d);
    return String(a >= 0 ? a : PERSIAN_DIGITS.indexOf(d));
  });
  s = s.replace(/[^0-9+]/g, "");
  if (s.startsWith("+965")) s = s.slice(4);
  else if (s.startsWith("00965")) s = s.slice(5);
  else if (s.startsWith("965") && s.length === 11) s = s.slice(3);
  return /^[4569]\d{7}$/.test(s) ? `+965${s}` : null;
}

export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== "string") return "FZ_WEAK_PASSWORD";
  if (pw.length < 8 || pw.length > 72) return "FZ_WEAK_PASSWORD";
  if (!/[A-Za-z؀-ۿ]/.test(pw) || !/\d/.test(pw)) return "FZ_WEAK_PASSWORD";
  return null;
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const n = raw.replace(/\s+/g, " ").trim();
  return n.length >= 2 && n.length <= 80 ? n : null;
}
