# `asg` CLI — command map

Use this to route a user's intent to the right command. It lists what exists, not every flag —
**always confirm exact flags at runtime** with `asg <command> --help` (the CLI self-documents, so
its help is the source of truth even as the tool evolves). Don't guess flag names from this map.

## Command pattern

```bash
asg <resource> <action> [flags]
```

## Resource domains

| Resource | Actions | Notes |
|----------|---------|-------|
| `login` / `logout` / `status` | — | See `auth.md`. User runs login; agent runs status. |
| `apps` | `create`, `list`, `view`, `update`, `delete`, `filter`, `settings`, `apis`, `claims`, `protocol`, `export` | Applications. `create` supports types `oidc`, `spa`, `mobile`, `saml`. `apis add/list/remove` manages which API resources the app may request scopes from; `claims` views/updates requested user attributes; `protocol view/update` manages OIDC/SAML settings (redirect URIs, token type, grant types). See SDK integration. |
| `users` | `create`, `view`, `update`, `delete`, `filter`, `settings` | Org users. |
| `groups` | `create`, `view`, `update`, `delete`, `filter`, `members`, `roles`, `settings` | `members add/list/remove`; `roles list`. |
| `roles` | `create`, `view`, `update`, `delete`, `filter`, `users`, `groups`, `settings` | `users add/list/remove`, `groups add/list/remove`. |
| `idps` | `list`, `view`, `delete` | Identity providers (read/delete only via CLI). |
| `apis` | `create`, `view`, `update`, `delete`, `filter`, `scopes`, `settings` | API resources. `apis scopes add/list/delete`. |
| `scopes` | `filter` | Filter API-resource scopes across the org. |
| `branding` | `create`, `view`, `update`, `delete` | Org branding preferences. |
| `orgs` | `create`, `view`, `update`, `delete`, `filter`, `self`, `settings` | Organizations. `orgs self` = current org from the token. |
| `agents` | `create`, `view`, `update`, `delete`, `filter` | Asgardeo agents. |
| `api` | — | Raw authenticated API request — the escape hatch for anything without a verb. Syntax: `asg api "/api/server/v1/<path>" -X GET`, add `-b '<json>'` or `-b @file.json` for a body, `-q key=value` for query params, `-r` for the raw response, `-o <file>` to save it. Paths starting `/api/`, `/scim2/`, `/scim/` pass through as-is. Which API to call: `management-apis.md`. |
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

## Global flags (available on every command)

| Flag | Purpose |
|------|---------|
| `--format json\|yaml` | Structured output — use this when you need to parse the result (e.g. grab a client ID). |
| `-N`, `--no-interactive` | Disable prompts — required for any command the agent runs unattended. |
| `--no-color` | Plain output. |
| `-v`, `--verbose` | Detailed logs — use when diagnosing a failure. |

## Create output — identifiers come back from the create call

`create` no longer needs a follow-up `view`/`filter` to learn the new resource's ID.

Without `--format`, the identifiers are printed as plain lines:

```bash
asg apps create --name "store-frontend" --type spa --redirect-uri "http://localhost:5173" -N -y
# SUCCESS: Application store-frontend (spa) created successfully
# ID: <app-id>
# Client ID: <client-id>
```

With `--format json|yaml`, the full server response is printed instead — parse it directly:

```bash
CLIENT_ID=$(asg apps create --name "store-frontend" --type spa \
  --redirect-uri "http://localhost:5173" -N -y --format json | jq -r .clientId)
```

`clientId` appears only for applications; every resource returns `id`.

## Gotchas when running unattended

- **`-y` isn't `-N`.** `-y` skips confirmation prompts (every mutating command accepts `-y/--yes`),
  but interactive *input* prompts are separate — without `--no-interactive` a command missing a flag
  falls back to a TTY prompt and fails unattended. Pass **both** `-N -y` for any create/update the
  agent runs unattended.
- **Parsing JSON.** With `--format json|yaml`, stdout carries only the payload — progress and success
  messages go to stderr — so `| jq` and `> file.json` work directly, with no prefix-stripping.
  **Capture stdout only; never `2>&1` when you intend to parse** — merging the streams is what puts
  spinner frames and warnings in front of the JSON. Note `--output <file>` may not be written when a
  command errors, so don't rely on the file after a failure.
- **`list` is deprecated on `apis`, `agents`, `roles`, `users` and `groups` — use `filter`.** `list`
  fetches everything and warns; `filter` is where narrowing lives and is what these resources are
  meant to be read with. To see everything, `filter` with no query. Two filters worth knowing:
  - your own APIs, without Asgardeo's ~200 built-in resources: `asg apis filter -q "type eq BUSINESS"`
  - an agent by name: `asg agents filter -q 'name eq "support-assistant"'`

  `apps list` is not deprecated. A role's members: `asg roles users list --id <roleId>`.
- **`--edit` uses `path=value`** (dot-separated path, `=` separator, `@file.json` for complex values):
  `asg apps update -i <id> --edit "name=NewName" -y`. Colons (`name:NewName`) are rejected.
- **File-based update works unattended** — `asg <resource> update -i <id> --file <prepared.json> -N`
  imports the prepared JSON directly (no export/edit/confirm cycle; the file is left untouched).
  Interactive mode keeps the export → edit → confirm flow. These are full-replace updates, so edit a
  copy of the current configuration rather than writing a partial file.
