import { getStore } from '@netlify/blobs';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Shared brute-force guard for /admin's single shared password. Every
// function that checks x-admin-password calls this first instead of
// comparing directly, so a lockout triggered against one endpoint (e.g.
// admin-list) also throttles guesses made against any other (e.g.
// topics-save) -- attempts are bucketed by IP in Netlify Blobs, the same
// storage this repo already uses for gallery submissions and image-regen
// status.
export async function checkAdminAuth(req, context) {
  const ip = context?.ip || 'unknown';
  const store = getStore({ name: 'admin-auth', consistency: 'strong' });
  const now = Date.now();

  const record = await store.get(ip, { type: 'json' });
  const windowActive = record && now - record.firstAttempt < WINDOW_MS;

  if (windowActive && record.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((record.firstAttempt + WINDOW_MS - now) / 1000);
    return {
      ok: false,
      response: new Response('Too many failed attempts. Try again later.', {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSec) },
      }),
    };
  }

  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    const next = windowActive
      ? { count: record.count + 1, firstAttempt: record.firstAttempt }
      : { count: 1, firstAttempt: now };
    await store.setJSON(ip, next);
    return { ok: false, response: new Response('Unauthorized', { status: 401 }) };
  }

  if (record) await store.delete(ip);
  return { ok: true };
}
