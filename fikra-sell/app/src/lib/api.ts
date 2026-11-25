import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type {
  Ad, AdCard, AppNotification, Area, Banner, Category, CategoryField, Conversation, Governorate, Message,
  Package, Page, Profile, ProfileSettings, SavedSearch, SearchFilters, Settings, Ticket, TicketMessage,
} from './types';

export const PAGE_SIZE = 20;

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

/** Network-first with an on-device fallback copy for offline use. */
async function withOfflineCopy<T>(key: string, fn: () => Promise<T>): Promise<T> {
  try {
    const v = await fn();
    AsyncStorage.setItem(`fikra.cache.${key}`, JSON.stringify(v)).catch(() => {});
    return v;
  } catch (e) {
    const saved = await AsyncStorage.getItem(`fikra.cache.${key}`).catch(() => null);
    if (saved) return JSON.parse(saved) as T;
    throw e;
  }
}

// ── Catalog (categories, fields, locations, settings) ─────────────────
export type Catalog = {
  categories: Category[]; fields: CategoryField[]; governorates: Governorate[]; areas: Area[]; settings: Settings;
};
export function fetchCatalog(): Promise<Catalog> {
  return withOfflineCopy('catalog', async () => {
    const [c, f, g, a, s] = await Promise.all([
      supabase.from('categories').select('*').eq('is_active', true).order('sort'),
      supabase.from('category_fields').select('*').order('sort'),
      supabase.from('governorates').select('*').eq('is_active', true).order('sort'),
      supabase.from('areas').select('*').eq('is_active', true).order('sort'),
      supabase.from('app_settings').select('key,value'),
    ]);
    return {
      categories: unwrap(c) as Category[],
      fields: unwrap(f) as CategoryField[],
      governorates: unwrap(g) as Governorate[],
      areas: unwrap(a) as Area[],
      settings: Object.fromEntries((unwrap(s) as { key: string; value: unknown }[]).map((r) => [r.key, r.value])),
    };
  });
}

// ── Ads ────────────────────────────────────────────────────────────────
export async function searchAds(filters: SearchFilters, page = 0, limit = PAGE_SIZE): Promise<AdCard[]> {
  const p = { ...filters, limit, offset: page * limit };
  const key = page === 0 ? `search.${JSON.stringify(filters)}` : null;
  const run = async () => unwrap(await supabase.rpc('search_ads', { p })) as AdCard[];
  return key ? withOfflineCopy(key, run) : run();
}

export async function getAd(id: number): Promise<Ad | null> {
  const { data, error } = await supabase.from('ads').select('*, ad_images(*)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (data?.ad_images) (data.ad_images as Ad['ad_images'])!.sort((a, b) => a.sort - b.sort || a.id - b.id);
  return data as Ad | null;
}

export async function myAds(): Promise<Ad[]> {
  const { data: u } = await supabase.auth.getUser();
  return unwrap(await supabase.from('ads').select('*').eq('user_id', u.user!.id).order('created_at', { ascending: false })) as Ad[];
}

export async function getAdsByIds(ids: number[]): Promise<Ad[]> {
  if (!ids.length) return [];
  return unwrap(await supabase.from('ads').select('*').in('id', ids)) as Ad[];
}

export async function recordAdEvent(id: number, kind: 'view' | 'call' | 'whatsapp' | 'share') {
  await supabase.rpc('record_ad_event', { p_ad: id, p_kind: kind });
}

export async function setAdStatus(id: number, status: 'sold' | 'hidden' | 'active') {
  unwrap(await supabase.from('ads').update({ status }).eq('id', id).select('id').single());
}
export async function bumpAd(id: number): Promise<string> {
  return unwrap(await supabase.rpc('bump_ad', { p_ad: id })) as string;
}
export async function renewAd(id: number): Promise<string> {
  return unwrap(await supabase.rpc('renew_ad', { p_ad: id })) as string;
}
export async function deleteAd(ad: Pick<Ad, 'id' | 'user_id'>) {
  const { data: imgs } = await supabase.from('ad_images').select('path').eq('ad_id', ad.id);
  if (imgs?.length) await supabase.storage.from('ad-images').remove(imgs.map((i) => i.path));
  unwrap(await supabase.from('ads').delete().eq('id', ad.id).select('id'));
}

// ── Search helpers ─────────────────────────────────────────────────────
export async function suggestions(prefix: string) {
  if (prefix.trim().length < 1) return [];
  return unwrap(await supabase.rpc('search_suggestions', { prefix })) as { label: string; kind: 'category' | 'term' | 'ad'; category_id: number | null }[];
}
export function logSearch(term: string) {
  supabase.rpc('log_search', { term }).then(() => {}, () => {});
}

// ── Profiles ───────────────────────────────────────────────────────────
export async function getProfile(id: string): Promise<Profile | null> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null;
}
export async function getMySettings(): Promise<ProfileSettings | null> {
  return unwrap(await supabase.from('profile_settings').select('*').maybeSingle()) as ProfileSettings | null;
}
export async function updateMyProfile(id: string, patch: Partial<Pick<Profile, 'full_name' | 'avatar_path' | 'bio'>>) {
  unwrap(await supabase.from('profiles').update(patch).eq('id', id).select('id').single());
}
export async function updateMySettings(id: string, patch: Partial<Omit<ProfileSettings, 'user_id'>>) {
  unwrap(await supabase.from('profile_settings').update(patch).eq('user_id', id).select('user_id').single());
}

