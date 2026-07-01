import { DEFAULT_REGISTRY, fetchSkill, parseSkillId, registryBase } from "../api.js";
import {
  assertValidServerName,
  buildHttpServer,
  claudeJsonPath,
  mergeMcpServer,
  previewMcpMerge,
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
 * session's auth header at an attacker-controlled server. Hard-block non-https.
 *
 * On the DEFAULT DFL registry the host MUST be under devfellowship.com — a
 * non-DFL host there means a tampered/spoofed response, so we hard-block it
 * (writing our dfl-iam JWT to an arbitrary host is the exact threat). When the
 * caller overrides the registry (SEARCH_API_BASE) we can't assert a host
 * allowlist, so we still enforce https and print a clear "non-default registry"
 * warning instead of silently trusting whatever host it returns.
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
  if (usingDefaultRegistry) {
    if (!isDflHost) {
      throw new Error(
        `Refusing to write a Bearer token: the default DFL registry returned a ` +
          `non-devfellowship.com MCP host "${host}". This indicates a tampered or spoofed ` +
          `registry response. Aborting.`,
      );
    }
    return;
  }
  process.stderr.write(
    `WARNING: using a non-default registry (SEARCH_API_BASE); host allowlist not enforced. ` +
      `Your dfl-iam JWT will be sent to MCP host "${host}". Proceed only if you trust it.\n`,
  );
}

export interface InstallMcpOptions {
  /** Print the intended change and exit without writing anything. */
  dryRun?: boolean;
  /** Test seam: override the registry fetch and target config path. */
  fetchSkillFn?: typeof fetchSkill;
  targetPath?: string;
}

export async function runInstallMcp(id: string, options: InstallMcpOptions = {}): Promise<number> {
  if (!id || id.trim().length === 0) {
    process.stderr.write("Usage: dfl-skills install-mcp <owner/repo/skill> [--dry-run]\n");
    return 1;
  }

  const ref = parseSkillId(id);
  const skill = await (options.fetchSkillFn ?? fetchSkill)(ref);

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

  const targetPath = options.targetPath ?? claudeJsonPath();

  // Announce the intended change BEFORE writing so a same-named server is never
  // clobbered before the user can react.
  const { replaced: willReplace } = previewMcpMerge(targetPath, serverName);
  process.stdout.write(
    willReplace
      ? `Will REPLACE existing MCP server "${serverName}" -> ${mcp.url} in ${targetPath}\n`
      : `Will install new MCP server "${serverName}" -> ${mcp.url} in ${targetPath}\n`,
  );

  if (options.dryRun) {
    process.stdout.write("Dry run: no changes written. Re-run without --dry-run to apply.\n");
    return 0;
  }

  process.stderr.write("> dfl-auth refresh (best-effort)\n");
  const refreshed = await refreshDflAuth();
  if (!refreshed) {
    process.stderr.write("  (dfl-auth refresh failed or unavailable; using existing token)\n");
  }

  const jwt = readAccessToken();
  const server = buildHttpServer(mcp.url, jwt);
  const { backupPath, replaced } = mergeMcpServer({ path: targetPath, name: serverName, server });

  process.stdout.write(
    replaced
      ? `Replaced existing MCP server "${serverName}"\n`
      : `Installed new MCP server "${serverName}"\n`,
  );
  process.stdout.write(`Installed MCP server "${serverName}" -> ${mcp.url}\n`);
  process.stdout.write(`Updated ${targetPath}\n`);
  if (backupPath) process.stdout.write(`Backup written to ${backupPath}\n`);
  process.stdout.write("Restart Claude to load the new MCP server.\n");
  return 0;
}
