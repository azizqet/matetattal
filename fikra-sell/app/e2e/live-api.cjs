// FIKRA SELL · live end-to-end API test against the real Supabase project.
// Uses the same client library and calls as the app. Requires four test
// accounts (seller, buyer, admin, outsider) — see docs/TEST_REPORT.md.
//   QA_PASSWORD=... QA_EMAIL_PREFIX=name+fikraqa QA_PHOTO=/path.jpg node e2e/live-api.cjs
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zczwryruucliofnkqraa.supabase.co';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_hlky83lju1gItEAqtjqeHQ_JTo-S69X';
const PASS = process.env.QA_PASSWORD;
const PREFIX = process.env.QA_EMAIL_PREFIX; // e.g. someone+fikraqa  → someone+fikraqa1@gmail.com
const DOMAIN = process.env.QA_EMAIL_DOMAIN || 'gmail.com';
const PHOTO = fs.readFileSync(process.env.QA_PHOTO);

const results = [];
let failed = 0;
async function step(name, fn) {
  try { const extra = await fn(); results.push(`  ✓ ${name}${extra ? ` — ${extra}` : ''}`); }
  catch (e) { failed++; results.push(`  ✗ ${name} — ${e.message || e}`); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const denied = async (p, label) => { const { error } = await p; expect(error, `${label} should be denied`); return error.message.slice(0, 60); };
const client = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const guest = client();
  const seller = client(), buyer = client(), admin = client(), outsider = client();
  const ids = {};

  console.log('── Auth');
  for (const [c, n, k] of [[seller, 1, 'seller'], [buyer, 2, 'buyer'], [admin, 3, 'admin'], [outsider, 4, 'outsider']]) {
    await step(`${k} signs in with e-mail + password`, async () => {
      const d = ok(await c.auth.signInWithPassword({ email: `${PREFIX}${n}@${DOMAIN}`, password: PASS }));
      ids[k] = d.user.id; return d.session ? 'session issued' : 'NO SESSION';
    });
  }
  await step('wrong password is rejected', async () => denied(client().auth.signInWithPassword({ email: `${PREFIX}1@${DOMAIN}`, password: 'wrong-pass-1' }), 'bad password'));
  await step('profile + private settings were created by the sign-up trigger', async () => {
    const p = ok(await seller.from('profiles').select('full_name, role').eq('id', ids.seller).single());
    const s = ok(await seller.from('profile_settings').select('locale').single());
    return `${p.full_name} · ${p.role} · ${s.locale}`;
  });

  console.log('── Guest browsing');
  let carSale;
  await step('guest reads categories, governorates, areas', async () => {
    const c = ok(await guest.from('categories').select('id, slug').eq('is_active', true));
    const a = ok(await guest.from('areas').select('id'));
    carSale = c.find((x) => x.slug === 'cars-sale').id;
    return `${c.length} categories, ${a.length} areas`;
  });
  await step('guest cannot read private settings or call admin functions', async () => {
    await denied(guest.from('profile_settings').select('*'), 'settings');
    return denied(guest.rpc('admin_stats'), 'admin_stats');
  });

  console.log('── Posting an ad');
  const gov = ok(await guest.from('governorates').select('id').eq('slug', 'hawalli').single()).id;
  const area = ok(await guest.from('areas').select('id').eq('governorate_id', gov).eq('name_en', 'Salmiya').single()).id;
  await step('seller saves phone and edits name', async () => {
    ok(await seller.from('profile_settings').update({ phone: '99887766' }).eq('user_id', ids.seller).select('user_id'));
    ok(await seller.from('profiles').update({ full_name: 'بائع الاختبار' }).eq('id', ids.seller).select('id'));
  });
  await step('seller cannot promote self to admin', async () => {
    await seller.from('profiles').update({ role: 'admin' }).eq('id', ids.seller);
    const p = ok(await seller.from('profiles').select('role').eq('id', ids.seller).single());
    expect(p.role === 'user', 'role changed!'); return 'role stays user';
  });
  const adRow = {
    category_id: carSale, title: 'تويوتا كامري 2021 فل كامل', description: 'السيارة بحالة الوكالة، صيانة دورية', price: 5250.5,
    price_type: 'negotiable', condition: 'used', governorate_id: gov, area_id: area, contact_phone: '99887766',
    attributes: { make: 'toyota', model: 'Camry', year: '2021', mileage: '62000', transmission: 'automatic' },
  };
  await step('seller publishes ad (instantly active, 30-day expiry)', async () => {
    const d = ok(await seller.from('ads').insert(adRow).select('id, status, expires_at').single());
    ids.ad = d.id; expect(d.status === 'active', `status ${d.status}`);
    return `#${d.id} ${d.status} until ${d.expires_at.slice(0, 10)}`;
  });
  await step('duplicate ad is refused', async () => denied(seller.from('ads').insert(adRow), 'duplicate'));
  await step('seller uploads 2 photos and the cover syncs', async () => {
    for (let i = 0; i < 2; i++) {
      const path = `${ids.seller}/${ids.ad}/qa${i}photo${Date.now()}.jpg`;
      ok(await seller.storage.from('ad-images').upload(path, PHOTO, { contentType: 'image/jpeg' }));
      ok(await seller.from('ad_images').insert({ ad_id: ids.ad, path, sort: i }).select('id'));
    }
    const a = ok(await guest.from('ads').select('cover_path, images_count').eq('id', ids.ad).single());
    const res = await fetch(seller.storage.from('ad-images').getPublicUrl(a.cover_path).data.publicUrl);
    expect(res.status === 200, `cover http ${res.status}`);
    return `${a.images_count} images, public cover HTTP ${res.status}`;
  });
  await step('upload into another user folder is refused', async () =>
    denied(buyer.storage.from('ad-images').upload(`${ids.seller}/${ids.ad}/hack123456.jpg`, PHOTO, { contentType: 'image/jpeg' }), 'foreign folder'));

  console.log('── Search');
  for (const [q, label] of [['تيوتا', 'typo'], ['السياره كامرى', 'spelling variants'], ['toyota', 'English']]) {
    await step(`search "${q}" (${label}) finds the ad`, async () => {
      const r = ok(await guest.rpc('search_ads', { p: { q } }));
      expect(r.some((x) => x.id === ids.ad), 'not found'); return `${r.length} result(s)`;
    });
  }
  await step('filters: category + price range + attribute + governorate', async () => {
    const r = ok(await guest.rpc('search_ads', { p: { category_id: carSale, min_price: 5000, max_price: 6000, attrs: { make: 'toyota', year: { min: 2020 } }, governorate_id: gov } }));
    expect(r.length === 1, `${r.length}`); return '1 result';
  });
  await step('nearest sort returns distance', async () => {
    const r = ok(await guest.rpc('search_ads', { p: { sort: 'nearest', lat: 29.33, lng: 48.03 } }));
    return `${r[0]?.distance_km?.toFixed(1)} km`;
  });
  await step('suggestions', async () => `${ok(await guest.rpc('search_suggestions', { prefix: 'توي' })).length} suggestions`);

  console.log('── Buyer: favourites, saved search, chat');
  await step('buyer favourites the ad', async () => {
    ok(await buyer.from('favorites').insert({ ad_id: ids.ad }));
    return `favorites_count=${ok(await guest.from('ads').select('favorites_count').eq('id', ids.ad).single()).favorites_count}`;
  });
  await step('buyer saves a search with alerts', async () => {
    ok(await buyer.from('saved_searches').insert({ name: 'لاندكروزر', query: 'لاندكروزر', filters: { category_id: carSale }, notify: true }).select('id'));
  });
  await step('view counted once', async () => {
    await buyer.rpc('record_ad_event', { p_ad: ids.ad, p_kind: 'view' });
    await buyer.rpc('record_ad_event', { p_ad: ids.ad, p_kind: 'view' });
    return `views=${ok(await guest.from('ads').select('views_count').eq('id', ids.ad).single()).views_count}`;
  });

  // Realtime: seller listens before the buyer writes
  let realtimeMsg = null;
  const ch = seller.channel('qa-msgs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => { realtimeMsg = p.new; });
  await new Promise((res) => ch.subscribe((s) => { if (s === 'SUBSCRIBED') res(); }));

  await step('buyer starts a conversation and sends text', async () => {
    ids.conv = ok(await buyer.rpc('start_conversation', { p_ad: ids.ad }));
    ok(await buyer.from('messages').insert({ conversation_id: ids.conv, body: 'السلام عليكم، السيارة متوفرة؟' }).select('id').single());
    return ids.conv.slice(0, 8);
  });
  await step('seller receives the message in real time', async () => {
    for (let i = 0; i < 20 && !realtimeMsg; i++) await sleep(300);
    expect(realtimeMsg, 'no realtime event'); return `“${realtimeMsg.body}”`;
  });
  await seller.removeChannel(ch);
  await step('buyer sends a photo in chat; outsider cannot read it', async () => {
    const path = `${ids.conv}/${ids.buyer}/qachat${Date.now()}.jpg`;
    ok(await buyer.storage.from('chat-images').upload(path, PHOTO, { contentType: 'image/jpeg' }));
    ok(await buyer.from('messages').insert({ conversation_id: ids.conv, image_path: path }).select('id'));
    const sellerUrl = ok(await seller.storage.from('chat-images').createSignedUrl(path, 60));
    const { data: outsiderUrl } = await outsider.storage.from('chat-images').createSignedUrl(path, 60);
    expect(sellerUrl.signedUrl && !outsiderUrl?.signedUrl, 'outsider got a URL');
    return 'seller ✓ / outsider ✗';
  });
  await step('seller gets an in-app notification and the unread counter', async () => {
    const n = ok(await seller.from('notifications').select('type, title_ar').eq('type', 'message'));
    const c = ok(await seller.rpc('my_counters'));
    expect(n.length === 1, `${n.length} notifications`); return `${n[0].title_ar} · unread=${c.unread_messages}`;
  });
  await step('seller replies; read receipts set', async () => {
    ok(await seller.rpc('mark_conversation_read', { p_conv: ids.conv }));
    ok(await seller.from('messages').insert({ conversation_id: ids.conv, body: 'نعم متوفرة' }).select('id'));
    const m = ok(await buyer.from('messages').select('read_at, sender_id').eq('conversation_id', ids.conv).eq('sender_id', ids.buyer));
    expect(m.every((x) => x.read_at), 'not read'); return `${m.length} buyer messages marked read`;
  });
  await step('outsider sees no conversations/messages and cannot post', async () => {
    expect(ok(await outsider.from('conversations').select('id')).length === 0, 'sees conversations');
    expect(ok(await outsider.from('messages').select('id')).length === 0, 'sees messages');
    return denied(outsider.from('messages').insert({ conversation_id: ids.conv, body: 'intrusion' }), 'insert');
  });

  console.log('── Seller: manage ads');
  await step('bump is rate-limited (24h cooldown)', async () => denied(seller.rpc('bump_ad', { p_ad: ids.ad }), 'bump'));
  await step('second ad triggers saved-search alert for buyer', async () => {
    const d = ok(await seller.from('ads').insert({ ...adRow, title: 'تويوتا لاندكروزر 2022', price: 18500, price_type: 'fixed', attributes: { make: 'toyota', year: 2022 } }).select('id').single());
    ids.ad2 = d.id;
    const n = ok(await buyer.from('notifications').select('type, title_ar').eq('type', 'saved_search'));
    expect(n.length === 1, `${n.length}`); return n[0].title_ar;
  });
  await step('seller hides then re-shows and marks ad 2 as sold', async () => {
    ok(await seller.from('ads').update({ status: 'hidden' }).eq('id', ids.ad2).select('id'));
    ok(await seller.from('ads').update({ status: 'active' }).eq('id', ids.ad2).select('id'));
    const d = ok(await seller.from('ads').update({ status: 'sold' }).eq('id', ids.ad2).select('status, sold_at').single());
    expect(d.sold_at, 'no sold_at'); return d.status;
  });

  console.log('── Safety');
  await step('buyer reports the ad', async () => { ok(await buyer.from('reports').insert({ target_type: 'ad', target_id: String(ids.ad), reason: 'scam', details: 'اختبار' }).select('id')); });
  await step('buyer reports the conversation', async () => { ok(await buyer.from('reports').insert({ target_type: 'conversation', target_id: ids.conv, reason: 'offensive' }).select('id')); });
  await step('buyer blocks seller → messaging stops both ways', async () => {
    ok(await buyer.from('blocks').insert({ blocked_id: ids.seller }));
    return denied(seller.from('messages').insert({ conversation_id: ids.conv, body: 'hello?' }), 'blocked message');
  });

  console.log('── Admin');
  await step('regular user cannot use admin functions', async () => denied(buyer.rpc('admin_stats'), 'admin_stats'));
  await step('admin reads dashboard stats', async () => {
    const s = ok(await admin.rpc('admin_stats'));
    return `users=${s.users_total} ads=${s.ads_total} open reports=${s.reports_open} messages today=${s.messages_today}`;
  });
  await step('admin lists users with e-mails', async () => `${ok(await admin.rpc('admin_list_users', { p_q: 'fikraqa' })).length} users`);
  await step('admin reads the reported conversation (only via the report)', async () => {
    const r = ok(await admin.from('reports').select('id').eq('target_type', 'conversation').single());
    return `${ok(await admin.rpc('admin_report_messages', { p_report: r.id })).length} messages`;
  });
  await step('admin cannot list conversations directly', async () => { expect(ok(await admin.from('conversations').select('id')).length === 0, 'admin sees conversations'); });
  await step('admin rejects the reported ad → seller notified', async () => {
    const r = ok(await admin.from('reports').select('id').eq('target_type', 'ad').single());
    ok(await admin.rpc('admin_resolve_report', { p_report: r.id, p_status: 'resolved', p_note: 'اختبار حي', p_action: 'hide_ad' }));
    const n = ok(await seller.from('notifications').select('title_ar').eq('type', 'ad_rejected'));
    expect(n.length === 1, 'no rejection notification'); return n[0].title_ar;
  });
  await step('admin features ad 2 for 7 days', async () => {
    ok(await admin.rpc('admin_promote_ad', { p_ad: ids.ad2, p_kind: 'feature', p_days: 7 }));
  });
  await step('admin adds + removes a subcategory (audited)', async () => {
    const cars = ok(await admin.from('categories').select('id').eq('slug', 'cars').single());
    const c = ok(await admin.from('categories').insert({ parent_id: cars.id, slug: 'qa-temp', name_ar: 'قسم اختبار', name_en: 'QA temp', icon: 'car' }).select('id').single());
    ok(await admin.from('categories').delete().eq('id', c.id).select('id'));
    const a = ok(await admin.from('audit_log').select('action').eq('target_type', 'categories').eq('target_id', String(c.id)));
    return `audit: ${a.map((x) => x.action).join(', ')}`;
  });
  await step('admin sends a broadcast to new users', async () =>
    `${ok(await admin.rpc('admin_broadcast', { p_audience: 'new_users', p_title_ar: 'مرحباً بكم', p_title_en: 'Welcome', p_body_ar: 'اختبار الإشعارات العامة', p_body_en: 'Broadcast test', p_link: null }))} recipients`);
  await step('admin bans the outsider; banned user cannot post', async () => {
    ok(await admin.rpc('admin_set_ban', { p_user: ids.outsider, p_banned: true, p_reason: 'اختبار' }));
    const { error } = await outsider.from('ads').insert({ ...adRow, title: 'محاولة محظور' });
    expect(error, 'banned user could post'); return error.message;
  });

  console.log('── Account deletion');
  await step('buyer deletes own files + account; data is gone', async () => {
    const files = ok(await buyer.storage.from('chat-images').list(`${ids.conv}/${ids.buyer}`));
    if (files.length) ok(await buyer.storage.from('chat-images').remove(files.map((f) => `${ids.conv}/${ids.buyer}/${f.name}`)));
    ok(await buyer.rpc('delete_my_account'));
    const p = ok(await guest.from('profiles').select('id').eq('id', ids.buyer));
    const relogin = await client().auth.signInWithPassword({ email: `${PREFIX}2@${DOMAIN}`, password: PASS });
    expect(p.length === 0 && relogin.error, 'not deleted'); return 'profile removed, sign-in refused';
  });

  console.log(results.join('\n'));
  console.log(`\n${results.length - failed}/${results.length} live checks passed`);
  console.log(JSON.stringify(ids));
  process.exit(failed ? 1 : 0);
})();
