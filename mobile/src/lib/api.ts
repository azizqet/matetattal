// طبقة الوصول للبيانات. كل الصلاحيات مفروضة في قاعدة البيانات (RLS)، والتطبيق مجرد واجهة.
import { supabase, SUPABASE_URL } from './supabase';
import type {
  Ad, AdInput, AdStatus, SupportMessage, SupportTicket, TicketStatus,
  AdminStats, Area, Complaint, Company, ConsentContext, PendingTerm, TermsDocument, TermsKind, Vehicle, VehicleKind, VehicleStatus, CompanyService, JoinRequest, Notification, Plan, Profile, Promotion, Review,
  Service, ServiceRequest, Setting, Subscription,
} from './types';

const COMPANY_SELECT = '*, company_areas(area_id, areas(name_ar)), company_services(*), company_vehicles(id, label, kind, status, status_updated_at, is_active)';

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

// ===== عام =====
export async function getServices(): Promise<Service[]> {
  return check(await supabase.from('services').select('*').eq('is_active', true).order('sort'));
}
export async function getAreas(): Promise<Area[]> {
  return check(await supabase.from('areas').select('*').order('id'));
}
export async function getSettings(): Promise<Record<string, unknown>> {
  const rows: Setting[] = check(await supabase.from('app_settings').select('*'));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
/** الشركات الظاهرة للعامة (RLS يعرض فقط المعتمدة والمشتركة) */
export async function getPublicCompanies(): Promise<Company[]> {
  const today = new Date().toISOString().slice(0, 10);
  return check(await supabase.from('companies').select(COMPANY_SELECT)
    .eq('is_active', true).eq('status', 'approved').gte('sub_end', today).order('rating', { ascending: false }));
}
export async function getCompany(id: number): Promise<Company | null> {
  return check(await supabase.from('companies').select(COMPANY_SELECT).eq('id', id).maybeSingle());
}
export async function getReviews(companyId: number): Promise<Review[]> {
  return check(await supabase.from('reviews').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50));
}
export async function trackCompany(id: number, kind: 'view' | 'call' | 'wa') {
  await supabase.rpc('track_company', { p_id: id, p_kind: kind });
}
export async function sendJoinRequest(r: { company_name: string; service_id: string; phone: string; area_name: string }) {
  check(await supabase.from('join_requests').insert(r));
}

// ===== الحساب =====
export async function getMyProfile(uid: string): Promise<Profile | null> {
  return check(await supabase.from('profiles').select('*').eq('id', uid).maybeSingle());
}
export async function updateMyProfile(uid: string, p: { full_name?: string; phone?: string | null }) {
  check(await supabase.from('profiles').update(p).eq('id', uid));
}

