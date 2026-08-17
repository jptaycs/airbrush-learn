const REPO = 'jptaycs/airbrush-learn';
const FILE_PATH = 'src/data/topics.json';

export default async (req) => {
  if (req.headers.get('x-admin-password') !== process.env.ADMIN_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`, {
    headers: {
      Authorization: `token ${process.env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) {
    return new Response('Failed to fetch topics.json from GitHub', { status: 502 });
  }

  const data = await res.json();
  const topics = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));

  return new Response(JSON.stringify({ topics, sha: data.sha }), {
    headers: { 'content-type': 'application/json' },
  });
};
