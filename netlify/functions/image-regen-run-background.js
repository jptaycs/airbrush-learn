import { getStore } from '@netlify/blobs';

// Background functions get their response discarded and always return 202 to
// the caller regardless of what this handler returns — status updates only
// reach the admin UI via image-regen-status.js polling the same Blobs store.
export const config = { background: true };

const REPO = 'jptaycs/airbrush-learn';
const ARTICLES_PATH = 'src/data/articles.json';

const githubHeaders = {
  Authorization: `token ${process.env.GITHUB_PAT}`,
  Accept: 'application/vnd.github+json',
};

async function generateImage(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPEN_AI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-2',
      prompt,
      size: '1536x1024',
      quality: 'high',
      n: 1,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI image generation failed: ${err}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI response did not include image data');
  }
  return b64;
}

async function commitImage(slug, base64) {
  const imagePath = `public/images/${slug}.png`;
  const existingRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${imagePath}`, {
    headers: githubHeaders,
  });
  const existingSha = existingRes.ok ? (await existingRes.json()).sha : undefined;

  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${imagePath}`, {
    method: 'PUT',
    headers: { ...githubHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Admin: regenerate image for ${slug}`,
      content: base64,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });
  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`Failed to commit image: ${err}`);
  }
}

// Only ever touches the one article's image_prompt field, so a single
// refetch-and-retry on a stale sha is safe — it can't clobber an unrelated
// concurrent edit to some other field the way blindly retrying a full
// article payload could.
async function savePromptField(slug, prompt, attempt = 1) {
  const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${ARTICLES_PATH}`, {
    headers: githubHeaders,
  });
  if (!getRes.ok) throw new Error('Failed to fetch current articles.json from GitHub');
  const getData = await getRes.json();
  if (!getData.content) throw new Error('articles.json is too large for the GitHub Contents API to return inline');
  const current = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf-8'));
  const idx = current.findIndex((a) => a.slug === slug);
  if (idx === -1) throw new Error(`Article ${slug} not found in articles.json`);

  current[idx] = { ...current[idx], image_prompt: prompt };
  const newContent = Buffer.from(JSON.stringify(current, null, 2) + '\n', 'utf-8').toString('base64');
  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${ARTICLES_PATH}`, {
    method: 'PUT',
    headers: { ...githubHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Admin: update image_prompt for ${slug}`,
      content: newContent,
      sha: getData.sha,
    }),
  });
  if (putRes.status === 409 && attempt === 1) {
    return savePromptField(slug, prompt, 2);
  }
  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`Failed to save image_prompt: ${err}`);
  }
}

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    // Response is discarded either way (background function), so there's
    // nothing useful to return here — just don't do the work.
    return;
  }

  const { slug, prompt } = await req.json();
  if (!slug || !prompt) return;

  const store = getStore({ name: 'image-regen', consistency: 'strong' });
  await store.setJSON(slug, { status: 'pending', updatedAt: Date.now() });

  let base64;
  try {
    base64 = await generateImage(prompt);
    await commitImage(slug, base64);
  } catch (err) {
    await store.setJSON(slug, { status: 'error', error: String(err.message || err), updatedAt: Date.now() });
    return;
  }

  // The image is the part that actually matters visually — if saving the
  // (reference-only) prompt field fails after the image already committed,
  // still report success, just flag it so the admin knows to re-save manually.
  let promptSaveFailed = false;
  try {
    await savePromptField(slug, prompt);
  } catch (err) {
    promptSaveFailed = true;
  }

  await store.setJSON(slug, {
    status: 'done',
    imageBase64: base64,
    imagePrompt: prompt,
    promptSaveFailed,
    updatedAt: Date.now(),
  });
};
