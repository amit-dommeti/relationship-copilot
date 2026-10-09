import { api } from "./api.js";
import html from "../dist/client/index.html";
import js from "../dist/client/app.js?raw";
import css from "../dist/client/styles.css";
import favicon from "../web/favicon.svg";
const files = {
  "/": [html, "text/html; charset=utf-8"],
  "/index.html": [html, "text/html; charset=utf-8"],
  "/app.js": [js, "text/javascript; charset=utf-8"],
  "/styles.css": [css, "text/css; charset=utf-8"],
  "/favicon.svg": [favicon, "image/svg+xml"],
};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/"))
      return api(
        request,
        { ...env, AUTH_MODE: "sites" },
        request.headers.get("oai-authenticated-user-id"),
      );
    const file = files[url.pathname];
    if (!file || !["GET", "HEAD"].includes(request.method))
      return new Response("Not found", { status: 404 });
    return new Response(request.method === "HEAD" ? null : file[0], {
      headers: {
        "Content-Type": file[1],
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
      },
    });
  },
};
