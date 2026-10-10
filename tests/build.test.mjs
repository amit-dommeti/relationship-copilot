import test from "node:test";
import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

test("a rebuild excludes stale output and preserves migration source exactly", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const fixture = await mkdtemp(join(tmpdir(), "copilot-build-"));
  try {
    for (const name of [
      "web",
      "shared",
      "server",
      "scripts",
      "drizzle",
      ".openai",
      "package.json",
    ])
      await cp(join(root, name), join(fixture, name), { recursive: true });
    await symlink(
      join(root, "node_modules"),
      join(fixture, "node_modules"),
      "dir",
    );
    const output = join(fixture, "dist/.openai/drizzle");
    await mkdir(output, { recursive: true });
    const source = await readFile(
      join(fixture, "drizzle/0000_relationships.sql"),
      "utf8",
    );
    await writeFile(join(output, "0000_relationships 2.sql"), source);
    await writeFile(
      join(fixture, "dist/stale-secret.txt"),
      "synthetic leftover",
    );
    execFileSync(process.execPath, ["scripts/build.mjs"], {
      cwd: fixture,
      stdio: "pipe",
    });
    assert.deepEqual(
      (await readdir(output, { recursive: true })).sort(),
      (await readdir(join(fixture, "drizzle"), { recursive: true })).sort(),
    );
    assert.equal(
      await readFile(join(output, "0000_relationships.sql"), "utf8"),
      source,
    );
    assert.equal(
      await readFile(join(fixture, "drizzle/0000_relationships.sql"), "utf8"),
      source,
    );
    assert.equal(
      (await readdir(join(fixture, "dist"))).includes("stale-secret.txt"),
      false,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
