import { dateValue, fullName, text } from "./domain.js";

export const importError = (message) =>
  Object.assign(new Error(`${message} Nothing was imported.`), { status: 400 });

const record = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Shared by the file preview and the server; validation must finish before any write.
export function validateImport(value) {
  if (!record(value))
    throw importError("Choose a valid Copilot backup or contact file.");
  for (const [field, maximum] of [
    ["contacts", 10000],
    ["circles", 500],
    ["messages", 10000],
  ]) {
    const rows = value[field];
    if (field !== "contacts" && rows === undefined) continue;
    if (!Array.isArray(rows) || rows.length > maximum)
      throw importError(
        `The ${field} list must contain up to ${maximum.toLocaleString("en-US")} entries.`,
      );
  }
  for (const [index, contact] of value.contacts.entries())
    if (!record(contact) || !text(fullName(contact), 120))
      throw importError(`Contact ${index + 1} needs a name.`);
  for (const [index, circle] of (value.circles || []).entries())
    if (!record(circle) || !text(circle.name, 100))
      throw importError(`Circle ${index + 1} needs a name.`);
  for (const [index, message] of (value.messages || []).entries()) {
    const label = `Message ${index + 1}`;
    if (
      !record(message) ||
      !text(message.contactId, 1000) ||
      message.contactId.length > 1000
    )
      throw importError(`${label} needs a valid contact ID.`);
    if (!text(message.text, 12000) || message.text.length > 12000)
      throw importError(`${label} needs text of up to 12,000 characters.`);
    if (
      message.id !== undefined &&
      (!text(message.id, 1000) || message.id.length > 1000)
    )
      throw importError(`${label} has an invalid ID.`);
    if (
      message.direction !== undefined &&
      !["in", "out"].includes(message.direction)
    )
      throw importError(`${label} must have direction "in" or "out".`);
    if (
      message.at &&
      (typeof message.at !== "string" || !dateValue(message.at))
    )
      throw importError(`${label} has an invalid date.`);
  }
  if (value.settings !== undefined && !record(value.settings))
    throw importError("The backup preferences must be an object.");
  return value;
}
