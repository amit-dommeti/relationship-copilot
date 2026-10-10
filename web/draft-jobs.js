// A response belongs to one contact and one workspace session, not the open drawer.
export function createDraftJobs() {
  const pending = new Map();
  return {
    begin(contactId) {
      if (pending.has(contactId)) return null;
      const job = { contactId, valid: true };
      pending.set(contactId, job);
      return job;
    },
    isBusy(contactId) {
      return pending.has(contactId);
    },
    isCurrent(job) {
      return pending.get(job.contactId) === job && job.valid;
    },
    invalidate(contactId) {
      const job = pending.get(contactId);
      if (job) job.valid = false;
    },
    finish(job) {
      if (pending.get(job.contactId) === job) pending.delete(job.contactId);
    },
    reset() {
      pending.clear();
    },
  };
}
