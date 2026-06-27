import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import {
  assertValidServerName,
  buildHttpServer,
  mergeMcpServer,
} from "../src/claudeJson.js";

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "dfl-skills-test-"));
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

function fixture(name: string, contents: string): string {
  const p = join(dir, name);
  writeFileSync(p, contents);
  return p;
}

test("buildHttpServer shapes the entry correctly", () => {
  const server = buildHttpServer("https://x.mcp.dev/mcp", "jwt-123");
  assert.deepEqual(server, {
    type: "http",
    url: "https://x.mcp.dev/mcp",
    headers: { Authorization: "Bearer jwt-123" },
  });
});

test("merges into an existing config, preserving other keys and servers", () => {
  const path = fixture(
    "claude-existing.json",
    JSON.stringify({
      numStartups: 7,
      mcpServers: { infisical: { type: "stdio", command: "npx" } },
    }),
  );

  const { backupPath } = mergeMcpServer({
    path,
    name: "dfl-skills",
    server: buildHttpServer("https://skills.mcp.dev/mcp", "tok"),
  });

  const result = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  assert.equal(result["numStartups"], 7);
  const servers = result["mcpServers"] as Record<string, unknown>;
  assert.ok(servers["infisical"], "existing server preserved");
  assert.deepEqual(servers["dfl-skills"], {
    type: "http",
    url: "https://skills.mcp.dev/mcp",
    headers: { Authorization: "Bearer tok" },
  });
  assert.ok(backupPath, "a backup was written");
  assert.ok(!("enableAllProjectMcpServers" in result), "never sets enableAllProjectMcpServers");
});

test("creates config when target file does not exist (no backup)", () => {
  const path = join(dir, "claude-missing.json");
  const { backupPath } = mergeMcpServer({
    path,
    name: "new-server",
    server: buildHttpServer("https://a.dev/mcp", "tok"),
  });
  const result = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const servers = result["mcpServers"] as Record<string, unknown>;
  assert.ok(servers["new-server"]);
  assert.equal(backupPath, null);
});

test("overwrites a server of the same name", () => {
  const path = fixture(
    "claude-overwrite.json",
    JSON.stringify({ mcpServers: { dup: { type: "http", url: "old", headers: { Authorization: "Bearer old" } } } }),
  );
  mergeMcpServer({ path, name: "dup", server: buildHttpServer("https://new.dev/mcp", "newtok") });
  const result = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const servers = result["mcpServers"] as Record<string, Record<string, unknown>>;
  assert.equal(servers["dup"]?.["url"], "https://new.dev/mcp");
});

test("never sets enableAllProjectMcpServers and leaves a pre-existing value untouched", () => {
  const path = fixture(
    "claude-flag.json",
    JSON.stringify({ enableAllProjectMcpServers: false, mcpServers: {} }),
  );
  mergeMcpServer({ path, name: "srv", server: buildHttpServer("https://b.dev/mcp", "t") });
  const result = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  assert.equal(result["enableAllProjectMcpServers"], false);
});

test("rejects invalid server names", () => {
  assert.throws(() => assertValidServerName("Bad_Name"));
  assert.throws(() => assertValidServerName("has space"));
  assert.throws(() =>
    mergeMcpServer({ path: join(dir, "x.json"), name: "UPPER", server: buildHttpServer("u", "t") }),
  );
  assert.doesNotThrow(() => assertValidServerName("good-name-123"));
});

test("produces valid JSON with trailing newline", () => {
  const path = fixture("claude-fmt.json", "{}");
  mergeMcpServer({ path, name: "fmt", server: buildHttpServer("https://c.dev/mcp", "t") });
  const raw = readFileSync(path, "utf8");
  assert.ok(raw.endsWith("\n"));
  assert.doesNotThrow(() => JSON.parse(raw));
});
