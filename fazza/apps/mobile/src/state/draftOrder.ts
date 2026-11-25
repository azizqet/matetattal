import { useSyncExternalStore } from "react";
import type { OrderCategory } from "@fazza/shared";

export interface PlaceDraft { lat: number; lng: number; address: string; notes?: string; area_id?: number | null }
export interface DraftOrder {
  pickup: PlaceDraft | null;
  dropoff: PlaceDraft | null;
  category: OrderCategory;
  details: string;
  images: string[];
  recipient_name: string;
  recipient_phone: string;
  purchase: string;
}
const empty = (): DraftOrder => ({ pickup: null, dropoff: null, category: "parcel", details: "", images: [], recipient_name: "", recipient_phone: "", purchase: "" });
let state = empty();
const listeners = new Set<() => void>();

export const draftOrder = {
  get: () => state,
  set(patch: Partial<DraftOrder>) { state = { ...state, ...patch }; listeners.forEach((l) => l()); },
  reset() { state = empty(); listeners.forEach((l) => l()); },
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
};

export function useDraftOrder(): DraftOrder {
  return useSyncExternalStore(draftOrder.subscribe, draftOrder.get, draftOrder.get);
}
