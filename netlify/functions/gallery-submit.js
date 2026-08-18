import { getStore } from '@netlify/blobs';
import { galleryCategories } from '../../src/data/galleryCategories.js';
import { updateGalleryIndex } from './lib/galleryIndex.js';
import { SHOW_GALLERY } from '../../src/lib/featureFlags.js';

const VALID_DISCIPLINES = galleryCategories.map((c) => c.slug);
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 4 * 1024 * 1024;
const MAX_PENDING = 50;

const okResponse = () =>
  new Response(JSON.stringify({ ok: true, message: 'Thanks — your submission is under review.' }), {
    headers: { 'content-type': 'application/json' },
  });

const errorResponse = (error, status) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  // The gallery feature (including its admin review tab) is paused — see
  // src/lib/featureFlags.js. Reject before touching the blob store at all,
  // so nothing queues up with nowhere to be reviewed.
  if (!SHOW_GALLERY) {
    return errorResponse('Submissions are paused right now — check back later.', 403);
  }

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse('Invalid form submission', 400);
  }

  // Honeypot: if filled, pretend success but store nothing.
  const honeypot = formData.get('website');
  if (honeypot) {
    return okResponse();
  }

  const title = formData.get('title');
  const artistName = formData.get('artistName');
  const discipline = formData.get('discipline');
  const email = formData.get('email');
  const rights = formData.get('rights');
  const image = formData.get('image');

  if (!title || !artistName || !discipline || !email || !rights || !image) {
    return errorResponse('All fields are required.', 400);
  }
  if (!VALID_DISCIPLINES.includes(discipline)) {
    return errorResponse('Invalid discipline.', 400);
  }
  if (!(image instanceof File) || !VALID_TYPES.includes(image.type)) {
    return errorResponse('Image must be JPEG, PNG, or WebP.', 400);
  }
  if (image.size > MAX_SIZE) {
    return errorResponse('Image must be 4MB or smaller.', 400);
  }

  const store = getStore({ name: 'gallery-pending', consistency: 'strong' });

  const existingIndex = (await store.get('index', { type: 'json' })) || [];
  if (existingIndex.length >= MAX_PENDING) {
    return errorResponse('The review queue is currently full. Please try again later.', 429);
  }

  const id = crypto.randomUUID();
  const imageBuffer = await image.arrayBuffer();

  await store.set(`${id}/image`, imageBuffer);
  await store.setJSON(`${id}/meta`, {
    id,
    title: String(title),
    artistName: String(artistName),
    discipline: String(discipline),
    email: String(email),
    submittedAt: new Date().toISOString(),
    contentType: image.type,
  });

  await updateGalleryIndex(store, (index) => [...index, id]);

  return okResponse();
};
