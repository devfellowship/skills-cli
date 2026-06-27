import type { SkillBase } from "./skillbase.js";

export interface SkillSearchResponse {
  searchType?: string;
  skills: SkillBase[];
  scope?: string;
  error?: string;
}
