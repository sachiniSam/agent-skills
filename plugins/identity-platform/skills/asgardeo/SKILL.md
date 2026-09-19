---
name: asgardeo
description: >
  Asgardeo (WSO2 Identity Platform) work through the `asg` CLI. Use when the user wants to add
  login, SSO, social login, MFA, or passwordless sign-in to an app; gate features or an API by
  role, permission, or OAuth2 scope; give an AI agent its own identity, credentials, or
  act-on-behalf-of tokens; secure an MCP server or gate its tools behind OAuth; create, list, update, or delete Asgardeo resources (applications,
  users, groups, roles, identity providers, API resources, branding, organizations, agents) or
  configure any other Asgardeo setting; install, log in to, or run the asg CLI; or debug an
  Asgardeo failure such as a 403 or a login that won't complete.
---

# Asgardeo (WSO2 Identity Platform)

You manage Asgardeo end-to-end through the `asg` CLI — registering and authenticating apps, authorizing them with roles and API scopes, managing identity resources, and wiring the Asgardeo SDK into the user's code.

Users arrive with one intent — "let people log in", "lock this down by role", "add a user", "why the 403". Route to one track and start there. Prefer `asg <cmd> --help` over guessing flags (the CLI self-documents); the official docs at https://wso2.com/identity-platform/docs are the fallback when the CLI or SDK surface is ambiguous.

**How to work:**
- **Two gates stand before anything is created** — a session (Gate 1) and an approved plan (Gate 2). Every track starts past both.
- **Ask through the harness's question UI, everywhere it exists.** Where a structured question tool is available (`AskUserQuestion` in Claude Code), route every question through it — an app or agent name, a role name, a redirect URI, which scenario applies, approving the plan. Ask related questions together in one call, and rely on the tool's free-text option for "something else". Where no such tool exists, ask the same questions in prose, in one message. Either way: **end the turn and wait.**
- **Pre-empt the blocker before it blocks.** A fresh org has no one to log in as — offer a test user *before* the login test. When login works, offer role-gating.
- **Show the user what you changed.** When you create or modify a resource, include its Console link in the summary (`https://console.asgardeo.io/t/<org>/app/<resource>/<id>` — see `cli-overview.md`) so they can inspect or adjust it themselves. Essential when a step is Console-only: link straight to the screen.
- **On a failure, diagnose (Track D) before trying something else.**
- **Track names are internal.** Say "set up login" or "gate features by role" to the user — never "Track A".

## Reference files

Load only what the current track points to:
- `references/auth.md` — CLI login flow. Read before handling authentication.
- `references/planning.md` — the plan's three headings and the one-table-per-resource shape. Read at Gate 2.
- `references/cli-overview.md` — intent → command map, output/parsing behavior, unattended-run gotchas, and failure diagnosis. Read when running management commands, and when one fails.
- `references/authorize-app.md` — the full RBAC pipeline with exact commands. Read in Track B.
- `references/authentication-methods.md` — social/enterprise login, MFA, passwordless; editing an app's login flow. Read in Track A when the user wants more than username/password.
- `references/sdk-integration.md` — framework routing (which docs quickstart to fetch, app type, package), the inputs every integration needs (`clientId`, `baseUrl`, redirect URI), and how to call a protected API and read roles. Read before touching app code.
- `references/agent-identity.md` — giving an AI agent its own credentials, roles and tokens, and letting it act on a user's behalf; SDK calls by language and framework. Read in Track E.
- `references/mcp-server.md` — registering an MCP server as a resource, the client app shape, protecting the server with `@asgardeo/mcp-express` or FastMCP, and the Inspector proof. Read in Track F.
- `references/management-apis.md` — feature areas with no CLI verb (consent, templates, governance, sessions, user stores, webhooks…) → their management REST APIs via `asg api`. Read when a request matches no CLI command.

Bundled script: `scripts/install-asg-cli.js` (run with `node <absolute path>`) — clones and builds the CLI.

---

## Gate 1 — a session (always first)

