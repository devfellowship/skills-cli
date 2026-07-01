import { DEFAULT_REGISTRY, fetchSkill, parseSkillId, registryBase } from "../api.js";
import {
  assertValidServerName,
  buildHttpServer,
  claudeJsonPath,
  mergeMcpServer,
} from "../claudeJson.js";
import { readAccessToken, refreshDflAuth } from "../credentials.js";
import type { McpSkill } from "../types/mcpskill.js";

function deriveServerName(skill: McpSkill, id: string): string {
  const candidate = skill.name ?? skill.skill ?? id.split("/").pop() ?? id;
  return candidate.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Validate the MCP url before we write our Bearer JWT header pointed at it.
 * A spoofed/tampered registry response could otherwise aim the next Claude
 * session's auth header at an attacker-controlled server. Hard-block non-https;
 * loudly warn (but don't block) when using the default DFL registry and the
 * host isn't under devfellowship.com.
 */
export function assertSafeMcpUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`MCP url is not a valid URL: "${rawUrl}"`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`MCP url must be https:// (got "${rawUrl}"). Refusing to write a Bearer token over ${parsed.protocol}//.`);
  }
  const usingDefaultRegistry = registryBase() === DEFAULT_REGISTRY.replace(/\/+$/, "");
  const host = parsed.hostname.toLowerCase();
  const isDflHost = host === "devfellowship.com" || host.endsWith(".devfellowship.com");
  if (usingDefaultRegistry && !isDflHost) {
    process.stderr.write(
      `WARNING: default DFL registry returned a non-devfellowship.com MCP host "${host}". ` +
        `Your dfl-iam JWT will be sent to it. Proceed only if you trust this host.\n`,
    );
  }
}

export async function runInstallMcp(id: string): Promise<number> {
  if (!id || id.trim().length === 0) {
    process.stderr.write("Usage: dfl-skills install-mcp <owner/repo/skill>\n");
    return 1;
  }

  const ref = parseSkillId(id);
  const skill = await fetchSkill(ref);

  if (skill.kind !== "mcp") {
    process.stderr.write(
      `"${id}" has kind "${skill.kind ?? "skill"}", not "mcp". Use \`dfl-skills add\` for skills.\n`,
    );
    return 1;
  }
  const mcp = skill as McpSkill;
  if (!mcp.url) {
    process.stderr.write(`MCP skill "${id}" has no url in its frontmatter.\n`);
    return 1;
  }
  if (mcp.transport && mcp.transport !== "http") {
    process.stderr.write(
      `Only http transport is supported by install-mcp (got "${mcp.transport}").\n`,
    );
    return 1;
  }

  assertSafeMcpUrl(mcp.url);

  const serverName = deriveServerName(mcp, id);
  assertValidServerName(serverName);

  process.stderr.write("> dfl-auth refresh (best-effort)\n");
  const refreshed = await refreshDflAuth();
  if (!refreshed) {
    process.stderr.write("  (dfl-auth refresh failed or unavailable; using existing token)\n");
  }

  const jwt = readAccessToken();
  const server = buildHttpServer(mcp.url, jwt);
  const targetPath = claudeJsonPath();
  const { backupPath, replaced } = mergeMcpServer({ path: targetPath, name: serverName, server });

  process.stdout.write(
    replaced
      ? `Replacing existing MCP server "${serverName}"\n`
      : `Installing new MCP server "${serverName}"\n`,
  );
  process.stdout.write(`Installed MCP server "${serverName}" -> ${mcp.url}\n`);
  process.stdout.write(`Updated ${targetPath}\n`);
  if (backupPath) process.stdout.write(`Backup written to ${backupPath}\n`);
  process.stdout.write("Restart Claude to load the new MCP server.\n");
  return 0;
}