// ===== العميل =====
export async function getFavorites(): Promise<number[]> {
  const rows: { company_id: number }[] = check(await supabase.from('favorites').select('company_id'));
  return rows.map((r) => r.company_id);
}
export async function toggleFavorite(companyId: number, on: boolean) {
  if (on) check(await supabase.from('favorites').insert({ company_id: companyId }));
  else check(await supabase.from('favorites').delete().eq('company_id', companyId));
}
export async function createServiceRequest(r: { company_id: number; service_id: string | null; phone: string; note?: string; area_name?: string | null; lat?: number | null; lng?: number | null }) {
  return check(await supabase.from('service_requests').insert(r).select().single()) as ServiceRequest;
}
export async function getMyRequests(uid: string): Promise<ServiceRequest[]> {
  return check(await supabase.from('service_requests').select('*, companies(name, phone, whatsapp, logo_url), company_vehicles(id, label, status, status_updated_at)')
    .eq('customer_id', uid).order('created_at', { ascending: false }).limit(100));
}
export async function setRequestStatus(id: number, status: string) {
  check(await supabase.from('service_requests').update({ status }).eq('id', id));
}
export async function upsertReview(companyId: number, rating: number, comment: string, existingId?: number) {
  if (existingId) check(await supabase.from('reviews').update({ rating, comment: comment || null }).eq('id', existingId));
  else check(await supabase.from('reviews').insert({ company_id: companyId, rating, comment: comment || null }));
}
export async function createComplaint(c: { company_id?: number | null; subject: string; body: string }) {
  check(await supabase.from('complaints').insert(c));
}
export async function getNotifications(): Promise<Notification[]> {
  return check(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50));
}
export async function markNotificationsRead(uid: string) {
  check(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', uid).is('read_at', null));
}

// ===== صاحب الشركة =====
export async function getMyCompanies(uid: string): Promise<Company[]> {
  return check(await supabase.from('companies').select(COMPANY_SELECT).eq('owner_id', uid).order('id'));
}
export type CompanyInput = Partial<Pick<Company, 'name' | 'service_id' | 'phone' | 'whatsapp' | 'price_text' | 'description' | 'address' | 'lat' | 'lng' | 'is_24h' | 'is_available' | 'logo_url' | 'cover_url' | 'photos'>>;
export async function createMyCompany(uid: string, c: CompanyInput): Promise<Company> {
  return check(await supabase.from('companies').insert({ ...c, name: c.name ?? '', owner_id: uid, status: 'pending', is_active: false }).select().single());
}
export async function updateCompany(id: number, c: CompanyInput) {
  check(await supabase.from('companies').update(c).eq('id', id));
}
export async function setCompanyAreas(companyId: number, areaIds: number[]) {
  check(await supabase.from('company_areas').delete().eq('company_id', companyId));
  if (areaIds.length) check(await supabase.from('company_areas').insert(areaIds.map((area_id) => ({ company_id: companyId, area_id }))));
}
export async function addCompanyService(s: Omit<CompanyService, 'id'>) {
  check(await supabase.from('company_services').insert(s));
}
export async function deleteCompanyService(id: number) {
  check(await supabase.from('company_services').delete().eq('id', id));
}
export async function getCompanyRequests(companyIds: number[]): Promise<ServiceRequest[]> {
  if (!companyIds.length) return [];
  return check(await supabase.from('service_requests').select('*, company_vehicles(id, label, status, status_updated_at)').in('company_id', companyIds).order('created_at', { ascending: false }).limit(100));
}
export async function getPlans(): Promise<Plan[]> {
  return check(await supabase.from('subscription_plans').select('*').order('sort'));
}
export async function quote(plan: string, code?: string): Promise<{ base: number; total: number; discount_percent: number; months: number }> {
  return check(await supabase.rpc('quote_subscription', { p_plan: plan, p_code: code || undefined })) as never;
}
export async function requestSubscription(companyId: number, plan: string, code?: string) {
  return check(await supabase.rpc('request_subscription', { p_company: companyId, p_plan: plan, p_code: code || undefined })) as {
    subscription_id: number; amount_kwd: number; starts_on: string; ends_on: string;
  };
}
export async function getCompanySubscriptions(companyId: number): Promise<Subscription[]> {
  return check(await supabase.from('subscriptions').select('*').eq('company_id', companyId).order('created_at', { ascending: false }));
}

/** رفع صورة إلى مجلد المستخدم في company-media (السياسة تسمح فقط بمجلد uid) */
export async function uploadCompanyImage(uid: string, uri: string, mime = 'image/jpeg'): Promise<string> {
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  check(await supabase.storage.from('company-media').upload(path, body, { contentType: mime, upsert: false }));
  return `${SUPABASE_URL}/storage/v1/object/public/company-media/${path}`;
}

// ===== الإدارة =====
export async function adminStats(): Promise<AdminStats> {
  return check(await supabase.rpc('admin_stats')) as unknown as AdminStats;
}
export async function adminCompanies(): Promise<Company[]> {
  return check(await supabase.from('companies').select(COMPANY_SELECT).order('id', { ascending: false }));
}
export async function adminUpdateCompany(id: number, c: Partial<Company>) {
  const { company_areas, company_services, ...rest } = c;
  void company_areas; void company_services;
  check(await supabase.from('companies').update(rest).eq('id', id));
}
export async function adminJoinRequests(): Promise<JoinRequest[]> {
  return check(await supabase.from('join_requests').select('*').order('created_at', { ascending: false }).limit(200));
}
/** قبول طلب انضمام: إنشاء شركة فعّالة (نفس سلوك لوحة الويب: اشتراك 30 يوم) */
export async function adminAcceptJoin(r: JoinRequest, areas: Area[]) {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const phone = r.phone.replace(/\D/g, '').length === 8 ? '965' + r.phone.replace(/\D/g, '') : r.phone.replace(/\D/g, '');
  const c: Company = check(await supabase.from('companies').insert({
    service_id: r.service_id, name: r.company_name, phone, whatsapp: phone, logo_url: r.logo_url,
    is_active: true, status: 'approved', is_sample: false, sub_start: today, sub_end: end,
  }).select().single());
  const area = areas.find((a) => a.name_ar === r.area_name);
  if (area) check(await supabase.from('company_areas').insert({ company_id: c.id, area_id: area.id }));
  check(await supabase.from('join_requests').update({ status: 'accepted' }).eq('id', r.id));
}
export async function adminSetJoinStatus(id: number, status: 'rejected' | 'new') {
  check(await supabase.from('join_requests').update({ status }).eq('id', id));
}
export async function adminSubscriptions(): Promise<Subscription[]> {
  return check(await supabase.from('subscriptions').select('*, companies(name)').order('created_at', { ascending: false }).limit(200));
}
export async function adminActivateSubscription(id: number, note: string) {
  check(await supabase.rpc('admin_activate_subscription', { p_id: id, p_note: note || undefined }));
}
export async function adminCancelSubscription(id: number) {
  check(await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('id', id));
}
export async function adminSavePlan(p: Plan) {
  check(await supabase.from('subscription_plans').upsert(p));
}
export async function adminPromotions(): Promise<Promotion[]> {
  return check(await supabase.from('promotions').select('*').order('id'));
}
export async function adminSavePromotion(p: Partial<Promotion>) {
  if (p.id) { const { id, ...rest } = p; check(await supabase.from('promotions').update(rest).eq('id', id)); }
  else check(await supabase.from('promotions').insert(p as Promotion));
}
export async function adminSettings(): Promise<Setting[]> {
  return check(await supabase.from('app_settings').select('*').order('key'));
}
export async function adminSaveSetting(key: string, value: unknown) {
  check(await supabase.from('app_settings').upsert({ key, value: value as never, updated_at: new Date().toISOString() }));
}
export async function adminFindUser(email: string) {
  const rows = check(await supabase.rpc('admin_find_user', { p_email: email })) as { id: string; email: string; role: string; full_name: string }[];
  return rows[0] ?? null;
}
export async function adminServices(): Promise<Service[]> {
  return check(await supabase.from('services').select('*').order('sort'));
}
export async function adminSaveService(s: Service) {
  check(await supabase.from('services').upsert(s));
}

// ===== الإدارة: الشكاوى (جدول complaints الحالي — الصلاحيات للمشرفين والمديرين فقط عبر RLS) =====
export async function adminComplaints(): Promise<Complaint[]> {
  const rows: Complaint[] = check(await supabase.from('complaints').select('*, companies(name)').order('created_at', { ascending: false }).limit(200));
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length) {
    const profs: { id: string; full_name: string | null; phone: string | null }[] = check(await supabase.from('profiles').select('id, full_name, phone').in('id', ids));
    const m = new Map(profs.map((p) => [p.id, p]));
    for (const r of rows) r.reporter = m.get(r.user_id) ?? null;
  }
  return rows;
}
export async function adminUpdateComplaint(id: number, status: Complaint['status'], admin_note: string | null) {
  check(await supabase.from('complaints').update({ status, admin_note }).eq('id', id));
}

