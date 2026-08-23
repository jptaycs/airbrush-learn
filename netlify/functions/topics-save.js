import { checkAdminAuth } from './lib/adminAuth.js';

const REPO = 'jptaycs/airbrush-learn';
const FILE_PATH = 'src/data/topics.json';

export default async (req, context) => {
  const auth = await checkAdminAuth(req, context);
  if (!auth.ok) return auth.response;

  const { topic, sha } = await req.json();
  if (!topic || topic.id === undefined || topic.id === null) {
    return new Response('Missing topic.id', { status: 400 });
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

  // GitHub's Contents API omits `content` (sends `download_url` instead)
  // once a file crosses ~1MB — without this check, Buffer.from(undefined,
  // ...) throws and the function 500s with no actionable message.
  if (!getData.content) {
    return new Response('topics.json is too large for the GitHub Contents API to return inline', { status: 502 });
  }
  const current = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf-8'));
  const idx = current.findIndex((t) => t.id === topic.id);
  if (idx === -1) {
    current.push(topic);
  } else {
    current[idx] = topic;
  }

  const newContent = Buffer.from(JSON.stringify(current, null, 2) + '\n', 'utf-8').toString('base64');
  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Topics: update topic #${topic.id}`,
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
