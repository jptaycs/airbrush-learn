import { getStore } from '@netlify/blobs';
import { updateGalleryIndex } from './lib/galleryIndex.js';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const store = getStore({ name: 'gallery-pending', consistency: 'strong' });
  await store.delete(`${id}/meta`);
  await store.delete(`${id}/image`);
  await updateGalleryIndex(store, (index) => index.filter((x) => x !== id));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
