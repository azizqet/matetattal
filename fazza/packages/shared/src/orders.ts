export type OrderStatus = "open" | "accepted" | "picked_up" | "delivered" | "completed" | "cancelled" | "expired";
export type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn" | "expired" | "cancelled";
export type OrderCategory = "parcel" | "food" | "groceries" | "documents" | "shopping" | "other";
export type VehicleType = "motorcycle" | "car" | "van" | "pickup" | "truck";

export const ACTIVE_STATUSES: OrderStatus[] = ["accepted", "picked_up", "delivered"];
export const FINAL_STATUSES: OrderStatus[] = ["completed", "cancelled", "expired"];
export const ORDER_CATEGORIES: OrderCategory[] = ["parcel", "food", "groceries", "documents", "shopping", "other"];
export const VEHICLE_TYPES: VehicleType[] = ["motorcycle", "car", "van", "pickup", "truck"];

/** Client-side mirror of the transitions enforced by the database. */
export function nextDriverStatus(s: OrderStatus): OrderStatus | null {
  if (s === "accepted") return "picked_up";
  if (s === "picked_up") return "delivered";
  return null;
}

export function customerCanCancel(s: OrderStatus): boolean {
  return s === "open" || s === "accepted";
}

export function driverCanCancel(s: OrderStatus): boolean {
  return s === "accepted";
}

export const STATUS_STEPS: OrderStatus[] = ["open", "accepted", "picked_up", "delivered", "completed"];

export function statusStepIndex(s: OrderStatus): number {
  return STATUS_STEPS.indexOf(s);
}

export type SortKey = "price" | "rating" | "eta" | "distance";
export interface OfferLike {
  price_fils: number; rating_avg: number | null; eta_minutes: number; distance_to_pickup_m: number | null; created_at: string;
}
export function sortOffers<T extends OfferLike>(offers: T[], key: SortKey): T[] {
  const arr = [...offers];
  const cmp: Record<SortKey, (a: T, b: T) => number> = {
    price: (a, b) => a.price_fils - b.price_fils,
    rating: (a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0),
    eta: (a, b) => a.eta_minutes - b.eta_minutes,
    distance: (a, b) => (a.distance_to_pickup_m ?? 1e9) - (b.distance_to_pickup_m ?? 1e9),
  };
  return arr.sort((a, b) => cmp[key](a, b) || a.created_at.localeCompare(b.created_at));
}

export function formatDistance(m: number | null | undefined, locale: "ar" | "en"): string {
  if (m === null || m === undefined) return "—";
  if (m < 1000) return locale === "ar" ? `${m} م` : `${m} m`;
  const km = (m / 1000).toFixed(m < 10000 ? 1 : 0);
  return locale === "ar" ? `${km} كم` : `${km} km`;
}
