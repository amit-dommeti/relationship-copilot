const encoder = new TextEncoder();
export async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export function equal(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
}
export function cookie(request, name) {
  return (
    (request.headers.get("cookie") || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}
export async function session(secret, expires = Date.now() + 7 * 86400000) {
  return `${expires}.${await hmac(secret, String(expires))}`;
}
export async function validSession(request, secret) {
  const [expires, sig] = cookie(request, "rc_session").split(".");
  return Boolean(
    secret &&
    Number(expires) > Date.now() &&
    equal(await hmac(secret, expires), sig),
  );
}
export function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (
    origin !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw Object.assign(
      new Error("Please reload the app before trying again."),
      { status: 403 },
    );
}
export async function readJSON(request, max = 2 * 1024 * 1024) {
  const body = await readBody(request, max);
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("Invalid JSON."), { status: 400 });
  }
}
export async function readBody(request, max) {
  if (Number(request.headers.get("content-length")) > max)
    throw Object.assign(new Error("Request too large."), { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const parts = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw Object.assign(new Error("Request too large."), { status: 413 });
    }
    parts.push(value);
  }
  const data = new Uint8Array(size);
  let at = 0;
  for (const p of parts) {
    data.set(p, at);
    at += p.length;
  }
  return new TextDecoder().decode(data);
}
