import { Store } from "./store.js";
import { text, uid, recommendations } from "../shared/domain.js";
import {
  requireSameOrigin,
  readJSON,
  hmac,
  equal,
  session,
  validSession,
} from "./security.js";
import { draftWithAI } from "./ai.js";

const limits = new Map();
function limit(key, count) {
  const now = Date.now();
  for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  const value = limits.get(key) || { n: 0, until: now + 60000 };
  value.n++;
  limits.set(key, value);
  if (value.n > count)
    throw Object.assign(
      new Error("A few too many requests. Try again in a minute."),
      { status: 429 },
    );
}
export const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
export async function api(request, env, identity) {
  const url = new URL(request.url),
    path = url.pathname,
    method = request.method;
  const store = new Store(env.DB);
  try {
    if (path === "/api/health") return json({ ok: true, version: "2.0.0" });
    if (!["GET", "HEAD"].includes(method)) requireSameOrigin(request);
    if (
      path === "/api/login" &&
      method === "POST" &&
      env.AUTH_MODE === "password"
    ) {
      limit("login", 10);
      const body = await readJSON(request, 4096);
      if (
        !env.APP_PASSWORD ||
        !env.SESSION_SECRET ||
        !equal(
          await hmac(env.SESSION_SECRET, text(body.password, 300)),
          await hmac(env.SESSION_SECRET, env.APP_PASSWORD),
        )
      )
        return json({ error: "That password didn't match." }, 401);
      return json({ ok: true }, 200, {
        "Set-Cookie": `rc_session=${await session(env.SESSION_SECRET)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=604800`,
      });
    }
    if (env.AUTH_MODE === "password")
      identity = (await validSession(request, env.SESSION_SECRET))
        ? "owner"
        : null;
    if (!identity)
      return json(
        {
          error: "Sign in to open your private workspace.",
          signIn:
            env.AUTH_MODE === "sites"
              ? "/signin-with-chatgpt?return_to=/"
              : null,
        },
        401,
      );
    const owner = identity;
    if (path === "/api/state" && method === "GET")
      return json({
        ...(await store.snapshot(owner)),
        capabilities: {
          ai: Boolean(env.OPENAI_API_KEY),
          linkedin: false,
          auth: env.AUTH_MODE,
        },
        version: 2,
      });
    if (path === "/api/settings" && method === "PUT") {
      const b = await readJSON(request, 12000);
      return json(
        await store.settings(owner, {
          ...(await store.settings(owner)),
          name: text(b.name, 80),
          weeklyGoal: Math.max(1, Math.min(20, Number(b.weeklyGoal) || 3)),
          voice: text(b.voice, 4000),
          notifications: Boolean(b.notifications),
        }),
      );
    }
    if (path === "/api/contacts" && method === "POST") {
      const body = await readJSON(request, 16000);
      return json(
        await store.saveContact(owner, {
          ...body,
          id: uid(),
          providerId: "",
          chatId: "",
          source: "manual",
        }),
        201,
      );
    }
    if (path.startsWith("/api/contacts/")) {
      const [id, action] = path.slice(14).split("/");
      const c = await store.contact(owner, decodeURIComponent(id));
      if (!c) return json({ error: "Contact not found." }, 404);
      if (!action && method === "PATCH") {
        const body = await readJSON(request, 20000);
        if (body.expectedUpdatedAt && body.expectedUpdatedAt !== c.updatedAt)
          return json(
            {
              error:
                "This contact changed in another window. Reload before saving.",
            },
            409,
          );
        return json(
          await store.saveContact(owner, {
            ...c,
            ...body,
            id: c.id,
            providerId: c.providerId,
            chatId: c.chatId,
            source: c.source,
          }),
        );
      }
      if (action === "messages" && method === "POST") {
        const b = await readJSON(request, 14000);
        if (
          b.requestId !== undefined &&
          (typeof b.requestId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              b.requestId,
            ))
        )
          return json(
            {
              error:
                "The save identity is invalid. Reload before trying again.",
            },
            400,
          );
        if (!text(b.text, 12000))
          return json({ error: "Add a message first." }, 400);
        return json(
          await store.message(owner, c, {
            ...b,
            id: b.requestId ? `manual-${b.requestId.toLowerCase()}` : uid(),
            source: "manual",
          }),
          201,
        );
      }
    }
    if (path === "/api/circles" && method === "POST")
      return json(
        await store.saveCircle(owner, {
          ...(await readJSON(request, 10000)),
          id: uid(),
        }),
        201,
      );
    if (path.startsWith("/api/circles/") && method === "PUT") {
      const id = decodeURIComponent(path.slice(13));
      if (!(await store.list("circles", owner)).some((c) => c.id === id))
        return json({ error: "Circle not found." }, 404);
      return json(
        await store.saveCircle(owner, {
          ...(await readJSON(request, 10000)),
          id,
        }),
      );
    }
    if (path === "/api/import" && method === "POST") {
      const b = await readJSON(request, 8 * 1024 * 1024);
      return json(await store.import(owner, b));
    }
    if (path === "/api/recommendations" && method === "GET")
      return json(
        recommendations(
          await store.list("contacts", owner),
          await store.list("circles", owner),
        ).slice(0, 5),
      );
    if (path === "/api/draft" && method === "POST") {
      limit(`draft:${owner}`, 12);
      const b = await readJSON(request, 20000);
      const c = await store.contact(owner, b.contactId);
      if (!c) return json({ error: "Choose a contact first." }, 400);
      const circles = (await store.list("circles", owner))
        .filter((g) => c.circleIds.includes(g.id))
        .map((g) => ({ name: g.name, memory: g.memory }));
      const settings = await store.settings(owner);
      const messages = (await store.list("messages", owner))
        .filter((m) => m.contactId === c.id)
        .sort((a, b) => a.at.localeCompare(b.at))
        .slice(-8)
        .map((m) => ({ direction: m.direction, text: m.text.slice(0, 2000) }));
      return json(
        await draftWithAI(env, {
          contact: c,
          circles,
          voice: settings.voice,
          messages,
          intent: text(b.intent, 30),
        }),
      );
    }
    if (path === "/api/logout" && method === "POST")
      return json({ ok: true }, 200, {
        "Set-Cookie":
          "rc_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      });
    return json({ error: "Not found." }, 404);
  } catch (error) {
    const status = error.status || 500;
    return json(
      {
        error:
          status === 500
            ? "Something went wrong. Your saved work is safe; please try again."
            : error.message,
      },
      status,
    );
  }
}
