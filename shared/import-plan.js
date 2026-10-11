import {
  mergeContacts,
  normalizeCircle,
  text,
  uid,
  dateValue,
  nowISO,
} from "./domain.js";
import { validateImport, importError } from "./import-validation.js";

// Prepare the same complete restore for server storage and the isolated demo.
// This function never mutates the current workspace or the incoming backup.
export function prepareWorkspaceImport(existing, currentSettings, payload) {
  const {
    contacts: incoming,
    circles = [],
    messages = [],
    settings,
  } = validateImport(payload);
  const result = mergeContacts(existing, incoming);
  const contactIds = new Set(result.contacts.map((c) => c.id));
  const importedMessages = messages.map((m, index) => {
    const contactId = result.idMap[m.contactId] || m.contactId;
    if (!contactIds.has(contactId))
      throw importError(
        `Message ${index + 1} refers to a contact missing from this workspace and backup.`,
      );
    return {
      id: text(m.id, 1000) || uid(),
      contactId,
      text: text(m.text, 12000),
      direction: m.direction === "out" ? "out" : "in",
      at: dateValue(m.at) ? new Date(m.at).toISOString() : nowISO(),
      source: m.source === "linkedin" ? "linkedin" : "manual",
    };
  });
  const restored = settings
    ? {
        name: text(settings.name, 80),
        voice: text(settings.voice, 4000),
        weeklyGoal: Math.max(1, Math.min(20, Number(settings.weeklyGoal) || 3)),
      }
    : {};
  return {
    ...result,
    circles: circles.map(normalizeCircle),
    messages: importedMessages,
    settings: {
      ...currentSettings,
      ...restored,
      lastImportedAt: nowISO(),
      lastImportCount: incoming.length,
    },
  };
}
