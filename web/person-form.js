const textFields = [
  "name",
  "company",
  "role",
  "url",
  "memory",
  "reason",
  "lastContactAt",
];

export function personFormValues(formData) {
  return {
    ...Object.fromEntries(
      textFields.map((key) => [key, formData.get(key) ?? ""]),
    ),
    cadence: Number(formData.get("cadence")),
    circleIds: formData.getAll("circleIds"),
  };
}

export function changedPersonFields(initial, current, unconfirmed = new Set()) {
  return Object.fromEntries(
    Object.entries(current).filter(([key, value]) => {
      // A lost acknowledgement may have committed: an intended revert must write too.
      if (unconfirmed.has(key)) return true;
      const previous = initial[key];
      return Array.isArray(value)
        ? value.length !== previous.length ||
            value.some((id) => !previous.includes(id))
        : value !== previous;
    }),
  );
}
