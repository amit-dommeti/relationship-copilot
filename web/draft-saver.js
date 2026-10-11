// Keep the latest edit until it is acknowledged, including an empty draft.
export function createDraftSaver(save, onChange = () => {}) {
  const pending = new Map();
  const revisions = new Map();
  let writing = null;

  async function drain() {
    while (pending.size) {
      const [id, edit] = pending.entries().next().value;
      edit.status = "saving";
      onChange(id);
      try {
        await save(id, edit.value);
      } catch (error) {
        // Every queued draft still needs attention when this batch stops.
        for (const [key, current] of pending) {
          current.status = "error";
          onChange(key);
        }
        throw error;
      }
      if (pending.get(id) === edit) pending.delete(id);
      onChange(id);
    }
  }

  return {
    stage(id, value) {
      revisions.set(id, (revisions.get(id) || 0) + 1);
      pending.set(id, { value, status: "pending" });
      onChange(id);
    },
    revision(id) {
      return revisions.get(id) || 0;
    },
    flush() {
      if (!writing) {
        writing = drain().finally(() => {
          writing = null;
        });
      }
      return writing;
    },
    status(id) {
      return pending.get(id)?.status || "saved";
    },
    hasUnsaved() {
      return pending.size > 0;
    },
  };
}