1. **CLI present?** `asg --help`. If missing, it's built from source with Go (no released binaries). Ask: user installs it ([repo steps](https://github.com/sachiniSam/asgardeo-cli/tree/trial/cli-preview), trial branch), or you run `node <skill>/scripts/install-asg-cli.js` (checks Go, clones, `go install`, fixes PATH; on `path-update-failed`, tell the user to add `$(go env GOPATH)/bin` to PATH; on clone failure, the user clones with their credentials and re-runs).
2. **Authenticated?** `asg status`. If not: **the user runs `asg login`**, then re-verify. Offer to run it for them if they'd prefer — the browser path only, never with a client secret; `references/auth.md` has the rules.

**Ask for the login on its own.** Nothing can be created, inspected, or verified without a session, so send one short message — what to run and why — and stop there. The user has one thing to do; make it the only thing on screen:

> Before I can set anything up in Asgardeo I need a session on your org. Run `asg login` — it asks for your organisation name, then opens a browser to sign in. Tell me when you're through, or give me the org name and I'll start it for you.

Once `asg status` confirms the session, move to Gate 2.

## Gate 2 — an approved plan

**Questions first, then the plan, then wait.** Ask everything the track needs (names, URIs, which scenario applies), wait for the answers, then write the plan from them — a plan that names resources the user hasn't chosen is a decision dressed up as a proposal, and it puts them in the position of correcting you rather than deciding.

The plan has three headings — **What I'll create**, **What changes in your code**, **How you'll know it worked** — with one small table per kind of resource. Shape and worked example: `references/planning.md`. Then **end the turn**, approve it as a question, and create nothing until they answer.

---

## Router

| User wants to… | Track |
|---|---|
| Add login / SSO / social login / MFA / passwordless to an app | **A — Authenticate an app** |
| Add roles, permissions, "only admins can…", protect an API with scopes | **B — Authorize an app** |
| Give an AI agent its own identity and credentials, or let it act on a user's behalf | **E — Agent identity** |
| Secure an MCP server — require login to use its tools, gate tools by scope | **F — Secure an MCP server** |
| Create/list/update/delete users, groups, roles, apps, APIs, IdPs, branding, orgs, agents | **C — Manage resources** |
| Configure anything else Asgardeo manages (consent, templates, governance, sessions, user stores, webhooks…) | **C**, via `references/management-apis.md` |
| Debug a failure — 403, login won't complete, empty claims | **D — Troubleshoot** |

Real sessions chain tracks (authenticate → authorize; secure an MCP server → give an agent an identity to call it). Finish one, re-route.

---

## Track A — Authenticate an app

Goal: an app registered in Asgardeo and its SDK wired so users can log in.

1. **Identify the framework** — inspect the project or ask. Framework decides the app type: `spa` (browser SPAs), `oidc` (server-rendered/confidential), `mobile`.
2. **Settle the name and redirect URI at Gate 2** — both go on the app:
   - **Name** — what the user and their teammates see in the Console for the life of the org. Propose one from the project (repo or package name) and ask; create only under a name the user has confirmed.
   - **Redirect URI** — the SDK's sign-in redirect must be registered on the app; confirm the dev URL. Ask whether there's a deployed URL too and register both at once: `apps protocol update --edit 'callbackURLs=[…]'` replaces the whole array, so adding production later means restating the dev URL in the same command or silently losing it.
   - **Access token type** — opaque (default, revocable) unless a backend will read the tokens, in which case create with `--access-token-type jwt` now: Track B step 5 is the same setting applied later, and discovering it late looks like "roles aren't working" rather than a token-format problem. A backend that exists but doesn't check tokens yet is borderline — say what each choice costs and let the user pick.
3. **Register the app** — `asg apps create --name "<name>" --type <spa|oidc|mobile> --redirect-uri <url> -N -y`. The output includes the new app's **ID and Client ID** — capture them. For `oidc` apps the user reads the client secret from the Console (`asg apps settings`); secrets never pass through chat.
   - The CLI derives **allowed origins** from the redirect URIs. If login later fails on CORS at the token exchange rather than on the redirect, check `allowedOrigins` in `asg apps protocol view` — not just `callbackURLs`.
