import type { SkillBase } from "./types/skillbase.js";
import type { SkillSearchResponse } from "./types/skillsearchresponse.js";

export const DEFAULT_REGISTRY = "https://skills.devfellowship.com";

export function registryBase(): string {
  const fromEnv = process.env["SEARCH_API_BASE"];
  const base = (fromEnv && fromEnv.trim().length > 0 ? fromEnv : DEFAULT_REGISTRY).replace(
    /\/+$/,
    "",
  );
  // The registry response drives which MCP url we write a Bearer JWT to, so the
  // registry itself must be reached over TLS — reject a plaintext base outright.
  if (!base.startsWith("https://")) {
    throw new Error(
      `Registry base must be https:// (got "${base}"). Fix SEARCH_API_BASE.`,
    );
  }
  return base;
}

/** A single skill-id segment: no path traversal, no shell/URL surprises. */
const SKILL_ID_SEGMENT_RE = /^[a-z0-9._-]+$/;

/** A slow/unresponsive registry must not hang the CLI forever. */
export const REGISTRY_TIMEOUT_MS = 25_000;

export async function getJson<T>(url: string, timeoutMs = REGISTRY_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new Error(`Registry timed out after ${timeoutMs / 1000}s: ${url}. Is it reachable?`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
  for (const segment of [owner, repo, skill]) {
    if (!SKILL_ID_SEGMENT_RE.test(segment)) {
      throw new Error(`Invalid skill id segment "${segment}" in "${id}"`);
    }
    // A leading "-" reaches downstream tooling (e.g. `npx skills`) as a flag.
    if (segment.startsWith("-")) {
      throw new Error(`Invalid skill id segment "${segment}" in "${id}": must not start with "-"`);
    }
    // The charset admits "." / ".." (path traversal) and dotfiles — reject them.
    if (segment === "." || segment === "..") {
      throw new Error(`Invalid skill id segment "${segment}" in "${id}": "." and ".." are not allowed`);
    }
    if (segment.startsWith(".") || segment.endsWith(".")) {
      throw new Error(`Invalid skill id segment "${segment}" in "${id}": must not start or end with "."`);
    }
  }
  return { owner, repo, skill };
}

export async function fetchSkill(ref: SkillRef): Promise<SkillBase> {
  const url = `${registryBase()}/api/v1/skills/${encodeURIComponent(ref.owner)}/${encodeURIComponent(
    ref.repo,
  )}/${encodeURIComponent(ref.skill)}`;
  const body = await getJson<{ skill?: SkillBase } & SkillBase>(url);
  return body.skill ?? body;
}
