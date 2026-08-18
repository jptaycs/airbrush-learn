const REPO = 'jptaycs/airbrush-learn';
const FILE_PATH = 'src/data/topics.json';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { order, sha } = await req.json();
  if (!Array.isArray(order) || order.length === 0) {
    return new Response('Missing order array', { status: 400 });
  }

  const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!getRes.ok) {
    return new Response('Failed to fetch current topics.json from GitHub', { status: 502 });
  }

  const getData = await getRes.json();

  if (getData.sha !== sha) {
    return new Response('This file changed since you loaded it — refresh and try again.', { status: 409 });
  }

  const current = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf-8'));

  if (order.length !== current.length || new Set(order).size !== current.length) {
    return new Response('order must include every topic id exactly once', { status: 400 });
  }

  const byId = new Map(current.map((t) => [t.id, t]));
  const reordered = order.map((id) => byId.get(id));
  if (reordered.some((t) => !t)) {
    return new Response('order references an unknown topic id', { status: 400 });
  }

  const newContent = Buffer.from(JSON.stringify(reordered, null, 2) + '\n', 'utf-8').toString('base64');
  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Topics: reorder queue',
      content: newContent,
      sha: getData.sha,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    return new Response(`Failed to save: ${err}`, { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
