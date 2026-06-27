# @devfellowship/skills

DFL skills + MCP/connections installer — a thin wrapper over the upstream
[`skills`](https://www.npmjs.com/package/skills) CLI (vercel-labs/skills).

The upstream `skills` CLI already installs `SKILL.md` skills into
`~/.claude/skills` for 72+ agents and reads its registry from the
`SEARCH_API_BASE` env var. This wrapper adds exactly two things on top:

1. Defaults the registry to DFL (`https://skills.devfellowship.com`).
2. Installs **MCP servers** and **connections** — which upstream does not do.

It does **not** re-implement the agent install matrix; `add`/`update` simply
shell out to `npx skills ...`.

## Install

```bash
npm i -g @devfellowship/skills
# or run ad-hoc:
npx @devfellowship/skills --help
```

## Commands

| Command | What it does |
| --- | --- |
| `dfl-skills find <query>` | Search the DFL registry (`GET /api/v1/skills/search`). |
| `dfl-skills search <query>` | Alias for `find`. |
| `dfl-skills add <owner/repo>` | Install a skill — delegates to `npx skills add` with `SEARCH_API_BASE` set to DFL. |
| `dfl-skills update <owner/repo>` | Update a skill — delegates to `npx skills update`. |
| `dfl-skills install-mcp <owner/repo/skill>` | Install a `kind:mcp` skill as an HTTP MCP server in `~/.claude.json`. |
| `dfl-skills install-connection <owner/repo/skill>` | Print a `kind:connection` reference + the `infisical run` snippet. |
| `dfl-skills --help` | Show help. |

### `install-mcp`

1. Fetches the skill from the API and verifies `kind: mcp`.
2. Best-effort `dfl-auth refresh` to renew the short-TTL dfl-iam JWT.
3. Reads `access_token` from `~/.dfl-mcp/credentials.json`.
4. **Atomically** merges into `~/.claude.json`:

   ```jsonc
   "mcpServers": {
     "<name>": {
       "type": "http",
       "url": "<url-from-frontmatter>",
       "headers": { "Authorization": "Bearer <jwt>" }
     }
   }
   ```

Atomic = write a temp sibling file, back up the original to `~/.claude.json.bak`,
then `rename()` over the target. The server name is validated against
`[a-z0-9-]`. It **never** writes `enableAllProjectMcpServers`.

### `install-connection`

Connections store **references only** — an endpoint URL, an Infisical path, and
scopes — never secret values. This command prints that metadata plus a runtime
injection snippet:

```bash
infisical run --path=/your/path -- <your-command>
```

Secrets are injected at runtime via `infisical run`; nothing secret is ever
persisted by this CLI.

## Skill kinds (SKILL.md frontmatter)

The `kind` is declared in the skill's `SKILL.md` frontmatter:

```yaml
---
kind: skill        # default if absent
---
```

```yaml
---
kind: mcp
url: https://x.mcp.devfellowship.com/mcp
transport: http
auth: bearer
---
```

```yaml
---
kind: connection
endpoint: https://api.example.com
infisicalPath: /shared/example
scopes: [read, write]
---
```

## Point the stock CLI at DFL (no wrapper needed)

The upstream CLI already honors the registry env var, so you can do this with
plain `npx skills`:

```bash
SEARCH_API_BASE=https://skills.devfellowship.com npx skills add owner/repo
```

The wrapper just makes that the default.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit, strict, no any
npm run build       # emits dist/
npm test            # atomic ~/.claude.json merge tested against temp fixtures only
```

Tests never touch the real `~/.claude.json` or `~/.dfl-mcp` — they operate on
temporary fixture files in a `mkdtemp` dir.