// ── Favourites ─────────────────────────────────────────────────────────
export async function favoriteIds(): Promise<number[]> {
  return (unwrap(await supabase.from('favorites').select('ad_id').order('created_at', { ascending: false })) as { ad_id: number }[]).map((r) => r.ad_id);
}
export async function setFavorite(adId: number, on: boolean) {
  if (on) {
    const { error } = await supabase.from('favorites').insert({ ad_id: adId });
    if (error && error.code !== '23505') throw error;
  } else {
    unwrap(await supabase.from('favorites').delete().eq('ad_id', adId).select('ad_id'));
  }
}

// ── Saved searches ─────────────────────────────────────────────────────
export async function savedSearches(): Promise<SavedSearch[]> {
  return unwrap(await supabase.from('saved_searches').select('*').order('created_at', { ascending: false })) as SavedSearch[];
}
export async function saveSearch(name: string, filters: SearchFilters, notify: boolean) {
  const { q, ...rest } = filters;
  delete rest.lat; delete rest.lng; delete rest.sort;
  unwrap(await supabase.from('saved_searches').insert({ name, query: q ?? '', filters: rest, notify }).select('id').single());
}
export async function updateSavedSearch(id: number, notify: boolean) {
  unwrap(await supabase.from('saved_searches').update({ notify }).eq('id', id).select('id'));
}
export async function deleteSavedSearch(id: number) {
  unwrap(await supabase.from('saved_searches').delete().eq('id', id).select('id'));
}

// ── Chat ───────────────────────────────────────────────────────────────
export async function startConversation(adId: number): Promise<string> {
  return unwrap(await supabase.rpc('start_conversation', { p_ad: adId })) as string;
}
export async function conversations(): Promise<Conversation[]> {
  return unwrap(await supabase.from('conversations').select('*').order('last_message_at', { ascending: false }).limit(200)) as Conversation[];
}
export async function getConversation(id: string): Promise<Conversation | null> {
  return unwrap(await supabase.from('conversations').select('*').eq('id', id).maybeSingle()) as Conversation | null;
}
export async function messages(convId: string, before?: string): Promise<Message[]> {
  let q = supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: false }).limit(40);
  if (before) q = q.lt('created_at', before);
  return unwrap(await q) as Message[];
}
export async function sendMessage(convId: string, body: string | null, imagePath: string | null = null): Promise<Message> {
  return unwrap(await supabase.from('messages').insert({ conversation_id: convId, body, image_path: imagePath }).select('*').single()) as Message;
}
export async function markConversationRead(id: string) {
  await supabase.rpc('mark_conversation_read', { p_conv: id });
}
export async function hideConversation(id: string) {
  unwrap(await supabase.rpc('hide_conversation', { p_conv: id }));
}

