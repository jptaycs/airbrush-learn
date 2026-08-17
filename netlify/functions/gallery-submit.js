import { getStore } from '@netlify/blobs';

const VALID_DISCIPLINES = [
  'automotive', 'fine-art', 'miniatures', 'cosplay', 'fabric', 'scale-models',
  'body-art', 'guitars', 'murals', 'nail-art', 'helmets', 'skateboards',
  'diecast-cars', 'toy-soldiers', 'wooden-toys', 'nesting-dolls', 'carousel-figures',
];
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 8 * 1024 * 1024;

const okResponse = () =>
  new Response(JSON.stringify({ ok: true, message: 'Thanks — your submission is under review.' }), {
    headers: { 'content-type': 'application/json' },
  });

const errorResponse = (error, status) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
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
    return errorResponse('Image must be 8MB or smaller.', 400);
  }

  const id = crypto.randomUUID();
  const store = getStore('gallery-pending');
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

  const index = (await store.get('index', { type: 'json' })) || [];
  index.push(id);
  await store.setJSON('index', index);

  return okResponse();
};
