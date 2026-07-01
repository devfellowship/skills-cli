import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const CLI = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

function runCli(args: string[]): { code: number; stdout: string; stderr: string } {
  const res = spawnSync(process.execPath, ["--import", "tsx", CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, SEARCH_API_BASE: "https://skills.devfellowship.com" },
  });
  return { code: res.status ?? 1, stdout: res.stdout, stderr: res.stderr };
}

test("install-mcp --help prints usage and exits 0 (not a parse error)", () => {
  const { code, stdout, stderr } = runCli(["install-mcp", "--help"]);
  assert.equal(code, 0);
  assert.match(stdout, /Usage: dfl-skills install-mcp/);
  assert.match(stdout, /--dry-run/);
  // Must NOT surface the old "Expected skill id" / "Invalid skill id" error.
  assert.doesNotMatch(stdout + stderr, /Expected skill id|Invalid skill id/);
});

test("install-mcp -h (short flag) also prints usage", () => {
  const { code, stdout } = runCli(["install-mcp", "-h"]);
  assert.equal(code, 0);
  assert.match(stdout, /Usage: dfl-skills install-mcp/);
});

test("find --help prints usage and does NOT search for the literal '--help'", () => {
  const { code, stdout } = runCli(["find", "--help"]);
  assert.equal(code, 0);
  assert.match(stdout, /Usage: dfl-skills find <query>/);
  // The old bug searched the registry for "--help"; usage output proves we short-circuit.
  assert.doesNotMatch(stdout, /result\(s\) for "--help"|No skills found/);
});

test("install-connection --help prints its own usage", () => {
  const { code, stdout } = runCli(["install-connection", "--help"]);
  assert.equal(code, 0);
  assert.match(stdout, /Usage: dfl-skills install-connection/);
});

test("bare --help still prints the top-level help", () => {
  const { code, stdout } = runCli(["--help"]);
  assert.equal(code, 0);
  assert.match(stdout, /DFL skills \+ MCP\/connections installer/);
  assert.match(stdout, /per-command usage/);
});
