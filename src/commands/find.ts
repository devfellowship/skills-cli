import { searchSkills } from "../api.js";
import type { SkillBase } from "../types/skillbase.js";

function formatRow(skill: SkillBase): string {
  const id =
    skill.owner && skill.repo
      ? `${skill.owner}/${skill.repo}${skill.skill ? `/${skill.skill}` : ""}`
      : (skill.name ?? "(unknown)");
  const kind = skill.kind ?? "skill";
  const desc = skill.description ? ` — ${skill.description}` : "";
  return `  [${kind}] ${id}${desc}`;
}

export async function runFind(query: string): Promise<number> {
  if (!query || query.trim().length === 0) {
    process.stderr.write("Usage: dfl-skills find <query>\n");
    return 1;
  }
  const res = await searchSkills(query);
  if (!res.skills || res.skills.length === 0) {
    process.stdout.write(`No skills found for "${query}".\n`);
    return 0;
  }
  process.stdout.write(`Found ${res.skills.length} result(s) for "${query}":\n`);
  for (const skill of res.skills) {
    process.stdout.write(`${formatRow(skill)}\n`);
  }
  return 0;
}
