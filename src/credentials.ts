import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export function credentialsPath(): string {
  return join(homedir(), ".dfl-mcp", "credentials.json");
}

export function readAccessToken(path = credentialsPath()): string {
  const raw = readFileSync(path, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("access_token" in parsed) ||
    typeof (parsed as { access_token: unknown }).access_token !== "string"
  ) {
    throw new Error(`No string access_token in ${path}`);
  }
  return (parsed as { access_token: string }).access_token;
}

/** Best-effort `dfl-auth refresh`. Never throws; returns whether it succeeded. */
export async function refreshDflAuth(): Promise<boolean> {
  try {
    await execFileAsync("dfl-auth", ["refresh"], { timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}