// ===== الإدارة: الأدوار (دوال admin_find_user و admin_set_role الموجودة — للمدير فقط) =====
export async function adminTeam(): Promise<Profile[]> {
  return check(await supabase.from('profiles').select('*').in('role', ['admin', 'staff']).order('created_at'));
}
export async function adminSetRole(userId: string, role: Profile['role']) {
  check(await supabase.rpc('admin_set_role', { p_user: userId, p_role: role }));
}

// ===== الشروط والموافقات (المرحلة 1) — كل التحقق مفروض في قاعدة البيانات =====
/** النسخ المنشورة السارية (اختياري: أنواع محددة) */
export async function getCurrentTerms(kinds?: TermsKind[]): Promise<TermsDocument[]> {
  let q = supabase.from('terms_documents').select('*').eq('is_current', true).not('published_at', 'is', null);
  if (kinds?.length) q = q.in('kind', kinds);
  return check(await q.order('kind'));
}
export async function getMyAcceptedDocIds(): Promise<number[]> {
  const rows: { document_id: number }[] = check(await supabase.from('terms_acceptances').select('document_id'));
  return rows.map((r) => r.document_id);
}
export async function getMyPendingTerms(): Promise<PendingTerm[]> {
  return check(await supabase.rpc('my_pending_terms')) as PendingTerm[];
}
/** تسجيل الموافقة. الخادم يحدد الوقت والإصدار والبصمة والمستخدم — التطبيق يرسل المعرّف والسياق فقط */
export async function acceptTerms(documentIds: number[], context: ConsentContext, companyId?: number | null, platform?: 'ios' | 'android' | 'web', appVersion?: string) {
  if (!documentIds.length) return;
  check(await supabase.from('terms_acceptances').insert(documentIds.map((document_id) => ({
    document_id, context, company_id: companyId ?? null, platform: platform ?? null, app_version: appVersion ?? null,
  }))));
}
/** للإدارة: كل النسخ (المنشورة والمسودات) */
export async function adminTermsDocuments(): Promise<TermsDocument[]> {
  return check(await supabase.from('terms_documents').select('*').order('kind').order('created_at', { ascending: false }));
}
/** نشر نسخة جديدة: إدراج غير سارٍ ← إلغاء السارية السابقة ← تفعيل الجديدة (الخادم يحسب البصمة ووقت النشر) */
export async function adminPublishTerms(kind: TermsKind, version: string, title: string, body: string) {
  const doc: TermsDocument = check(await supabase.from('terms_documents').insert({ kind, version, title, body }).select().single());
  check(await supabase.from('terms_documents').update({ is_current: false }).eq('kind', kind).eq('is_current', true));
  check(await supabase.from('terms_documents').update({ is_current: true }).eq('id', doc.id));
}

