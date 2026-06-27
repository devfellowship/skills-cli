import type { SkillBase } from "./types/skillbase.js";
import type { SkillSearchResponse } from "./types/skillsearchresponse.js";

export const DEFAULT_REGISTRY = "https://skills.devfellowship.com";

export function registryBase(): string {
  const fromEnv = process.env["SEARCH_API_BASE"];
  return (fromEnv && fromEnv.trim().length > 0 ? fromEnv : DEFAULT_REGISTRY).replace(/\/+$/, "");
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url} (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const message =
      typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(`Request to ${url} failed: ${message}`);
  }
  return parsed as T;
}

export async function searchSkills(query: string): Promise<SkillSearchResponse> {
  const url = `${registryBase()}/api/v1/skills/search?q=${encodeURIComponent(query)}`;
  return getJson<SkillSearchResponse>(url);
}

export interface SkillRef {
  owner: string;
  repo: string;
  skill: string;
}

export function parseSkillId(id: string): SkillRef {
  const parts = id.split("/").filter((p) => p.length > 0);
  if (parts.length !== 3) {
    throw new Error(`Expected skill id as "owner/repo/skill", got "${id}"`);
  }
  const [owner, repo, skill] = parts as [string, string, string];
  return { owner, repo, skill };
}

export async function fetchSkill(ref: SkillRef): Promise<SkillBase> {
  const url = `${registryBase()}/api/v1/skills/${encodeURIComponent(ref.owner)}/${encodeURIComponent(
    ref.repo,
  )}/${encodeURIComponent(ref.skill)}`;
  const body = await getJson<{ skill?: SkillBase } & SkillBase>(url);
  return body.skill ?? body;
}
