import test from "node:test";
import assert from "node:assert/strict";
import { personFormValues, changedPersonFields } from "../web/person-form.js";

const values = (changes = {}) => {
  const form = new FormData();
  const input = {
    name: "Synthetic Person",
    company: "Square",
    role: "PM",
    url: "",
    memory: "Shared project",
    reason: "",
    lastContactAt: "2025-01-15",
    cadence: "21",
    circleIds: ["circle-a", "circle-b"],
    ...changes,
  };
  for (const [key, value] of Object.entries(input))
    for (const entry of Array.isArray(value) ? value : [value])
      form.append(key, entry);
  return personFormValues(form);
};

test("person form keeps complete creation values with typed rhythm and all circles", () => {
  const current = values();
  assert.equal(current.cadence, 21);
  assert.deepEqual(current.circleIds, ["circle-a", "circle-b"]);
  assert.deepEqual(Object.keys(current).sort(), [
    "cadence",
    "circleIds",
    "company",
    "lastContactAt",
    "memory",
    "name",
    "reason",
    "role",
    "url",
  ]);
});

test("edit payload includes only fields changed from the opening form", () => {
  const initial = values();
  const snapshot = structuredClone(initial);
  assert.deepEqual(
    changedPersonFields(initial, values({ memory: "A new memory" })),
    { memory: "A new memory" },
  );
  assert.deepEqual(changedPersonFields(initial, values()), {});
  assert.deepEqual(initial, snapshot);
});

test("intentional clears and date/rhythm changes are retained", () => {
  assert.deepEqual(
    changedPersonFields(
      values(),
      values({ company: "", lastContactAt: "", cadence: "30", circleIds: [] }),
    ),
    {
      company: "",
      lastContactAt: "",
      cadence: 30,
      circleIds: [],
    },
  );
});

test("circle order and values restored before saving are not changes", () => {
  const initial = values();
  assert.deepEqual(
    changedPersonFields(
      initial,
      values({ circleIds: ["circle-b", "circle-a"] }),
    ),
    {},
  );
  const current = values({ memory: "Temporary edit" });
  current.memory = initial.memory;
  assert.deepEqual(changedPersonFields(initial, current), {});
});

test("an unconfirmed save retries intended reverts without touching unrelated fields", () => {
  const initial = values();
  const pending = new Set(["memory", "circleIds"]);
  assert.deepEqual(changedPersonFields(initial, values(), pending), {
    memory: initial.memory,
    circleIds: initial.circleIds,
  });
  assert.deepEqual(
    changedPersonFields(initial, values({ memory: "Latest retry" }), pending),
    {
      memory: "Latest retry",
      circleIds: initial.circleIds,
    },
  );
  assert.deepEqual([...pending], ["memory", "circleIds"]);
});
