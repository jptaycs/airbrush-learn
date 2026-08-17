// Sorts articles newest-first by published_date (ISO date strings sort
// correctly with plain string comparison). Ties resolve to 0, satisfying the
// comparator contract — the earlier `< ? 1 : -1` version returned -1 for
// equal dates, which is invalid and only bites once dates collide.
export function byPublishedDateDesc(a, b) {
  if (a.published_date === b.published_date) return 0;
  return a.published_date < b.published_date ? 1 : -1;
}
