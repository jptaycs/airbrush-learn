import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const store = getStore({ name: 'gallery-pending', consistency: 'strong' });
  const index = (await store.get('index', { type: 'json' })) || [];

  // Must match gallery-submit.js's MAX_PENDING — otherwise a backlog beyond
  // this cap is invisible to the admin until the front of the queue clears,
  // even though the queue can hold more than this.
  const MAX_RETURNED = 50;
  const submissions = [];
  for (const id of index.slice(0, MAX_RETURNED)) {
    const meta = await store.get(`${id}/meta`, { type: 'json' });
    if (!meta) continue;
    const imageBuffer = await store.get(`${id}/image`, { type: 'arrayBuffer' });
    if (!imageBuffer) continue;
    const base64 = Buffer.from(imageBuffer).toString('base64');
    submissions.push({
      ...meta,
      imageDataUrl: `data:${meta.contentType};base64,${base64}`,
    });
  }

  return new Response(JSON.stringify({ submissions }), {
    headers: { 'content-type': 'application/json' },
  });
};
