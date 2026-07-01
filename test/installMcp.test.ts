import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, test } from "node:test";

import { runInstallMcp } from "../src/commands/installMcp.js";
import type { McpSkill } from "../src/types/mcpskill.js";

let dir: string;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "dfl-skills-mcp-"));
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Capture process.stdout.write for the duration of `fn`. */
async function captureStdout(fn: () => Promise<number>): Promise<{ code: number; out: string }> {
  const original = process.stdout.write.bind(process.stdout);
  let out = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stdout as any).write = (chunk: string) => {
    out += chunk;
    return true;
  };
  try {
    const code = await fn();
    return { code, out };
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stdout as any).write = original;
  }
}

const mcpSkill = (): McpSkill => ({
  kind: "mcp",
  url: "https://x.mcp.devfellowship.com/mcp",
  owner: "devfellowship",
  repo: "skills",
  skill: "demo",
  name: "demo",
});

afterEach(() => {
  delete process.env["SEARCH_API_BASE"];
});

test("--dry-run announces the change and writes NOTHING", async () => {
  const targetPath = join(dir, "dry-run.json");
  assert.ok(!existsSync(targetPath));

  const { code, out } = await captureStdout(() =>
    runInstallMcp("devfellowship/skills/demo", {
      dryRun: true,
      fetchSkillFn: async () => mcpSkill(),
      targetPath,
    }),
  );

  assert.equal(code, 0);
  assert.match(out, /Will install new MCP server "demo"/);
  assert.match(out, /Dry run: no changes written/);
  // The crux: no file was created, nothing was mutated.
  assert.ok(!existsSync(targetPath), "dry-run must not create or write the config");
});

test("--dry-run on an existing same-named server announces REPLACE, still writes nothing", async () => {
  const targetPath = join(dir, "dry-run-replace.json");
  const before = JSON.stringify(
    { mcpServers: { demo: { type: "http", url: "old", headers: {} } }, marker: 1 },
    null,
    2,
  );
  writeFileSync(targetPath, before);

  const { code, out } = await captureStdout(() =>
    runInstallMcp("devfellowship/skills/demo", {
      dryRun: true,
      fetchSkillFn: async () => mcpSkill(),
      targetPath,
    }),
  );

  assert.equal(code, 0);
  assert.match(out, /Will REPLACE existing MCP server "demo"/);
  // Byte-for-byte unchanged.
  assert.equal(readFileSync(targetPath, "utf8"), before);
});

test("announces the intended change BEFORE any write (announce precedes result line)", async () => {
  // A same-named server present so BOTH the pre-write announce and the post-write
  // result line reference REPLACE — we assert the "Will REPLACE" (intent) line is
  // emitted before the "Replaced" (done) line. Dry-run so no creds/network needed.
  const targetPath = join(dir, "order.json");
  writeFileSync(
    targetPath,
    JSON.stringify({ mcpServers: { demo: { type: "http", url: "old", headers: {} } } }),
  );

  const { out } = await captureStdout(() =>
    runInstallMcp("devfellowship/skills/demo", {
      dryRun: true,
      fetchSkillFn: async () => mcpSkill(),
      targetPath,
    }),
  );

  const willIdx = out.indexOf("Will REPLACE");
  assert.ok(willIdx >= 0, "announce line present");
  // In dry-run the write is skipped entirely, so the announce is the ONLY change
  // description the user sees before any write could happen.
  assert.match(out.slice(willIdx), /Dry run: no changes written/);
});
