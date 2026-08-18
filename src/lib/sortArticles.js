// Sorts articles newest-first. published_date is date-only (no time-of-day),
// so multiple articles sharing the same date is common — both n8n's pipeline
// and the admin panel append new entries to the end of articles.json, so on a
// tie we treat later array position as more recently published rather than
// falling back to plain sort stability (which would keep the tied group in
// its original, oldest-first order and bury the newest entry).
export function sortArticlesNewestFirst(articles) {
  // A missing/empty published_date must sort as oldest, not newest: comparing
  // undefined with < or > always evaluates false regardless of which side
  // it's on, so without this fallback an article missing the field would
  // win the "a.date < b.date" check both ways and always sort to the top.
  const dateOf = (article) => article.published_date || '';
  return articles
    .map((article, index) => ({ article, index }))
    .sort((a, b) => {
      const dateA = dateOf(a.article);
      const dateB = dateOf(b.article);
      if (dateA !== dateB) {
        return dateA < dateB ? 1 : -1;
      }
      return b.index - a.index;
    })
    .map(({ article }) => article);
}
