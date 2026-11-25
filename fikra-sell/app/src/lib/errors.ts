import type { TKey } from '../i18n';

/**
 * Normalises Supabase / network errors into a translation key plus vars,
 * so every failure shows a clear Arabic (or English) message.
 */
export type AppError = { key: TKey; vars?: Record<string, string>; retryAfter?: number };

const KNOWN = new Set([
  'disposable_email', 'signup_rate_limited', 'auth_required', 'account_banned', 'daily_ad_limit', 'posting_too_fast',
  'duplicate_ad', 'choose_subcategory', 'invalid_category', 'invalid_area', 'price_required', 'phone_required',
  'contact_method_required', 'too_many_images', 'bump_cooldown', 'renew_not_needed', 'blocked', 'chat_disabled', 'own_ad',
  'sending_too_fast', 'reporting_too_fast', 'invalid_status_change', 'sold_ad_locked', 'payments_disabled',
  'cannot_report_self', 'editing_too_fast', 'too_many_conversations', 'saved_search_limit', 'too_many_tickets',
  'owner_cannot_delete', 'forbidden', 'not_found', 'ad_not_found',
]);

export function toAppError(e: unknown): AppError {
  const err = e as { message?: string; code?: string; status?: number; name?: string } | null;
  const msg = (err?.message ?? String(e ?? '')).trim();
  const code = err?.code ?? '';

  if (/network request failed|failed to fetch|fetch failed|timeout|ERR_NETWORK/i.test(msg)) return { key: 'errors.network' };

  // Supabase Auth error codes
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return { key: 'errors.invalid_credentials' };
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(msg)) return { key: 'errors.email_exists' };
  if (code === 'weak_password' || /password should/i.test(msg)) return { key: 'errors.weak_password' };
  if (code === 'same_password') return { key: 'errors.same_password' };
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || err?.status === 429)
    return { key: 'errors.over_request_rate_limit' };
  if (/disposable_email/.test(msg)) return { key: 'errors.disposable_email' };
  if (/signup_rate_limited/.test(msg)) return { key: 'errors.signup_rate_limited' };
  if (/Database error saving new user/i.test(msg)) return { key: 'errors.disposable_email' };

  // Database (PostgREST) errors raised by our functions/triggers
  const field = msg.match(/^(missing_field|invalid_option|out_of_range|invalid_number):(\w+)/);
  if (field) return { key: (`errors.${field[1] === 'invalid_number' ? 'invalid_option' : field[1]}`) as TKey, vars: { field: field[2] } };
  if (KNOWN.has(msg)) return { key: `errors.${msg}` as TKey };
  if (/row-level security|permission denied/i.test(msg)) return { key: 'errors.forbidden' };
  if (/duplicate key.*reports_once/i.test(msg)) return { key: 'report.alreadyReported' };
  return { key: 'errors.generic' };
}
