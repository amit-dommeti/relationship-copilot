import http from "node:http";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { api } from "./api.js";
import { openDatabase } from "./node-db.mjs";
const root = fileURLToPath(new URL("..", import.meta.url));
const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT) || 4173;
if (
  production &&
  (!process.env.APP_PASSWORD ||
    process.env.APP_PASSWORD.length < 12 ||
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32 ||
    !process.env.APP_ORIGIN?.startsWith("https://"))
)
  throw new Error(
    "Production requires APP_PASSWORD (12+ characters), SESSION_SECRET (32+ characters), and an https APP_ORIGIN.",
  );
const env = {
  ...process.env,
  DB: openDatabase(
    path.resolve(
      process.env.DATA_DIR || path.join(root, "data"),
      "copilot.sqlite",
    ),
  ),
  AUTH_MODE: production ? "password" : "local",
};
const assets = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
  ["/favicon.svg", "favicon.svg"],
]);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};
const server = http.createServer(async (req, res) => {
  try {
    const origin = production ? env.APP_ORIGIN : `http://${req.headers.host}`;
    const url = new URL(req.url, origin);
    if (
      !production &&
      !new Set(["localhost", "127.0.0.1", "[::1]"]).has(url.hostname)
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers))
        if (v && !k.startsWith("oai-"))
          headers.set(k, Array.isArray(v) ? v.join(",") : v);
      const request = new Request(url, {
        method: req.method,
        headers,
        ...(!["GET", "HEAD"].includes(req.method)
          ? { body: Readable.toWeb(req), duplex: "half" }
          : {}),
      });
      const result = await api(request, env, production ? null : "local");
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
      return;
    }
    const file = assets.get(url.pathname);
    if (!file || !["GET", "HEAD"].includes(req.method)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)],
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'",
    });
    res.end(
      req.method === "HEAD"
        ? undefined
        : await readFile(path.join(root, "dist/client", file)),
    );
  } catch {
    res.writeHead(500);
    res.end("Unable to load the app.");
  }
});
server.listen(port, production ? "0.0.0.0" : "127.0.0.1", () =>
  console.log(`Relationship Copilot: http://localhost:${port}`),
);
const stop = () =>
  server.close(() => {
    env.DB.close();
    process.exit(0);
  });
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
