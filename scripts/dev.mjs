import { spawnSync, spawn } from "node:child_process";
const result = spawnSync(process.execPath, ["scripts/build.mjs"], {
  stdio: "inherit",
});
if (result.status) process.exit(result.status);
const server = spawn(
  process.execPath,
  ["--env-file-if-exists=.env", "server/node.mjs"],
  { stdio: "inherit" },
);
process.on("SIGINT", () => server.kill("SIGINT"));
process.on("SIGTERM", () => server.kill("SIGTERM"));
server.on("exit", (code) => process.exit(code || 0));
