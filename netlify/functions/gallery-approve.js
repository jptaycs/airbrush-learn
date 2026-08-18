import { getStore } from '@netlify/blobs';
import { updateGalleryIndex } from './lib/galleryIndex.js';

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
  // A title that slugifies to '' (e.g. punctuation-only) would otherwise
  // produce a leading-dash slug like "-a1b2c3d4".
  const titleSlug = slugify(meta.title);
  const slug = titleSlug ? `${titleSlug}-${id.slice(0, 8)}` : id.slice(0, 8);
  const imagePath = `public/images/gallery/${slug}.${ext}`;
  const imageBase64 = Buffer.from(imageBuffer).toString('base64');

  // The pending submission (and its deterministic slug) isn't removed from
  // the blob store until the whole approval succeeds, so a retry after any
  // failure below reaches this same path again. GitHub's Contents API
  // requires the current sha to update a file that already exists, so
  // check for one first — without this, a retry after a partial failure
  // 422s here forever and the approval is stuck for good.
  const existingImageRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${imagePath}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });
  const existingImageSha = existingImageRes.ok ? (await existingImageRes.json()).sha : undefined;

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
      ...(existingImageSha ? { sha: existingImageSha } : {}),
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
  // GitHub's Contents API omits `content` (sends `download_url` instead)
  // once a file crosses ~1MB — without this check, Buffer.from(undefined,
  // ...) throws and the function 500s with no actionable message.
  if (!getData.content) {
    return new Response('gallery.json is too large for the GitHub Contents API to return inline', { status: 502 });
  }
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
  await updateGalleryIndex(store, (index) => index.filter((x) => x !== id));

  return new Response(JSON.stringify({ ok: true, slug }), {
    headers: { 'content-type': 'application/json' },
  });
};
