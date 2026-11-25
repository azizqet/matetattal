import type { OfferStatus, OrderCategory, OrderStatus, VehicleType } from "@fazza/shared";

export interface Profile {
  id: string; full_name: string; phone: string; phone_verified: boolean; avatar_path: string | null; locale: "ar" | "en";
  active_mode: "customer" | "driver"; status: "active" | "suspended" | "deleted"; must_change_password: boolean;
  customer_rating_sum: number; customer_rating_count: number; created_at: string;
}
export interface Driver {
  user_id: string; status: "pending" | "approved" | "rejected" | "suspended"; status_reason: string | null; vehicle_type: VehicleType;
  vehicle_model: string | null; plate_number: string; activation_fee_due_fils: number; activation_paid: boolean; is_online: boolean;
  balance_fils: number; total_earned_fils: number; completed_count: number; rating_sum: number; rating_count: number;
}
export interface AppSettings {
  activation_fee_fils: number; commission_bps: number; debt_limit_fils: number; min_offer_fils: number; max_offer_fils: number;
  order_ttl_minutes: number; offer_ttl_minutes: number; require_proof_photos: boolean; nearby_radius_km: number;
  support_phone: string; support_whatsapp: string; support_hours_ar: string; support_hours_en: string;
  payment_instructions_ar: string; payment_instructions_en: string; payment_link_url: string; account_deletion_url: string;
  terms_ar: string; terms_en: string; privacy_ar: string; privacy_en: string; min_app_version: string;
  maintenance_mode: boolean; maintenance_message_ar: string; maintenance_message_en: string;
}
export interface Order {
  id: string; code: string; customer_id: string; driver_id: string | null; status: OrderStatus; category: OrderCategory; details: string;
  pickup_lat: number; pickup_lng: number; pickup_address: string; pickup_notes: string | null;
  dropoff_lat: number; dropoff_lng: number; dropoff_address: string; dropoff_notes: string | null;
  recipient_name: string | null; recipient_phone: string | null; purchase_estimate_fils: number | null; distance_m: number;
  image_paths: string[]; accepted_offer_id: string | null; delivery_fee_fils: number | null; commission_fils: number | null;
  pickup_proof_path: string | null; delivery_proof_path: string | null; cancel_reason: string | null;
  created_at: string; expires_at: string; accepted_at: string | null; picked_up_at: string | null; delivered_at: string | null;
  completed_at: string | null; cancelled_at: string | null;
}
export interface Party { id: string; full_name: string; phone: string; avatar_path?: string | null; rating_avg: number | null; rating_count: number }
export interface OrderDetail extends Order {
  role: "customer" | "driver" | "admin";
  driver?: Party & { vehicle_type: VehicleType; vehicle_model: string | null; plate_number: string; completed_count: number };
  customer?: Party;
  my_rating?: { stars: number } | null;
}
export interface OfferCard {
  offer_id: string; driver_id: string; driver_name: string; avatar_path: string | null; vehicle_type: VehicleType;
  rating_avg: number | null; rating_count: number; completed_count: number; price_fils: number; eta_minutes: number;
  distance_to_pickup_m: number | null; note: string | null; status: OfferStatus; created_at: string; expires_at: string;
}
export interface OpenOrder {
  id: string; code: string; category: OrderCategory; details: string; pickup_address: string; pickup_lat: number; pickup_lng: number;
  pickup_area_id: number | null; dropoff_area_id: number | null; dropoff_approx_lat: number; dropoff_approx_lng: number;
  distance_m: number; distance_to_pickup_m: number | null; purchase_estimate_fils: number | null; image_paths: string[];
  offers_count: number; my_offer_id: string | null; my_offer_fils: number | null; created_at: string; expires_at: string;
}
export interface Area { id: number; governorate_id: number; name_ar: string; name_en: string; lat: number; lng: number }
export interface Governorate { id: number; name_ar: string; name_en: string; sort: number }
export interface DriverDashboard {
  status: Driver["status"]; status_reason: string | null; is_online: boolean; can_receive: boolean; block_reason: string | null;
  balance_fils: number; debt_limit_fils: number; commission_bps: number; activation_paid: boolean; activation_fee_due_fils: number;
  vehicle_type: VehicleType; plate_number: string; rating_avg: number | null; rating_count: number; completed_count: number;
  cancelled_count: number; total_earned_fils: number; today_earned_fils: number; month_earned_fils: number; today_orders: number;
  month_orders: number; today_commission_fils: number; month_commission_fils: number; paid_total_fils: number; active_orders: number;
  pending_receipts: number;
}
export interface NotificationRow {
  id: number; type: string; title_ar: string; title_en: string; body_ar: string; body_en: string; data: Record<string, unknown>;
  read_at: string | null; created_at: string;
}
