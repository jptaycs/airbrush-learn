// The public site always displays just the date, even though
// published_date can now carry an optional time component
// (YYYY-MM-DDTHH:mm, from the admin edit form's datetime-local input) —
// existing date-only articles (YYYY-MM-DD) pass through unchanged.
export function displayDate(publishedDate) {
  const value = String(publishedDate || '');
  const separatorIndex = value.indexOf('T');
  return separatorIndex === -1 ? value : value.slice(0, separatorIndex);
}
