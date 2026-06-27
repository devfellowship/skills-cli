import type { SkillBase } from "./skillbase.js";

export interface ConnectionSkill extends SkillBase {
  kind: "connection";
  endpoint?: string;
  infisicalPath?: string;
  scopes?: string[];
}
