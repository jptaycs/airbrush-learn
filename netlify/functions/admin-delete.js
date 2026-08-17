const REPO = 'jptaycs/airbrush-learn';
const FILE_PATH = 'src/data/articles.json';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { slug, sha } = await req.json();
  if (!slug) {
    return new Response('Missing slug', { status: 400 });
  }

  const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!getRes.ok) {
    return new Response('Failed to fetch current articles.json from GitHub', { status: 502 });
  }

  const getData = await getRes.json();

  if (getData.sha !== sha) {
    return new Response('This file changed since you loaded it — refresh and try again.', { status: 409 });
  }

  const current = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf-8'));
  const next = current.filter((a) => a.slug !== slug);

  const newContent = Buffer.from(JSON.stringify(next, null, 2) + '\n', 'utf-8').toString('base64');
  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Admin: delete article ${slug}`,
      content: newContent,
      sha: getData.sha,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    return new Response(`Failed to delete: ${err}`, { status: 502 });
  }

  // Best-effort cleanup of the hero image — a missing/failed image delete
  // shouldn't fail the article delete, which already succeeded above.
  const imagePath = `public/images/${slug}.png`;
  const imageGetRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${imagePath}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (imageGetRes.ok) {
    const imageData = await imageGetRes.json();
    await fetch(`https://api.github.com/repos/${REPO}/contents/${imagePath}`, {
      method: 'DELETE',
      headers: {
        Authorization: `token ${process.env.GITHUB_PAT}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Admin: delete hero image for ${slug}`,
        sha: imageData.sha,
      }),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
