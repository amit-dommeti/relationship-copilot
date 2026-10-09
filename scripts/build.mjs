import { build } from "esbuild";
import { mkdir, copyFile, cp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
await mkdir("dist/client", { recursive: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await build({
  entryPoints: ["web/app.js"],
  bundle: true,
  minify: true,
  format: "esm",
  outfile: "dist/client/app.js",
  target: "es2022",
});
for (const file of ["index.html", "styles.css", "favicon.svg"])
  await copyFile(`web/${file}`, `dist/client/${file}`);
await build({
  entryPoints: ["server/worker.js"],
  bundle: true,
  minify: true,
  format: "esm",
  outfile: "dist/server/index.js",
  target: "es2022",
  loader: { ".html": "text", ".css": "text", ".svg": "text" },
  plugins: [
    {
      name: "raw-script",
      setup(b) {
        b.onResolve({ filter: /\?raw$/ }, (args) => ({
          path: resolve(args.resolveDir, args.path.replace(/\?raw$/, "")),
          namespace: "raw",
        }));
        b.onLoad({ filter: /.*/, namespace: "raw" }, async (args) => ({
          contents: await readFile(args.path, "utf8"),
          loader: "text",
        }));
      },
    },
  ],
});
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("drizzle", "dist/.openai/drizzle", { recursive: true });
await writeFile("dist/server/package.json", '{"type":"module"}\n');
const worker = await import(
  new URL("../dist/server/index.js", import.meta.url)
);
if (typeof worker.default.fetch !== "function")
  throw new Error("Invalid Worker export");
const check = await worker.default.fetch(
  new Request("https://example.test/"),
  {},
);
if (check.status !== 200) throw new Error("App build failed");
console.log("Built browser app and portable Worker.");
