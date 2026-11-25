// Row types mirroring supabase/migrations (kept in sync by hand; see docs).
export type PriceType = 'fixed' | 'negotiable' | 'contact' | 'free';
export type Condition = 'new' | 'used';
export type AdStatus = 'pending' | 'active' | 'rejected' | 'expired' | 'sold' | 'hidden';
export type Role = 'user' | 'moderator' | 'admin' | 'owner';

export type Category = {
  id: number; parent_id: number | null; slug: string; name_ar: string; name_en: string; icon: string;
  price_label: 'price' | 'salary' | 'rent' | 'none'; has_condition: boolean; sort: number; is_active: boolean; ads_count: number;
};

export type FieldOption = { v: string; ar: string; en: string };
export type CategoryField = {
  id: number; category_id: number; key: string; label_ar: string; label_en: string;
  type: 'select' | 'text' | 'number' | 'year' | 'boolean'; options: FieldOption[];
  unit_ar: string | null; unit_en: string | null; min_value: number | null; max_value: number | null;
  is_required: boolean; is_filterable: boolean; sort: number;
};

export type Governorate = { id: number; slug: string; name_ar: string; name_en: string; lat: number; lng: number; sort: number };
export type Area = { id: number; governorate_id: number; name_ar: string; name_en: string; sort: number };

export type AdCard = {
  id: number; title: string; price: number | null; price_type: PriceType; condition: Condition | null;
  cover_path: string | null; images_count: number; category_id: number; main_category_id: number;
  governorate_id: number; area_id: number | null; user_id: string; status: AdStatus;
  created_at: string; bumped_at: string; is_featured: boolean; is_pinned: boolean; distance_km: number | null; favorites_count: number;
};

export type AdImage = { id: number; ad_id: number; path: string; sort: number; width: number | null; height: number | null };

export type Ad = {
  id: number; user_id: string; category_id: number; main_category_id: number; title: string; description: string;
  price: number | null; price_type: PriceType; condition: Condition | null; governorate_id: number; area_id: number | null;
  lat: number | null; lng: number | null; attributes: Record<string, string | number | boolean>;
  contact_phone: string | null; allow_call: boolean; allow_whatsapp: boolean; allow_chat: boolean;
  status: AdStatus; reject_reason: string | null; cover_path: string | null; images_count: number;
  views_count: number; favorites_count: number; created_at: string; updated_at: string; published_at: string | null;
  bumped_at: string; expires_at: string | null; featured_until: string | null; pinned_until: string | null; sold_at: string | null;
  ad_images?: AdImage[];
};

export type Profile = {
  id: string; full_name: string; avatar_path: string | null; bio: string | null; role: Role; is_banned: boolean;
  is_merchant: boolean; merchant_until: string | null; active_ads_count: number; created_at: string;
};

export type ProfileSettings = {
  user_id: string; phone: string | null; locale: 'ar' | 'en';
  notification_prefs: { messages: boolean; ads: boolean; saved_searches: boolean; offers: boolean; general: boolean };
};

export type Conversation = {
  id: string; ad_id: number | null; buyer_id: string; seller_id: string; ad_title: string; ad_cover_path: string | null;
  last_message_at: string; last_message_preview: string; last_sender_id: string | null; buyer_unread: number; seller_unread: number;
  buyer_hidden_at: string | null; seller_hidden_at: string | null; created_at: string;
};

export type Message = { id: number; conversation_id: string; sender_id: string; body: string | null; image_path: string | null; created_at: string; read_at: string | null };

export type AppNotification = {
  id: number; user_id: string; type: string; title_ar: string; title_en: string; body_ar: string; body_en: string;
  data: { ad_id?: number; conversation_id?: string; ticket_id?: number; link?: string; saved_search_id?: number }; read_at: string | null; created_at: string;
};

export type SavedSearch = { id: number; name: string; query: string; filters: SearchFilters; notify: boolean; created_at: string };

export type SearchFilters = {
  q?: string; category_id?: number; governorate_id?: number; area_id?: number; min_price?: number; max_price?: number;
  condition?: Condition; attrs?: Record<string, string | { min?: number; max?: number }>;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'nearest' | 'relevance';
  lat?: number; lng?: number; radius_km?: number; featured_only?: boolean; seller_id?: string; exclude_id?: number;
};

export type Banner = { id: number; placement: string; category_id: number | null; title: string; image_path: string; link_url: string | null };
export type Package = {
  id: number; kind: 'feature' | 'pin' | 'bump' | 'merchant' | 'subscription'; name_ar: string; name_en: string;
  description_ar: string; description_en: string; price_kwd: number; promo_price_kwd: number | null; promo_ends_at: string | null; duration_days: number;
};
export type Page = { slug: string; title_ar: string; title_en: string; body_ar: string; body_en: string; updated_at: string };
export type Ticket = { id: number; subject: string; status: 'open' | 'pending' | 'closed'; created_at: string; updated_at: string };
export type TicketMessage = { id: number; ticket_id: number; sender_id: string | null; is_staff: boolean; body: string; created_at: string };
export type Settings = Record<string, unknown>;
