// Converts external <a href> links already present in content_html into
// Wikipedia-style numbered footnotes: a small superscript "[n]" is added
// after each citation link, pointing to a "References" section appended
// to the end of the article. The original inline link is left untouched.
// Only plain `<a href="...">text</a>` tags are matched (no nested tags
// inside the anchor) — sufficient for the simple prose content_html
// produces; anything more complex is left as-is.
const LINK_RE = /<a\s+([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>(.*?)<\/a>/gi;

function stripTags(html) {
  return String(html).replace(/<[^>]*>/g, '').trim();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function addFootnotes(html) {
  const source = String(html || '');
  const hrefToNum = new Map();
  const refs = [];

  const withFootnotes = source.replace(LINK_RE, (match, before, href, after, text) => {
    let num = hrefToNum.get(href);
    if (!num) {
      num = refs.length + 1;
      hrefToNum.set(href, num);
      refs.push({ href, text: stripTags(text) });
    }
    return `${match}<sup class="citation not-prose text-[0.7em] ml-0.5"><a id="cite-${num}" href="#ref-${num}" class="text-accent no-underline hover:underline">[${num}]</a></sup>`;
  });

  if (refs.length === 0) return source;

  const items = refs
    .map(
      (ref, i) =>
        `<li id="ref-${i + 1}">${escapeHtml(ref.text)} — <a href="${ref.href}" target="_blank" rel="noopener noreferrer">${escapeHtml(ref.href)}</a> <a href="#cite-${i + 1}" class="not-prose text-[0.8em] no-underline">↩</a></li>`
    )
    .join('\n');

  return `${withFootnotes}\n<h2>References</h2>\n<ol class="citations-list text-[0.9em]">\n${items}\n</ol>`;
}
