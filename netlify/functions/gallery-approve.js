import { getStore } from '@netlify/blobs';

const REPO = 'jptaycs/airbrush-learn';
const GALLERY_PATH = 'src/data/gallery.json';

const slugify = (str) =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const extFor = (contentType) => {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
};

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const store = getStore({ name: 'gallery-pending', consistency: 'strong' });
  const meta = await store.get(`${id}/meta`, { type: 'json' });
  const imageBuffer = await store.get(`${id}/image`, { type: 'arrayBuffer' });
  if (!meta || !imageBuffer) {
    return new Response('Submission not found', { status: 404 });
  }

  const ext = extFor(meta.contentType);
  const slug = `${slugify(meta.title)}-${id.slice(0, 8)}`;
  const imagePath = `public/images/gallery/${slug}.${ext}`;
  const imageBase64 = Buffer.from(imageBuffer).toString('base64');

  const imagePutRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${imagePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Gallery: add image for ${slug}`,
      content: imageBase64,
    }),
  });
  if (!imagePutRes.ok) {
    const err = await imagePutRes.text();
    return new Response(`Failed to commit image: ${err}`, { status: 502 });
  }

  const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${GALLERY_PATH}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!getRes.ok) {
    return new Response('Failed to fetch current gallery.json from GitHub', { status: 502 });
  }
  const getData = await getRes.json();
  const current = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf-8'));

  current.push({
    slug,
    title: meta.title,
    category: meta.discipline,
    image: `${slug}.${ext}`,
    credit: meta.artistName,
  });

  const newContent = Buffer.from(JSON.stringify(current, null, 2) + '\n', 'utf-8').toString('base64');
  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${GALLERY_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Gallery: approve submission ${slug}`,
      content: newContent,
      sha: getData.sha,
    }),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    return new Response(`Failed to save gallery.json: ${err}`, { status: 502 });
  }

  await store.delete(`${id}/meta`);
  await store.delete(`${id}/image`);
  const index = (await store.get('index', { type: 'json' })) || [];
  await store.setJSON('index', index.filter((x) => x !== id));

  return new Response(JSON.stringify({ ok: true, slug }), {
    headers: { 'content-type': 'application/json' },
  });
};
