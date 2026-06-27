import type { SkillKind } from "./skill.js";

export interface SkillBase {
  owner?: string;
  repo?: string;
  skill?: string;
  name?: string;
  description?: string;
  kind?: SkillKind;
}
