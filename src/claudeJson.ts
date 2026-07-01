import { randomBytes } from "node:crypto";
import { chmodSync, copyFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { HttpMcpServer } from "./types/httpmcpserver.js";

const SERVER_NAME_RE = /^[a-z0-9-]+$/;

export function claudeJsonPath(): string {
  return join(homedir(), ".claude.json");
}

export function assertValidServerName(name: string): void {
  if (!SERVER_NAME_RE.test(name)) {
    throw new Error(`Invalid MCP server name "${name}": must match [a-z0-9-]`);
  }
}

function readConfig(path: string): Record<string, unknown> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  if (raw.trim().length === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`${path} contains invalid JSON: ${reason}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path} is not a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Atomically merge an HTTP MCP server entry into a Claude config file.
 *
 * Atomic = write to a temp sibling, back up the original, then rename temp over
 * the target so a crash never leaves a half-written config. Never touches
 * `enableAllProjectMcpServers`.
 */
export function mergeMcpServer(args: {
  path: string;
  name: string;
  server: HttpMcpServer;
}): { backupPath: string | null; replaced: boolean } {
  const { path, name, server } = args;
  assertValidServerName(name);

  const config = readConfig(path);
  const existing = config["mcpServers"];
  const mcpServers: Record<string, unknown> =
    typeof existing === "object" && existing !== null && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  const replaced = name in mcpServers;
  mcpServers[name] = server;
  config["mcpServers"] = mcpServers;

  if ("enableAllProjectMcpServers" in config) {
    // We never set it; if a prior value exists we leave it untouched as-is.
  }

  const serialized = `${JSON.stringify(config, null, 2)}\n`;
  const dir = dirname(path);
  const tmpPath = join(dir, `.claude.json.tmp-${randomBytes(6).toString("hex")}`);
  writeFileSync(tmpPath, serialized, { mode: 0o600 });

  let backupPath: string | null = null;
  try {
    readFileSync(path);
    backupPath = `${path}.bak`;
    copyFileSync(path, backupPath);
    // The backup holds the same Bearer JWT as the config — lock it down.
    chmodSync(backupPath, 0o600);
  } catch {
    backupPath = null;
  }

  renameSync(tmpPath, path);
  return { backupPath, replaced };
}

export function buildHttpServer(url: string, jwt: string): HttpMcpServer {
  return { type: "http", url, headers: { Authorization: `Bearer ${jwt}` } };
}
