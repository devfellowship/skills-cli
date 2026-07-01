#!/usr/bin/env node
import { registryBase } from "./api.js";
import { runSkillsPassthrough } from "./commands/add.js";
import { runFind } from "./commands/find.js";
import { runInstallConnection } from "./commands/installConnection.js";
import { runInstallMcp } from "./commands/installMcp.js";

const HELP = `@devfellowship/skills — DFL skills + MCP/connections installer

Usage: dfl-skills <command> [args]

Commands:
  find <query>                 Search the DFL skills registry
  search <query>               Alias for find
  add <owner/repo[@skill]>     Install a skill (delegates to \`npx skills add\`, DFL registry)
  update <owner/repo[@skill]>  Update an installed skill (delegates to \`npx skills update\`)
  install-mcp <id>             Install an MCP server (kind:mcp) into ~/.claude.json
  install-connection <id>      Print a connection's reference + infisical run snippet
  --help, -h                   Show this help

Run \`dfl-skills <command> --help\` for per-command usage.

Notes:
  <id> is "owner/repo/skill". For add/update, target one skill with
  "owner/repo@skill" or the whole repo with "owner/repo".
  Registry override: set SEARCH_API_BASE to point anywhere (defaults to DFL).
  install-mcp writes an atomic, backed-up update to ~/.claude.json and never
  writes secrets. install-connection never writes secret values anywhere.

Registry: ${registryBase()}
`;

const COMMAND_HELP: Record<string, string> = {
  find: "Usage: dfl-skills find <query>\n\nSearch the DFL skills registry.\n",
  search: "Usage: dfl-skills search <query>\n\nAlias for `find`. Search the DFL skills registry.\n",
  add:
    "Usage: dfl-skills add <owner/repo[@skill]>\n\n" +
    "Install a skill (delegates to `npx skills add`, DFL registry).\n",
  update:
    "Usage: dfl-skills update <owner/repo[@skill]>\n\n" +
    "Update an installed skill (delegates to `npx skills update`).\n",
  "install-mcp":
    "Usage: dfl-skills install-mcp <owner/repo/skill> [--dry-run] [--yes]\n\n" +
    "Install an MCP server (kind:mcp) into ~/.claude.json.\n" +
    "  --dry-run   Print the intended change and exit without writing.\n" +
    "  --yes, -y   Apply without confirmation (default; write is non-interactive).\n",
  "install-connection":
    "Usage: dfl-skills install-connection <owner/repo/skill>\n\n" +
    "Print a connection's reference + infisical run snippet. Writes no secrets.\n",
};

function wantsHelp(args: string[]): boolean {
  return args.some((a) => a === "--help" || a === "-h");
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(HELP);
    return 0;
  }

  // A `--help`/`-h` in the ARG slot prints that subcommand's usage instead of
  // being passed through as an id/query (which would throw or search literally).
  if (command in COMMAND_HELP && wantsHelp(rest)) {
    process.stdout.write(COMMAND_HELP[command] as string);
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
    case "install-mcp": {
      const positional = rest.filter((a) => !a.startsWith("-"));
      const dryRun = rest.includes("--dry-run");
      return runInstallMcp(positional[0] ?? "", { dryRun });
    }
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
