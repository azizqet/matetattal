import { describe, expect, it } from "vitest";
import {
  calcCommissionFils, driverNetFils, filsToKwdString, formatKwd, parseKwdToFils, bpsToPercentString,
  normalizeKwPhone, displayKwPhone, passwordIsStrong, extractErrorCode, errorMessage, sortOffers,
  nextDriverStatus, customerCanCancel, driverCanCancel, formatDistance,
} from "../../packages/shared/src";

describe("money (fils)", () => {
  it("parses KWD strings without float errors", () => {
    expect(parseKwdToFils("1.25")).toBe(1250);
    expect(parseKwdToFils("0.1")).toBe(100);
    expect(parseKwdToFils("0.005")).toBe(5);
    expect(parseKwdToFils("3")).toBe(3000);
    expect(parseKwdToFils("١٫٥")).toBe(1500);
    expect(parseKwdToFils("2,750")).toBe(2750);
    expect(parseKwdToFils("1.2345")).toBeNull();
    expect(parseKwdToFils("-1")).toBeNull();
    expect(parseKwdToFils("abc")).toBeNull();
    expect(parseKwdToFils("")).toBeNull();
  });
  it("formats fils", () => {
    expect(filsToKwdString(1250)).toBe("1.250");
    expect(filsToKwdString(5)).toBe("0.005");
    expect(filsToKwdString(-300)).toBe("-0.300");
    expect(formatKwd(1500, "ar")).toBe("1.500 د.ك");
    expect(formatKwd(1500, "en")).toBe("KWD 1.500");
    expect(() => filsToKwdString(1.5)).toThrow();
  });
  it("computes 15% commission with half-up integer rounding", () => {
    expect(calcCommissionFils(1000, 1500)).toBe(150);
    expect(calcCommissionFils(1250, 1500)).toBe(188); // 187.5 -> 188
    expect(calcCommissionFils(1245, 1500)).toBe(187); // 186.75 -> 187
    expect(calcCommissionFils(3335, 1500)).toBe(500); // 500.25 -> 500
    expect(calcCommissionFils(5, 1500)).toBe(1); // 0.75 -> 1
    expect(calcCommissionFils(0, 1500)).toBe(0);
    expect(driverNetFils(2000, 1500)).toBe(1700);
    expect(bpsToPercentString(1500)).toBe("15%");
    expect(bpsToPercentString(1250)).toBe("12.5%");
  });
  it("never drifts when summing many commissions (integers)", () => {
    let total = 0;
    for (let i = 0; i < 10000; i++) total += calcCommissionFils(1250, 1500);
    expect(total).toBe(1_880_000);
  });
});

describe("phone", () => {
  it("normalizes Kuwaiti numbers", () => {
    expect(normalizeKwPhone("5000 1234")).toBe("+96550001234");
    expect(normalizeKwPhone("+965 9999-8888")).toBe("+96599998888");
    expect(normalizeKwPhone("0096566665555")).toBe("+96566665555");
    expect(normalizeKwPhone("96541112222")).toBe("+96541112222");
    expect(normalizeKwPhone("٦٠٠٠١٢٣٤")).toBe("+96560001234");
    expect(normalizeKwPhone("22223333")).toBeNull(); // landline
    expect(normalizeKwPhone("5000123")).toBeNull();
    expect(normalizeKwPhone("+97150001234")).toBeNull();
    expect(normalizeKwPhone(12345678)).toBeNull();
    expect(displayKwPhone("+96550001234")).toBe("5000 1234");
  });
  it("validates passwords", () => {
    expect(passwordIsStrong("abc12345")).toBe(true);
    expect(passwordIsStrong("12345678")).toBe(false);
    expect(passwordIsStrong("abcdefgh")).toBe(false);
    expect(passwordIsStrong("a1")).toBe(false);
  });
});

describe("errors & orders", () => {
  it("extracts codes from postgres messages", () => {
    expect(extractErrorCode("FZ_ORDER_NOT_OPEN")).toBe("FZ_ORDER_NOT_OPEN");
    expect(extractErrorCode("ERROR: FZ_CANNOT_RECEIVE:debt_limit")).toBe("FZ_CANNOT_RECEIVE:debt_limit");
    expect(extractErrorCode("TypeError: Failed to fetch")).toBe("FZ_NETWORK");
    expect(errorMessage("FZ_PHONE_TAKEN", "en")).toMatch(/already/);
    expect(errorMessage("weird", "ar")).toBe("حدث خطأ في الخادم، حاول لاحقاً");
  });
  it("sorts offers and knows transitions", () => {
    const offers = [
      { id: 1, price_fils: 2000, rating_avg: 4.9, eta_minutes: 30, distance_to_pickup_m: 900, created_at: "2026-01-01T00:00:01Z" },
      { id: 2, price_fils: 1500, rating_avg: 4.1, eta_minutes: 10, distance_to_pickup_m: 3000, created_at: "2026-01-01T00:00:02Z" },
      { id: 3, price_fils: 1500, rating_avg: null, eta_minutes: 20, distance_to_pickup_m: null, created_at: "2026-01-01T00:00:00Z" },
    ];
    expect(sortOffers(offers, "price").map((o) => o.id)).toEqual([3, 2, 1]);
    expect(sortOffers(offers, "rating").map((o) => o.id)).toEqual([1, 2, 3]);
    expect(sortOffers(offers, "eta").map((o) => o.id)).toEqual([2, 3, 1]);
    expect(sortOffers(offers, "distance").map((o) => o.id)).toEqual([1, 2, 3]);
    expect(nextDriverStatus("accepted")).toBe("picked_up");
    expect(nextDriverStatus("picked_up")).toBe("delivered");
    expect(nextDriverStatus("delivered")).toBeNull();
    expect(customerCanCancel("picked_up")).toBe(false);
    expect(driverCanCancel("accepted")).toBe(true);
    expect(formatDistance(850, "en")).toBe("850 m");
    expect(formatDistance(12500, "ar")).toBe("13 كم");
  });
});
