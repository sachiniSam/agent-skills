# `asg` CLI — command map

Use this to route a user's intent to the right command. It lists what exists, not every flag —
**always confirm exact flags at runtime** with `asg <command> --help` (the CLI self-documents, so
its help is the source of truth even as the tool evolves). Don't guess flag names from this map.

## Command pattern

```bash
asg <resource> <action> [flags]
```

## Global flags (available on every command)

| Flag | Purpose |
|------|---------|
| `--format json\|yaml` | Structured output — use this when you need to parse the result (e.g. grab a client ID). |
| `-N`, `--no-interactive` | Disable prompts — required for any command the agent runs unattended. |
| `--no-color` | Plain output. |
| `-v`, `--verbose` | Detailed logs — use when diagnosing a failure. |

> When the agent runs a command to extract a value (like a created app's client ID), pass
> `--format json --no-interactive` so the output is parseable and nothing blocks on a prompt.

## Output caveat — `create` may not return the new ID

Don't assume a `create` command prints the new resource's ID (or an app's `clientId`) — several don't,
even with `--format json`. Treat creation and ID-retrieval as two steps: create, then fetch the ID with
the matching `view` / `list` / `filter`.

```bash
asg apps create --name "store-frontend" --type spa --redirect-uri "http://localhost:5173" --no-interactive -y
asg apps view --name "store-frontend" --format json     # read clientId / id here
```

The same pattern applies to roles (`asg roles filter --query "displayName eq <name>" --format json`),
API resources (`asg apis filter ...`), and other resources. Build the follow-up fetch into the flow
rather than parsing the create output and finding nothing.

## Gotchas when running unattended

- **`-y` isn't `-N`.** `-y` confirms a destructive/creation prompt but some commands (e.g.
  `asg roles create`) *still* raise a separate interactive prompt — without `--no-interactive` they fail
  with "could not open TTY". Pass **both** `-N -y` for any create/update the agent runs unattended.
- **Parsing JSON.** Spinner/ANSI prefixes can be interleaved with `--format json` output and break a naive
  `JSON.parse`; add `--no-color` and strip any leading non-`{`/`[` lines before parsing. `--output <file>`
  may not be written when the command errors, so don't rely on the file existing after a failure.
- **`roles list` is deprecated** — use `asg roles filter ...` to enumerate roles (and `asg roles users list
  --id <roleId>` for a role's members).

## Resource domains

| Resource | Actions | Notes |
|----------|---------|-------|
| `login` / `logout` / `status` | — | See `auth.md`. User runs login; agent runs status. |
| `apps` | `create`, `list`, `view`, `update`, `delete`, `filter`, `settings` | Applications. `create` supports types `oidc`, `spa`, `mobile`, `saml`. See SDK integration. |
| `users` | `create`, `view`, `update`, `delete`, `filter`, `settings` | Org users. |
| `groups` | `create`, `view`, `update`, `delete`, `filter`, `members`, `roles`, `settings` | `members add/list/remove`; `roles list`. |
| `roles` | `create`, `view`, `update`, `delete`, `filter`, `users`, `groups`, `settings` | `users add/list/remove`, `groups add/list/remove`. |
| `idps` | `list`, `view`, `delete` | Identity providers (read/delete only via CLI). |
| `apis` | `create`, `view`, `update`, `delete`, `filter`, `scopes`, `settings` | API resources. `apis scopes add/list/delete`. |
| `scopes` | `filter` | Filter API-resource scopes across the org. |
| `branding` | `create`, `view`, `update`, `delete` | Org branding preferences. |
| `orgs` | `create`, `view`, `update`, `delete`, `filter`, `self`, `settings` | Organizations. `orgs self` = current org from the token. |
| `agents` | `create`, `view`, `update`, `delete`, `filter` | Asgardeo agents. |
| `api` | — | Send a raw authenticated API request to Asgardeo (escape hatch). |
| `tui` | — | Interactive terminal dashboard. Must be logged in. The agent should not launch it — point the user to `asg tui` if they want interactivity. |
| `docs` | `generate`, `view` | `asg docs generate --directory <dir>` writes full markdown docs; `asg docs view --command "apps view"` prints one. |

## Common read patterns

```bash
asg apps list
asg users filter --query "name co alice" --format json
asg apis filter --query "name co payments"
asg orgs self
asg groups view -i <group_id>
asg roles users list -i <role_id>
```

## Discovering exact usage

When unsure about flags for any action, read the help instead of guessing:

```bash
asg <resource> --help
asg <resource> <action> --help
```

`asg apps create --help`, for example, lists the type-specific flags (`--redirect-uri`, `--issuer`,
`--acs-uri`, etc.). For a richer reference, generate the full docs once:

```bash
asg docs generate --directory <tmp-dir>
```
