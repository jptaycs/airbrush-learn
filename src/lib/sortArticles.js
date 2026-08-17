// Sorts articles newest-first. published_date is date-only (no time-of-day),
// so multiple articles sharing the same date is common — both n8n's pipeline
// and the admin panel append new entries to the end of articles.json, so on a
// tie we treat later array position as more recently published rather than
// falling back to plain sort stability (which would keep the tied group in
// its original, oldest-first order and bury the newest entry).
export function sortArticlesNewestFirst(articles) {
  return articles
    .map((article, index) => ({ article, index }))
    .sort((a, b) => {
      if (a.article.published_date !== b.article.published_date) {
        return a.article.published_date < b.article.published_date ? 1 : -1;
      }
      return b.index - a.index;
    })
    .map(({ article }) => article);
}
