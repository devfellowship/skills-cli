import type { SkillBase } from "./skillbase.js";

export interface SkillListResponse {
  skills: SkillBase[];
  scope?: string;
}
