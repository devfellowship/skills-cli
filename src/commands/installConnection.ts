import { fetchSkill, parseSkillId } from "../api.js";
import type { ConnectionSkill } from "../types/connectionskill.js";

export async function runInstallConnection(id: string): Promise<number> {
  if (!id || id.trim().length === 0) {
    process.stderr.write("Usage: dfl-skills install-connection <owner/repo/skill>\n");
    return 1;
  }

  const ref = parseSkillId(id);
  const skill = await fetchSkill(ref);

  if (skill.kind !== "connection") {
    process.stderr.write(
      `"${id}" has kind "${skill.kind ?? "skill"}", not "connection".\n`,
    );
    return 1;
  }
  const conn = skill as ConnectionSkill;

  const endpoint = conn.endpoint ?? "(none)";
  const infisicalPath = conn.infisicalPath ?? "(none)";
  const scopes = conn.scopes && conn.scopes.length > 0 ? conn.scopes.join(", ") : "(none)";

  process.stdout.write(`Connection: ${conn.name ?? id}\n`);
  if (conn.description) process.stdout.write(`  ${conn.description}\n`);
  process.stdout.write(`  endpoint:       ${endpoint}\n`);
  process.stdout.write(`  infisical path: ${infisicalPath}\n`);
  process.stdout.write(`  scopes:         ${scopes}\n`);
  process.stdout.write("\n");
  process.stdout.write("This connection stores only references — no secret values are written.\n");
  process.stdout.write("Inject secrets at runtime via Infisical:\n\n");

  const infisicalArg = conn.infisicalPath ? ` --path=${shellQuote(conn.infisicalPath)}` : "";
  process.stdout.write(`  infisical run${infisicalArg} -- <your-command>\n`);
  return 0;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