// ===== السطحات والونشات (المرحلة 1B) =====
export async function getCompanyVehicles(companyId: number): Promise<Vehicle[]> {
  return check(await supabase.from('company_vehicles').select('*').eq('company_id', companyId).order('id'));
}
export async function addVehicle(companyId: number, label: string, kind: VehicleKind) {
  check(await supabase.from('company_vehicles').insert({ company_id: companyId, label, kind }));
}
/** وقت التحديث يحدده الخادم تلقائياً عند تغيير الحالة */
export async function setVehicleStatus(id: number, status: VehicleStatus) {
  check(await supabase.from('company_vehicles').update({ status }).eq('id', id));
}
export async function setVehicleActive(id: number, is_active: boolean) {
  check(await supabase.from('company_vehicles').update({ is_active }).eq('id', id));
}
export async function deleteVehicle(id: number) {
  check(await supabase.from('company_vehicles').delete().eq('id', id));
}
/** صاحب الشركة: قبول الطلب مع تحديد السطحة (اختياري) */
export async function acceptRequestWithVehicle(requestId: number, vehicleId: number | null) {
  const patch: Record<string, unknown> = { status: 'accepted' };
  if (vehicleId) patch.vehicle_id = vehicleId;
  check(await supabase.from('service_requests').update(patch).eq('id', requestId));
}
export async function assignRequestVehicle(requestId: number, vehicleId: number | null) {
  check(await supabase.from('service_requests').update({ vehicle_id: vehicleId }).eq('id', requestId));
}