- **Where the file comes from differs by resource.** Applications are the only resource with a
  declarative representation on the server:
  - **Apps** — `asg apps export -i <id> --file app.json`. Its output is *not* `apps view` JSON: the
    keys and structure differ (`applicationName` vs `name`, `claimConfig` vs `claimConfiguration`,
    protocol config inlined rather than linked). Feeding `apps view` output to `apps update --file`
    fails with `APP-65001`. Secrets are excluded from the export.
  - **Everything else** — there is no `export` command, because there is no export endpoint.
    `asg <resource> view -i <id> --format json > config.json` already produces what
    `update --file` accepts.
  For a targeted app change, `--edit "path=@file.json"` is simpler than a whole round trip.
- **`apps update --file` must match the file's application.** The server identifies the target by
  the `applicationName` inside the file, not by `-i`. The CLI now rejects a mismatch rather than
  updating the wrong app, so export the app you intend to change — don't reuse another app's file.
- **Role user/group JSON shapes** — `--users`/`--groups` take a JSON *array*:
  `--users '[{"value":"<user-id>"}]'`. For single IDs prefer `-u <user-id>` / `-g <group-id>`.

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

## Protocol settings vs application settings

An application's settings live in **two** places, and which one a field belongs to decides the
command. `apps update --edit` reaches the application object only; a protocol field returns a
generic 400 whatever path you spell it with.

| Application object → `asg apps update --edit` | Protocol resource → `asg apps protocol update --edit` |
|---|---|
| `name`, `description`, `accessUrl` | `callbackURLs`, `allowedOrigins` (redirect URIs) |
| `advancedConfigurations.*` (consent, discoverability) | `accessToken.type` (JWT vs opaque), token expiry |
| `claimConfiguration.*` (requested claims) | `grantTypes`, `pkce.*`, `refreshToken.*`, `publicClient` |
| `authenticationSequence.*` (login flow) | `idToken.*`, `logout.*`, `subject.*` |

```bash
asg apps protocol view --id <appId> --format json -N              # everything editable
asg apps protocol update --id <appId> --edit "accessToken.type=JWT" -N -y
asg apps protocol update --id <appId> --edit 'callbackURLs=["http://localhost:3000"]' -N -y
```

Values keep their JSON type, so `--edit "pkce.mandatory=false"` sends a boolean and
`--edit "refreshToken.expiryInSeconds=604800"` a number. Fields you do not name keep their values:
the command fetches the resource, merges the edit and writes it back (the endpoint has no PATCH, so
doing this by hand means round-tripping every field yourself). `--protocol saml` targets a SAML
app's resource instead — run `protocol view` first to see its field names.

Redirect URIs can also be set at creation with `--redirect-uri`, and the token format with
`--access-token-type jwt|opaque`.

> `export` exists on **applications only** — `asg apps export -i <id> --file app.json` — so an app's
> configuration can be exported, edited and applied back without an interactive session. For other
> resources use `view --format json`; there is no `<resource> export`.

## Console links — let the user see what changed

After creating or changing something, give the user its Console URL so they can look at it. The
pattern is stable:

```
https://console.asgardeo.io/t/<org>/app/<resource>/<id>
```

`<org>` is what `asg status` shows; `<resource>` is `applications`, `users`, `groups`, `roles`,
`organizations`, or `api-resources`. Applications also take a tab fragment —
`…/applications/<id>#tab=protocol` (also `general`, `user-attributes`, `sign-in-method`,
`api-authorization`, `roles`, `advanced`, `info`), which is useful for pointing at the exact screen
a Console-only step needs.

`asg <resource> settings` builds the same URL and opens a browser, but it needs an interactive
terminal — construct the link and let the user click it instead.

(Self-hosted Identity Server: `<identity-server-url>/t/<org>/console/<resource>/<id>`.)

## When a command fails

**Read the log first.** A generic `ERROR: Failed to …` has its real cause one line away in the CLI
log (macOS `~/Library/Application Support/asgardeo-cli/logs/asgardeo-cli.log`; Linux typically
`~/.config/asgardeo-cli/logs/`): the API error is recorded as-is (`code`, `message`, `description`,
`traceId`; `detail` for SCIM). Re-running with `-v` shows the same inline. Keep the `traceId` — it's
what Asgardeo support needs if you escalate.

- **"Session has expired"** — the silent token refresh failed (refresh token expired or revoked).
  The one failure where the fix is a fresh `asg login` by the user.
- **403 / "operation is not permitted"** — the signed-in user's role lacks that management
  permission. **Re-login never fixes this** — an admin grants the role/permission, *then* the user
  logs in again. (Rare: an HTML error page with no WSO2 branding in the log means an edge/WAF
  block — Asgardeo support, with endpoint + `traceId`.)
- **Backend can't read the token / scopes look empty** — the app is issuing **opaque** access
  tokens (the default). Decoding one as a JWT fails and every scope check comes back empty. Switch
  the app to JWT before debugging further: `authorize-app.md` step 5.
- **Login fails at once with "Client credentials are invalid"** — CLI access is not enabled for
  that organization (default-on for new organizations, opt-in for older ones; enabled once in the
  Console), or the organization name is wrong.
- **Login won't complete** — wrong org name (must be the root org name), or the browser sign-in
  wasn't finished; if no browser could open, the terminal printed the URL and code to use manually.
  Verify with `asg status` before retrying.

Still stuck: fetch the specific docs page, not the tree — guides
`https://wso2.com/identity-platform/docs/guides/`, APIs `https://wso2.com/identity-platform/docs/apis/`.
