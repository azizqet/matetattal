// أنواع البيانات المطابقة لمخطط Supabase (مشتقة من generate_typescript_types)
export type Role = 'customer' | 'company' | 'staff' | 'admin';
export type CompanyStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type RequestStatus = 'new' | 'accepted' | 'on_way' | 'done' | 'rejected' | 'cancelled';
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled';

export interface Service { id: string; name_ar: string; sort: number | null; icon: string | null; is_active: boolean }
export interface Area { id: number; name_ar: string }

export interface Company {
  id: number;
  service_id: string | null;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  price_text: string | null;
  rating: number | null;
  rating_count: number;
  logo_url: string | null;
  cover_url: string | null;
  photos: string[];
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  is_24h: boolean;
  is_available: boolean;
  is_active: boolean | null;
  is_sample: boolean | null;
  status: CompanyStatus;
  sub_start: string | null;
  sub_end: string;
  owner_id: string | null;
  visits: number | null;
  calls: number | null;
  wa_taps: number | null;
  created_at: string | null;
  company_areas?: { area_id: number; areas?: { name_ar: string } | null }[];
  company_services?: CompanyService[];
  company_vehicles?: Vehicle[];
}

export interface CompanyService { id: number; company_id: number; service_id: string; title: string; price_from: number | null; price_note: string | null }

export interface Profile { id: string; full_name: string | null; phone: string | null; role: Role; created_at: string }

export interface Review { id: number; company_id: number; user_id: string; rating: number; comment: string | null; is_hidden: boolean; created_at: string }

export interface ServiceRequest {
  id: number; company_id: number; customer_id: string; service_id: string | null; note: string | null; phone: string;
  area_name: string | null; lat: number | null; lng: number | null; status: RequestStatus; created_at: string; updated_at: string;
  companies?: { name: string; phone: string | null; whatsapp: string | null; logo_url: string | null } | null;
  vehicle_id?: number | null;
  company_vehicles?: Pick<Vehicle, 'id' | 'label' | 'status' | 'status_updated_at'> | null;
}

export interface Plan { id: string; name_ar: string; months: number; price_kwd: number; is_active: boolean; sort: number | null }
export interface Promotion { id: number; code: string | null; name_ar: string; discount_percent: number; max_uses: number | null; used_count: number; starts_at: string | null; ends_at: string | null; is_active: boolean }
export interface Subscription {
  id: number; company_id: number; plan_id: string | null; promotion_id: number | null; amount_kwd: number;
  starts_on: string; ends_on: string; status: SubscriptionStatus; payment_note: string | null; created_at: string;
  companies?: { name: string } | null;
}
export interface JoinRequest { id: number; company_name: string; service_id: string | null; phone: string; area_name: string | null; status: string | null; created_at: string | null; logo_url: string | null }
export interface Notification { id: number; user_id: string; title: string; body: string | null; data: unknown; read_at: string | null; created_at: string }
export interface Setting { key: string; value: unknown; is_public: boolean }

export interface AdminStats {
  companies_total: number; companies_visible: number; companies_pending: number; expiring_7d: number; customers: number;
  requests_total: number; requests_open: number; complaints_open: number; join_requests_new: number;
  visits: number; calls: number; wa_taps: number; revenue_active_kwd: number;
}

export type ComplaintStatus = 'open' | 'in_review' | 'resolved' | 'closed';
export interface Complaint {
  id: number; user_id: string; company_id: number | null; subject: string; body: string;
  status: ComplaintStatus; admin_note: string | null; created_at: string;
  companies?: { name: string } | null;
  reporter?: { full_name: string | null; phone: string | null } | null;
}

// ===== المرحلة 1: الشروط والموافقات =====
export type TermsKind = 'customers' | 'providers' | 'privacy' | 'subscriptions' | 'ads';
export type ConsentContext = 'registration' | 'company_create' | 'subscription' | 'ads' | 'update';
export interface TermsDocument {
  id: number; kind: TermsKind; version: string; title: string; body: string; body_sha256: string;
  published_at: string | null; is_current: boolean; created_at: string;
}
export interface PendingTerm { document_id: number; kind: TermsKind; version: string; title: string }

// ===== المرحلة 1B: السطحات والونشات =====
export type VehicleStatus = 'available' | 'busy' | 'offline';
export type VehicleKind = 'flatbed' | 'wrecker' | 'other';
export interface Vehicle {
  id: number; company_id: number; label: string; kind: VehicleKind; status: VehicleStatus;
  status_updated_at: string; is_active: boolean; created_at: string;
}

// ===== المرحلة 2: الإعلانات بموافقة المالك =====
export type AdStatus = 'pending' | 'approved' | 'rejected' | 'paused';
export interface Ad {
  id: number; owner_id: string; service_id: string; title: string; description: string; images: string[];
  area_name: string; phone: string; whatsapp: string | null; price: number | null; status: AdStatus; reject_reason: string | null;
  reviewed_at: string | null; published_at: string | null; created_at: string; updated_at: string;
}
export type AdInput = Pick<Ad, 'service_id' | 'title' | 'description' | 'images' | 'area_name' | 'phone' | 'whatsapp' | 'price'>;

// ===== المرحلة 2: الدعم الفني =====
export type TicketStatus = 'new' | 'in_progress' | 'resolved';
export interface SupportTicket { id: number; user_id: string; subject: string; status: TicketStatus; created_at: string; updated_at: string; last_message_at: string }
export interface SupportMessage { id: number; ticket_id: number; sender_id: string | null; is_staff: boolean; body: string; image_path: string | null; created_at: string }