// ===== المرحلة 2: الإعلانات (كل قواعد الموافقة في الخادم: تريجر guard_ad + RLS) =====
export async function getPublicAds(serviceId?: string): Promise<Ad[]> {
  let q = supabase.from('ads').select('*').eq('status', 'approved');
  if (serviceId) q = q.eq('service_id', serviceId);
  return check(await q.order('published_at', { ascending: false }).limit(50));
}
export async function getAd(id: number): Promise<Ad | null> {
  return check(await supabase.from('ads').select('*').eq('id', id).maybeSingle());
}
export async function getMyAds(uid: string): Promise<Ad[]> {
  return check(await supabase.from('ads').select('*').eq('owner_id', uid).order('created_at', { ascending: false }));
}
/** الحالة لا تُرسل: الخادم يجعلها «بانتظار الموافقة» دائماً */
export async function createAd(a: AdInput): Promise<Ad> {
  return check(await supabase.from('ads').insert(a).select().single());
}
/** تعديل البيانات الأساسية يعيد الإعلان للمراجعة (يفرضه الخادم) */
export async function updateAd(id: number, a: Partial<AdInput>) {
  check(await supabase.from('ads').update(a).eq('id', id));
}
export async function deleteAd(id: number) {
  check(await supabase.from('ads').delete().eq('id', id));
}
export async function uploadAdImage(uid: string, uri: string, mime = 'image/jpeg'): Promise<string> {
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  check(await supabase.storage.from('ads').upload(path, body, { contentType: mime, upsert: false }));
  return `${SUPABASE_URL}/storage/v1/object/public/ads/${path}`;
}
export async function adminAds(status?: AdStatus): Promise<Ad[]> {
  let q = supabase.from('ads').select('*');
  if (status) q = q.eq('status', status);
  return check(await q.order('created_at', { ascending: false }).limit(200));
}
export async function adminReviewAd(id: number, status: AdStatus, reason?: string) {
  check(await supabase.from('ads').update({ status, reject_reason: status === 'rejected' ? (reason ?? '').trim() : null }).eq('id', id));
}

// ===== المرحلة 2: الدعم الفني (خاص بين صاحب الطلب والإدارة — RLS) =====
export async function getMyTickets(uid: string): Promise<SupportTicket[]> {
  return check(await supabase.from('support_tickets').select('*').eq('user_id', uid).order('last_message_at', { ascending: false }));
}
export async function getTicket(id: number): Promise<SupportTicket | null> {
  return check(await supabase.from('support_tickets').select('*').eq('id', id).maybeSingle());
}
export async function getTicketMessages(id: number): Promise<SupportMessage[]> {
  return check(await supabase.from('support_messages').select('*').eq('ticket_id', id).order('created_at'));
}
export async function openTicket(subject: string): Promise<SupportTicket> {
  return check(await supabase.from('support_tickets').insert({ subject: subject.trim() }).select().single());
}
export async function sendSupportMessage(ticketId: number, body: string, imagePath?: string | null) {
  check(await supabase.from('support_messages').insert({ ticket_id: ticketId, body: body.trim(), image_path: imagePath ?? null }));
}
/** صور الدعم في حاوية خاصة: المسار <user_id>/<ticket_id>/<ملف> */
export async function uploadSupportImage(uid: string, ticketId: number, uri: string, mime = 'image/jpeg'): Promise<string> {
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${uid}/${ticketId}/${Date.now()}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  check(await supabase.storage.from('support').upload(path, body, { contentType: mime, upsert: false }));
  return path;
}
export async function supportImageUrl(path: string): Promise<string> {
  const r = await supabase.storage.from('support').createSignedUrl(path, 600);
  if (r.error) throw new Error(r.error.message);
  return r.data.signedUrl;
}
export async function adminTickets(status?: TicketStatus): Promise<SupportTicket[]> {
  let q = supabase.from('support_tickets').select('*');
  if (status) q = q.eq('status', status);
  return check(await q.order('last_message_at', { ascending: false }).limit(300));
}
export async function adminSetTicketStatus(id: number, status: TicketStatus) {
  check(await supabase.from('support_tickets').update({ status }).eq('id', id));
}

// ===== الحساب: التسجيل برقم الهاتف وحذف الحساب =====
/** يرسل رمز تحقق SMS حقيقياً عبر مزود الرسائل المضبوط في Supabase Auth (لا رموز وهمية في التطبيق) */
export async function sendPhoneOtp(local8: string) {
  const { error } = await supabase.auth.signInWithOtp({ phone: '+965' + local8 });
  if (error) throw error;
}
export async function verifyPhoneOtp(local8: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({ phone: '+965' + local8, token, type: 'sms' });
  if (error) throw error;
  return data.session;
}
export async function deleteMyAccount() {
  check(await supabase.rpc('delete_my_account'));
}
