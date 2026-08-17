import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const store = getStore('gallery-pending');
  await store.delete(`${id}/meta`);
  await store.delete(`${id}/image`);
  const index = (await store.get('index', { type: 'json' })) || [];
  await store.setJSON('index', index.filter((x) => x !== id));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
