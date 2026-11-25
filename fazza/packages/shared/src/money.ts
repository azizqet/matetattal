/**
 * Money is always handled as integer fils (1 KWD = 1000 fils). Never use floats for amounts.
 */
export const FILS_PER_KWD = 1000;

/** "1.25" | "1,250" | "١٫٢٥" -> 1250. Returns null for invalid input or more than 3 decimals. */
export function parseKwdToFils(input: string): number | null {
  if (typeof input !== "string") return null;
  let s = input.trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٫,]/g, ".")
    .replace(/\s|KWD|KD|د\.ك|دينار/gi, "");
  if (!/^\d{1,7}(\.\d{0,3})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  s = frac.padEnd(3, "0");
  return parseInt(whole, 10) * FILS_PER_KWD + parseInt(s, 10);
}

/** 1250 -> "1.250" */
export function filsToKwdString(fils: number): string {
  if (!Number.isInteger(fils)) throw new Error("fils must be an integer");
  const sign = fils < 0 ? "-" : "";
  const abs = Math.abs(fils);
  return `${sign}${Math.floor(abs / FILS_PER_KWD)}.${String(abs % FILS_PER_KWD).padStart(3, "0")}`;
}

export function formatKwd(fils: number | null | undefined, locale: "ar" | "en" = "ar"): string {
  if (fils === null || fils === undefined) return "—";
  const v = filsToKwdString(fils);
  return locale === "ar" ? `${v} د.ك` : `KWD ${v}`;
}

/**
 * Commission in fils with integer arithmetic, rounded half up.
 * Mirrors public.calc_commission_fils() in the database (the database is the source of truth).
 * bps: basis points, 1500 = 15%.
 */
export function calcCommissionFils(feeFils: number, bps: number): number {
  if (!Number.isInteger(feeFils) || !Number.isInteger(bps)) throw new Error("integers required");
  if (feeFils <= 0 || bps <= 0) return 0;
  return Math.floor((feeFils * bps + 5000) / 10000);
}

/** What the driver keeps from a delivery fee after the app commission. */
export function driverNetFils(feeFils: number, bps: number): number {
  return feeFils - calcCommissionFils(feeFils, bps);
}

export function bpsToPercentString(bps: number): string {
  const whole = Math.floor(bps / 100);
  const frac = bps % 100;
  return frac === 0 ? `${whole}%` : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}%`;
}
