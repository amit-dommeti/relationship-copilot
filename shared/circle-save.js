import { normalizeCircle, nowISO } from "./domain.js";

const invalid = (message) => Object.assign(new Error(message), { status: 400 });

export function circleMembershipChanges(
  initial,
  selected,
  unconfirmed = new Set(),
) {
  const before = new Set(initial),
    after = new Set(selected);
  const changed = [...new Set([...before, ...after, ...unconfirmed])].filter(
    (id) => before.has(id) !== after.has(id) || unconfirmed.has(id),
  );
  return {
    add: changed.filter((id) => after.has(id)),
    remove: changed.filter((id) => !after.has(id)),
  };
}

export function prepareCircleSave(contacts, raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw invalid("Send the circle details to save.");
  let circle;
  try {
    circle = normalizeCircle(raw);
  } catch (error) {
    throw invalid(error.message);
  }
  const membership =
    raw.membership === undefined ? { add: [], remove: [] } : raw.membership;
  if (
    !membership ||
    typeof membership !== "object" ||
    !Array.isArray(membership.add) ||
    !Array.isArray(membership.remove) ||
    membership.add.length + membership.remove.length > 10000 ||
    [...membership.add, ...membership.remove].some(
      (id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,180}$/.test(id),
    ) ||
    new TextEncoder().encode(JSON.stringify(membership)).length > 512 * 1024
  )
    throw invalid(
      "The circle membership is invalid or too large. Reopen the circle and try again.",
    );
  const add = new Set(membership.add),
    remove = new Set(membership.remove);
  const known = new Set(contacts.map((c) => c.id));
  if (
    [...add].some((id) => remove.has(id)) ||
    [...add, ...remove].some((id) => !known.has(id))
  )
    throw invalid(
      "A selected person is unavailable. Reopen the circle and try again.",
    );
  const at = nowISO();
  const next = contacts.map((c) => {
    const included = c.circleIds.includes(circle.id);
    if (add.has(c.id) && !included) {
      if (c.circleIds.length >= 30)
        throw invalid(
          "A person can belong to up to 30 circles. Remove a membership first.",
        );
      return {
        ...c,
        circleIds: [...c.circleIds, circle.id],
        updatedAt: at,
      };
    }
    if (remove.has(c.id) && included)
      return {
        ...c,
        circleIds: c.circleIds.filter((id) => id !== circle.id),
        updatedAt: at,
      };
    return c;
  });
  return {
    circle,
    membership: { add: [...add], remove: [...remove] },
    contacts: next,
  };
}
