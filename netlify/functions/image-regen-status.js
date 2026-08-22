import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) {
    return new Response('Missing slug', { status: 400 });
  }

  const store = getStore({ name: 'image-regen', consistency: 'strong' });
  const record = await store.get(slug, { type: 'json' });

  // No record yet doesn't distinguish "never started" from "background
  // function hasn't written its first status update yet" — the admin UI
  // treats both as still-pending and keeps polling either way.
  return new Response(JSON.stringify(record || { status: 'pending' }), {
    headers: { 'content-type': 'application/json' },
  });
};
