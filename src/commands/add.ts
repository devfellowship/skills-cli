import { spawn } from "node:child_process";

import { DEFAULT_REGISTRY, registryBase } from "../api.js";

/**
 * Delegate `add`/`update` to the upstream `npx skills` CLI, which already knows
 * how to install SKILL.md skills across 72+ agents. We only default the
 * registry to DFL via SEARCH_API_BASE (respecting any user override).
 */
export function runSkillsPassthrough(subcommand: "add" | "update", args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      SEARCH_API_BASE: process.env["SEARCH_API_BASE"] ?? DEFAULT_REGISTRY,
    };
    process.stderr.write(`> npx skills ${subcommand} ${args.join(" ")} (registry: ${registryBase()})\n`);
    const child = spawn("npx", ["--yes", "skills", subcommand, ...args], {
      stdio: "inherit",
      env,
    });
    child.on("error", (err) => {
      process.stderr.write(`Failed to run npx skills: ${err.message}\n`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}