// ── Safety ─────────────────────────────────────────────────────────────
export async function blockUser(userId: string) {
  const { error } = await supabase.from('blocks').insert({ blocked_id: userId });
  if (error && error.code !== '23505') throw error;
}
export async function unblockUser(userId: string) {
  unwrap(await supabase.from('blocks').delete().eq('blocked_id', userId).select('blocked_id'));
}
export async function blockedUsers(): Promise<{ blocked_id: string; created_at: string; profile: Profile | null }[]> {
  const rows = unwrap(await supabase.from('blocks').select('blocked_id, created_at')) as { blocked_id: string; created_at: string }[];
  if (!rows.length) return [];
  const profiles = unwrap(await supabase.from('profiles').select('*').in('id', rows.map((r) => r.blocked_id))) as Profile[];
  return rows.map((r) => ({ ...r, profile: profiles.find((p) => p.id === r.blocked_id) ?? null }));
}
export async function report(targetType: 'ad' | 'user' | 'conversation' | 'message', targetId: string, reason: string, details?: string) {
  unwrap(await supabase.from('reports').insert({ target_type: targetType, target_id: targetId, reason, details: details || null }).select('id').single());
}

// ── Notifications ──────────────────────────────────────────────────────
export async function notificationsList(): Promise<AppNotification[]> {
  return unwrap(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)) as AppNotification[];
}
export async function markNotificationRead(id: number) {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
}
export async function markAllNotificationsRead() {
  await supabase.rpc('mark_all_notifications_read');
}
export async function counters(): Promise<{ unread_messages: number; unread_notifications: number; favorites: number }> {
  return unwrap(await supabase.rpc('my_counters')) as { unread_messages: number; unread_notifications: number; favorites: number };
}

// ── Content & commerce ─────────────────────────────────────────────────
export async function getPage(slug: string): Promise<Page | null> {
  return withOfflineCopy(`page.${slug}`, async () => unwrap(await supabase.from('pages').select('*').eq('slug', slug).maybeSingle()) as Page | null);
}
export async function banners(placement: string, categoryId?: number): Promise<Banner[]> {
  let q = supabase.from('banners').select('id,placement,category_id,title,image_path,link_url').eq('placement', placement).order('sort');
  if (categoryId) q = q.or(`category_id.is.null,category_id.eq.${categoryId}`);
  return unwrap(await q) as Banner[];
}
export function bannerEvent(id: number, kind: 'impression' | 'click') {
  supabase.rpc('banner_event', { p_banner: id, p_kind: kind }).then(() => {}, () => {});
}
export async function packages(): Promise<Package[]> {
  return unwrap(await supabase.from('packages').select('*').order('sort')) as Package[];
}
export function trackAppOpen() {
  supabase.rpc('track_app_open').then(() => {}, () => {});
}

// ── Support ────────────────────────────────────────────────────────────
export async function tickets(): Promise<Ticket[]> {
  return unwrap(await supabase.from('support_tickets').select('*').order('updated_at', { ascending: false })) as Ticket[];
}
export async function ticketMessages(id: number): Promise<TicketMessage[]> {
  return unwrap(await supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at')) as TicketMessage[];
}
export async function createTicket(subject: string, body: string): Promise<number> {
  const t = unwrap(await supabase.from('support_tickets').insert({ subject }).select('id').single()) as { id: number };
  unwrap(await supabase.from('ticket_messages').insert({ ticket_id: t.id, body }).select('id').single());
  return t.id;
}
export async function replyTicket(id: number, body: string) {
  unwrap(await supabase.from('ticket_messages').insert({ ticket_id: id, body }).select('id').single());
}

// ── Push ───────────────────────────────────────────────────────────────
export async function registerPushToken(token: string, platform: 'ios' | 'android' | 'web') {
  await supabase.rpc('register_push_token', { p_token: token, p_platform: platform });
}