4. **Wire the SDK** — `references/sdk-integration.md` routes to the framework's docs quickstart and lists the inputs (`clientId` from the create output, `baseUrl` from `asg status`); wire the provider + login/logout. (It also covers calling a protected API and reading roles, needed later in Track B.)
5. **More than username/password?** Social, enterprise, MFA, passwordless → `references/authentication-methods.md`. Be explicit about which parts are CLI-editable and which are Console.
6. **Someone to log in as** — a fresh org has no users. Offer to create a test user *before* the login test, and create it yourself. The account needs a working password immediately, and `asg users create` only sets one with `--password <value> --set-password` — without that flag Asgardeo emails the person to set their own, which never arrives for a test address. Generate a strong password, pass it, and report it **once, in the summary afterwards**. It is a throwaway test credential — unlike a client or agent secret, which never passes through chat at all.
7. **Verify** — the user runs the app and signs in with that user. First suspect on failure: redirect-URI mismatch (Track D).
8. **Offer what's next** — typically role-gating (Track B).

---

## Track B — Authorize an app (RBAC)

Asgardeo authorization is **role-based access control over API scopes**: scopes are what the app or API checks; roles are how users get them. Read `references/authorize-app.md` and run its pipeline **in order** — each step depends on the previous:

1. **Register the API resource + its scopes** (`asg apis create`). Gating in-app features rather than a backend? Model those features as scopes on an API resource representing the app.
2. **Authorize the app** for that API and scopes (`asg apps apis add`; check with `asg apps apis list`).
3. **Set the role audience** — Application (one app) or Organization (org-wide). **Warn:** switching an app to Organization audience permanently deletes its application roles.
4. **Create roles** whose permissions are the scope names from step 1 (`asg roles create -p <scope>`), and **assign** them — to users directly, or to a group when more than one person holds the role.
5. **Switch the app to JWT access tokens** (`asg apps protocol update --edit "accessToken.type=JWT"`) if it wasn't created that way. Asgardeo issues **opaque** tokens by default, which a backend cannot decode or read scopes from — this blocks step 6 and is easy to miss.
6. **Enforce in the app** — request the scopes at login; validate the token and check its `scope` claim (worked Express example in `authorize-app.md`). To branch on role *names* instead, request the roles claim (`asg apps claims --add`) — reading it correctly is covered in `references/sdk-integration.md`.

Show scopes (before creating) and roles (after step 4) as tables — shape in `references/planning.md`. Say plainly when a step is Console-only. And remind the user: **a newly assigned role or scope appears only after that user logs in again.**

**Close by proving it** — a user *with* the role can do the gated thing; a user *without* it can't. Offer to create the second test user if needed.

---

## Track C — Manage resources

Direct CLI operations on users, groups, roles, apps, APIs, scopes, IdPs, branding, orgs, agents.

1. **Route** — `references/cli-overview.md` maps intent → command. No verb for it? **Read `references/management-apis.md` before improvising** — it maps the feature area to its REST API and shows the `asg api` call shape. Most of the wider surface is reachable that way; only a few UI experiences are Console-only. Guessing a path and getting an error is not evidence that something is Console-only.
2. **Confirm usage** — `asg <resource> <action> --help`; run unattended with `-N -y` and parse with `--format json` (conventions in `cli-overview.md`).
3. **Run and report** — ✓/✗ plus the result that matters (usually the new ID).
4. **Destructive ops need explicit confirmation** — state exactly what a `delete` or bulk update will remove and get the user's OK first. Delete only what the user asked about.

---

## Track D — Troubleshoot

- **A CLI command failed** → "When a command fails" in `references/cli-overview.md`: read the log
  first (the parsed API error is there), then the session-expired / 403 / login triage. The one rule
  worth internalizing: a 403 is a role-permission gap — re-login never fixes it.
