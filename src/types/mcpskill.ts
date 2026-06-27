import type { McpTransport } from "./skill.js";
import type { SkillBase } from "./skillbase.js";

export interface McpSkill extends SkillBase {
  kind: "mcp";
  url?: string;
  transport?: McpTransport;
  auth?: string;
}
