import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { parseSkillId, registryBase, DEFAULT_REGISTRY } from "../src/api.js";
import { assertSafeMcpUrl } from "../src/commands/installMcp.js";

const ORIGINAL_BASE = process.env["SEARCH_API_BASE"];

beforeEach(() => {
  delete process.env["SEARCH_API_BASE"];
});

afterEach(() => {
  if (ORIGINAL_BASE === undefined) delete process.env["SEARCH_API_BASE"];
  else process.env["SEARCH_API_BASE"] = ORIGINAL_BASE;
});

test("parseSkillId accepts a clean owner/repo/skill", () => {
  assert.deepEqual(parseSkillId("devfellowship/skills/dfl-stack"), {
    owner: "devfellowship",
    repo: "skills",
    skill: "dfl-stack",
  });
});

test("parseSkillId rejects segments with disallowed chars", () => {
  for (const id of [
    "devfellowship/skills/dfl stack",
    "devfellowship/skills/DFL",
    "devfellowship/sk;ills/x",
    "dev$/skills/x",
    "devfellowship/skills/a$(id)",
  ]) {
    assert.throws(() => parseSkillId(id), /Invalid skill id segment/, `should reject: ${id}`);
  }
});

test("parseSkillId rejects a path-traversal id (wrong segment count)", () => {
  // ".." expands the id to 4 segments, caught by the count check before the charset one.
  assert.throws(() => parseSkillId("devfellowship/skills/../etc"), /Expected skill id/);
});

test("registryBase defaults to the DFL registry (https)", () => {
  assert.equal(registryBase(), DEFAULT_REGISTRY);
});

test("registryBase accepts an https override", () => {
  process.env["SEARCH_API_BASE"] = "https://staging.devfellowship.com/";
  assert.equal(registryBase(), "https://staging.devfellowship.com");
});

test("registryBase rejects a non-https base", () => {
  process.env["SEARCH_API_BASE"] = "http://evil.example.com";
  assert.throws(() => registryBase(), /must be https/);
});

test("assertSafeMcpUrl accepts an https devfellowship host", () => {
  assert.doesNotThrow(() => assertSafeMcpUrl("https://x.mcp.devfellowship.com/mcp"));
});

test("assertSafeMcpUrl rejects http (no Bearer over plaintext)", () => {
  assert.throws(() => assertSafeMcpUrl("http://x.mcp.devfellowship.com/mcp"), /https/);
});

test("assertSafeMcpUrl rejects a non-url", () => {
  assert.throws(() => assertSafeMcpUrl("not a url"), /valid URL/);
});

test("assertSafeMcpUrl warns (but does not throw) on non-DFL host with default registry", () => {
  const original = process.stderr.write.bind(process.stderr);
  let warned = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stderr as any).write = (chunk: string) => {
    warned += chunk;
    return true;
  };
  try {
    assert.doesNotThrow(() => assertSafeMcpUrl("https://evil.example.com/mcp"));
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stderr as any).write = original;
  }
  assert.match(warned, /WARNING/);
  assert.match(warned, /evil\.example\.com/);
});
