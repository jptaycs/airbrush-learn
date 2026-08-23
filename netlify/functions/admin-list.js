import { checkAdminAuth } from './lib/adminAuth.js';

const REPO = 'jptaycs/airbrush-learn';
const FILE_PATH = 'src/data/articles.json';

export default async (req, context) => {
  const auth = await checkAdminAuth(req, context);
  if (!auth.ok) return auth.response;

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) {
    return new Response('Failed to fetch articles.json from GitHub', { status: 502 });
  }

  const data = await res.json();
  // GitHub's Contents API omits `content` (and sends `download_url` instead)
  // once a file crosses ~1MB — without this check, Buffer.from(undefined, ...)
  // throws and the function 500s with no actionable message.
  if (!data.content) {
    return new Response('articles.json is too large for the GitHub Contents API to return inline', { status: 502 });
  }
  const articles = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));

  return new Response(JSON.stringify({ articles, sha: data.sha }), {
    headers: { 'content-type': 'application/json' },
  });
};
