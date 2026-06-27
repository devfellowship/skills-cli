import { fetchSkill, parseSkillId } from "../api.js";
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
  const { backupPath } = mergeMcpServer({ path: targetPath, name: serverName, server });

  process.stdout.write(`Installed MCP server "${serverName}" -> ${mcp.url}\n`);
  process.stdout.write(`Updated ${targetPath}\n`);
  if (backupPath) process.stdout.write(`Backup written to ${backupPath}\n`);
  process.stdout.write("Restart Claude to load the new MCP server.\n");
  return 0;
}
