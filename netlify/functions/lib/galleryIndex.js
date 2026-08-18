// Shared compare-and-swap helper for the gallery pending-submissions
// "index" blob (the list of ids waiting for admin review).
//
// gallery-submit.js, gallery-approve.js, and gallery-reject.js all used to
// do a plain get -> mutate -> setJSON on this same key with no concurrency
// check. Two admin actions (or a submit racing an admin action) landing at
// the same time would silently lose whichever write finished last -- e.g.
// approving submission A and rejecting submission B at nearly the same
// moment could leave B's already-deleted id still listed in the index
// forever, permanently occupying a slot nothing can ever act on again.
//
// @netlify/blobs supports optimistic concurrency via etags (onlyIfMatch /
// onlyIfNew), so this retries a bounded number of times against a fresh
// read whenever it loses the race, instead of blindly overwriting.
export async function updateGalleryIndex(store, mutate, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const current = await store.getWithMetadata('index', { type: 'json' });
    const index = current?.data || [];
    const next = mutate(index);
    const result = await store.setJSON(
      'index',
      next,
      current ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
    );
    if (result.modified) return next;
    // Someone else wrote to `index` between our read and our write --
    // loop and retry against the now-current data.
  }
  throw new Error('Could not update the gallery submissions index (too many concurrent writes) — try again');
}
