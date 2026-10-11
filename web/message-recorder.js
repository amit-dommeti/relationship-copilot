export function createMessageRecorder(newId = () => crypto.randomUUID()) {
  const attempts = new Map();
  return {
    run(workspace, contactId, raw, send) {
      const key = JSON.stringify([workspace, contactId]);
      const values = { text: raw.text.trim(), direction: raw.direction };
      let attempt = attempts.get(key);
      const same =
        attempt?.values.text === values.text &&
        attempt?.values.direction === values.direction;
      if (attempt?.pending) {
        if (same) return attempt.pending;
        return Promise.reject(
          new Error(
            "Wait for this person's message to finish saving before recording another.",
          ),
        );
      }
      if (!same) {
        attempt = { values, requestId: newId(), pending: null };
        attempts.set(key, attempt);
      }
      // Keep the identity after failure, including a successful write whose
      // acknowledgement or following state refresh never reaches this tab.
      const pending = Promise.resolve()
        .then(() => send({ ...attempt.values, requestId: attempt.requestId }))
        .then((result) => {
          if (attempts.get(key) === attempt) attempts.delete(key);
          return result;
        })
        .finally(() => {
          if (attempt.pending === pending) attempt.pending = null;
        });
      attempt.pending = pending;
      return pending;
    },
    hasPending: () => [...attempts.values()].some((attempt) => attempt.pending),
  };
}
