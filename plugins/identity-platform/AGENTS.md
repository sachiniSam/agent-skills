# identity-platform Plugin — Agent Conventions

## Skills in this Plugin

- [`skills/asgardeo/`](./skills/asgardeo/SKILL.md) — manage WSO2 Identity Platform (Asgardeo) end-to-end through the `asg` CLI

## asgardeo Skill

A mandatory **gate** followed by an **intent router** into four tracks:

- **Gate** — install the `asg` CLI (built from source via `go install`), then have the user run `asg login` themselves; verify with `asg status`. Management ops also need the right `internal_*_mgt` scope (not just a session).
- **Track A — Authenticate an app** — register an SPA/OIDC/mobile app, fetch the client ID (via `apps view`, since `create` may not return it), wire the matching Asgardeo SDK for login/logout. Optionally configure login methods (social, enterprise, MFA, passwordless): connections are Console-only (`asg idps` is read-only), but the per-app login flow is editable via `asg apps update --file`.
- **Track B — Authorize an app** — RBAC over API scopes, one ordered pipeline per the official guide: register API resource + scopes → authorize the app for them (RBAC policy) → set role audience → create roles from those scopes + assign → enforce by checking token scopes. Steps without a dedicated CLI verb (authorize-app-for-API, roles claim) use raw `asg api` calls, with the Console as fallback.
- **Track C — Manage resources** — direct CLI ops across apps, users, groups, roles, idps, apis/scopes, branding, orgs, agents; flags read from `asg <cmd> --help` at runtime.
- **Track D — Troubleshoot** — 403 diagnosis (HTML body = WAF; JSON = scope gap), login issues.

## Conventions

- **Credentials never flow through the agent.** Login (including the m2m client secret) is run by the user in their own terminal; the agent only runs `asg status`.
- **Read the CLI, don't memorize it.** The CLI self-documents — use `asg <cmd> --help` or `asg docs` for exact, current flags rather than hardcoding them.
- **Bundled scripts are Node (builtins only) or bash — no Python.**

## Key Reference Files

- `skills/asgardeo/references/auth.md` — login (user/device + m2m), credential safety, and the management-scope prerequisite
- `skills/asgardeo/references/cli-overview.md` — intent → command map across all resource domains, plus the create-then-fetch-the-ID caveat
- `skills/asgardeo/references/authentication-methods.md` — login methods (social, enterprise, MFA, passwordless) and editing an app's login flow, CLI vs Console (Track A)
- `skills/asgardeo/references/authorize-app.md` — the full RBAC pipeline (API resource + scopes → authorize app → role audience → roles → enforce) with exact commands (Track B)
- `skills/asgardeo/references/sdk-integration/` — one self-contained file per framework (react, nextjs, vue, javascript, node-express, dotnet) + a `README.md` selector and fallback doc-map; the agent reads only the relevant framework file
- `skills/asgardeo/references/troubleshooting.md` — 403 diagnosis, scope gaps, inspecting granted scopes (Track D)
- `skills/asgardeo/scripts/install-asg-cli.js` — clones the CLI repo and builds it with `go install`