- **App login (SDK) fails after wiring** → "When login fails after wiring" in
  `references/sdk-integration.md`: redirect-URI mismatch first, then missing claims/scopes.
- **An MCP client can't connect, or every tool call is refused** → the symptom table at the end of
  `references/mcp-server.md`. First suspect: the client app issues opaque tokens.
- **An agent can't get a token** → `references/agent-identity.md`, the section for the option in use.
  `ABA-60007` means the application was created without `--api-based-auth`.

---

## Track E — Agent identity

Goal: an AI agent with its own credentials, its own roles, and tokens that identify it — acting
either as itself or on a user's behalf.

Read `references/cli-overview.md` (this track runs a dozen management commands — the flags and the
deprecated `list` verbs are there) and `references/agent-identity.md`.

1. **Settle three things at Gate 2, in one question:** the agent's **name**; its **role name and scopes** (read the API to know them); and **how it acts** —
   - **On its own** — the agent's own permissions, for work not tied to a particular person
   - **On behalf of a user** — it borrows a specific person's permissions, with their consent (in the browser when they're signing in, or by CIBA when they're away). Most assistant-style agents are this one.
2. **Create the agent** — `asg agents create --allow-user-login` (which also creates the client it signs in through — the normal practice, don't ask), and give it a role. Track B is reused wholesale for permissions: an agent's roles and scopes work exactly like a user's. The one twist is that the agent's auto-created app takes **Application**-audience roles.
3. **Hand off the secret** — confirm the agent's `.env` is gitignored, then let the CLI write the credentials into it with `--env-file`. The secret is never shown; never read the clipboard yourself.
4. **Wire the token flow** — only this step differs between the two ways of acting, and the reference has a section for each, routed by language and framework. The Asgardeo SDK does the exchange (`@asgardeo/javascript` or `asgardeo_ai`); don't hand-roll it. When the agent acts for a user, that person's sign-in happens in the browser exactly as in Track A — the agent never sees their password.
5. **Prove it** — the user's to run, not yours: give them the exact command and what they should see, as Track A does with "try signing in".

---

## Track F — Secure an MCP server

Goal: an MCP server whose tools can only be used with a valid Asgardeo token, gated by scope.
Read `references/mcp-server.md`. The MCP server is a **resource** (Track B's API resource, type
`MCP`); the thing that logs in is the **MCP client** (Inspector, Claude Desktop, Cursor, an agent).

1. **Settle at Gate 2, in one question:** the server's **URL** (its identifier and `aud`), the
   **scopes** — one per tool or tool group, read the server's code to propose them — and **which
   MCP client** will connect (decides the redirect URI; Inspector when there is none yet).
2. **Register the MCP server** — `asg apis create --type mcp --identifier <server URL>` with the
   scopes. The identifier becomes the token's `aud`.
3. **Register the MCP client app** — `asg apps create --type mcp --redirect-uri <client callback>`,
   which is a public client with PKCE and **JWT** access tokens. An agent as the client is Track
   E's app instead.
4. **Authorize and assign** — Track B steps 2–4: authorize the app for the MCP server's scopes,
   create roles carrying them, assign to users. Show scopes and roles as tables.
5. **Protect the server** — `@asgardeo/mcp-express` (`router()` + `protect()`) or the FastMCP
   `TokenVerifier`; then a per-tool scope check, which neither SDK does for you.
6. **Prove it** — the user runs MCP Inspector against the server: 401 without a token, tools
   listed after login as a user with the role, a tool refused for a user without it.

---

## Quick reference

- Command pattern: `asg <resource> <action> [flags]` — `--help` at every level
- Unattended: `-N -y`; parseable: `--format json` (stdout is then pure data)
- `baseUrl` for SDKs and Console links: the `Base URL` line from `asg status`, verbatim — the rule and why is in `references/sdk-integration.md`
- Interactive dashboard: `asg tui` (point the user to it; don't launch it yourself)
