export function createReplyBuffer() {
  const entries = new Map();
  const key = (workspace, contactId) => JSON.stringify([workspace, contactId]);
  const blank = () => ({ text: "", direction: "in" });
  const unsaved = (entry) => Boolean(entry.pending || entry.values.text.trim());

  function stage(workspace, contactId, values) {
    const id = key(workspace, contactId);
    let entry = entries.get(id);
    if (!entry) {
      entry = {
        workspace,
        contactId,
        values: blank(),
        revision: 0,
        pending: null,
        error: false,
      };
      entries.set(id, entry);
    }
    if (
      entry.values.text !== values.text ||
      entry.values.direction !== values.direction
    ) {
      entry.values = { text: values.text, direction: values.direction };
      entry.revision++;
      entry.error = false;
    }
    return entry;
  }

  return {
    stage,
    values(workspace, contactId) {
      return { ...(entries.get(key(workspace, contactId))?.values || blank()) };
    },
    status(workspace, contactId) {
      const entry = entries.get(key(workspace, contactId));
      return entry?.pending
        ? "saving"
        : entry?.error
          ? "error"
          : entry && unsaved(entry)
            ? "unsaved"
            : "idle";
    },
    begin(workspace, contactId, values) {
      const entry = stage(workspace, contactId, values);
      if (entry.pending) return null;
      const job = {
        workspace,
        contactId,
        values: { ...entry.values },
        revision: entry.revision,
      };
      entry.pending = job;
      entry.error = false;
      return job;
    },
    finish(job, success) {
      const id = key(job.workspace, job.contactId);
      const entry = entries.get(id);
      if (entry?.pending !== job) return false;
      entry.pending = null;
      entry.error = !success;
      // Acknowledgement applies only to the exact entry submitted, never newer typing.
      if (success && entry.revision === job.revision) {
        entries.delete(id);
        return true;
      }
      return false;
    },
    hasUnsaved: () => [...entries.values()].some(unsaved),
    firstUnsaved: (workspace) =>
      [...entries.values()].find((e) => e.workspace === workspace && unsaved(e))
        ?.contactId,
    hasPending: () => [...entries.values()].some((e) => e.pending),
  };
}
