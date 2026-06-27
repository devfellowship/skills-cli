#!/usr/bin/env node
import { registryBase } from "./api.js";
import { runSkillsPassthrough } from "./commands/add.js";
import { runFind } from "./commands/find.js";
import { runInstallConnection } from "./commands/installConnection.js";
import { runInstallMcp } from "./commands/installMcp.js";

const HELP = `@devfellowship/skills — DFL skills + MCP/connections installer

Usage: dfl-skills <command> [args]

Commands:
  find <query>              Search the DFL skills registry
  search <query>            Alias for find
  add <owner/repo>          Install a skill (delegates to \`npx skills add\`, DFL registry)
  update <owner/repo>       Update an installed skill (delegates to \`npx skills update\`)
  install-mcp <id>          Install an MCP server (kind:mcp) into ~/.claude.json
  install-connection <id>   Print a connection's reference + infisical run snippet
  --help, -h                Show this help

Notes:
  <id> is "owner/repo/skill".
  Registry override: set SEARCH_API_BASE to point anywhere (defaults to DFL).
  install-mcp writes an atomic, backed-up update to ~/.claude.json and never
  writes secrets. install-connection never writes secret values anywhere.

Registry: ${registryBase()}
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(HELP);
    return 0;
  }

  switch (command) {
    case "find":
    case "search":
      return runFind(rest.join(" "));
    case "add":
      return runSkillsPassthrough("add", rest);
    case "update":
      return runSkillsPassthrough("update", rest);
    case "install-mcp":
      return runInstallMcp(rest[0] ?? "");
    case "install-connection":
      return runInstallConnection(rest[0] ?? "");
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  });
