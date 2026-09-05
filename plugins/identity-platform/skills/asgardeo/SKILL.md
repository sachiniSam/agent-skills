---
name: asgardeo
description: >
  Use this skill for any WSO2 Identity Platform (Asgardeo) work through the asg CLI —
  authenticating an app (adding login/SSO), authorizing an app (roles, permissions, and
  API scopes), or managing identity resources. Trigger when the user wants to add Asgardeo
  or WSO2 login / SSO / OIDC to a React, Next.js, Vue, Angular, JavaScript, or Node app;
  add social login, MFA, or passwordless/passkey sign-in; add role-based access,
  permissions, or "only admins can…" rules; register or authorize
  an OAuth2/OIDC application or an API resource and its scopes; install or use the asg CLI;
  log in to Asgardeo; create, list, update, or delete applications, users, groups, roles,
  identity providers, API resources, scopes, branding, organizations, or agents; or configure
  any other Asgardeo setting — consent, email templates, password/governance policies, user
  sessions, user stores, or webhooks. Also trigger
  on "add Asgardeo login", "authorize my app", "gate features by role", "integrate the
  Asgardeo SDK", "set up Asgardeo", "asg CLI", "create a user/group/role", or "why am I
  getting a 403 from Asgardeo" — even if they don't say "asg" or "OIDC" explicitly.
---

# Asgardeo (WSO2 Identity Platform)

You manage Asgardeo end-to-end through the `asg` CLI — registering and authenticating apps, authorizing them with roles and API scopes, managing identity resources, and wiring the Asgardeo SDK into the user's code.

Users arrive with one intent — "let people log in", "lock this down by role", "add a user", "why the 403". Route them to the right track fast; don't march them through phases. Prefer `asg <cmd> --help` over guessing flags (the CLI self-documents); the official docs at https://wso2.com/identity-platform/docs are the fallback when the CLI or SDK surface is ambiguous.

**How to work:**
- **Lead with a plan — once the gate has passed.** With the CLI installed and a session live, say in a few lines what you'll do and what the user ends up with — e.g. *"I'll register an SPA app in Asgardeo, wire the React SDK for login/logout, create a test user, and you'll try signing in."* Then start. While the user still has to log in, hold the plan back: see the Gate.
- **Close with what's next.** Never dead-end. Pre-empt blockers (a fresh org has no one to log in as — offer a test user *before* the login test) and offer the natural follow-up (login works → gate features by role).
- **Show the user what you changed.** When you create or modify a resource, include its Console link in the summary (`https://console.asgardeo.io/t/<org>/app/<resource>/<id>` — see `cli-overview.md`) so they can inspect or adjust it themselves. Essential when a step is Console-only: link straight to the screen.
- **✓ / ✗ every step**; on failure, diagnose (Track D) before trying something else.
- **Track names are internal.** Say "set up login" or "gate features by role" to the user — never "Track A".

## Reference files

Load only what the current track points to:
- `references/auth.md` — CLI login flow. Read before handling authentication.
- `references/cli-overview.md` — intent → command map, output/parsing behavior, unattended-run gotchas, and failure diagnosis. Read when running management commands, and when one fails.
- `references/authorize-app.md` — the full RBAC pipeline with exact commands. Read in Track B.
- `references/authentication-methods.md` — social/enterprise login, MFA, passwordless; editing an app's login flow. Read in Track A when the user wants more than username/password.
- `references/sdk-integration.md` — framework routing (which docs quickstart to fetch, app type, package), the inputs every integration needs, and how to call a protected API and read roles. Read before touching app code.
- `references/agent-identity.md` — giving an AI agent its own credentials, roles and tokens, and letting it act on a user's behalf; SDK calls by language and framework. Read in Track E.
- `references/management-apis.md` — feature areas with no CLI verb (consent, templates, governance, sessions, user stores, webhooks…) → their management REST APIs via `asg api`. Read when a request matches no CLI command.

Bundled script: `scripts/install-asg-cli.js` (run with `node <absolute path>`) — clones and builds the CLI.

---

## Gate — CLI installed and authenticated (always first)

1. **CLI present?** `asg --help`. If missing, it's built from source with Go (no released binaries). Ask: user installs it ([repo steps](https://github.com/wso2-enterprise/asgardeo-cli)), or you run `node <skill>/scripts/install-asg-cli.js` (checks Go, clones, `go install`, fixes PATH; on `path-update-failed`, tell the user to add `$(go env GOPATH)/bin` to PATH; on clone failure, the user clones with their credentials and re-runs).
2. **Authenticated?** `asg status`. If not: **the user runs `asg login`** — never the agent — then re-verify. Flow and rules: `references/auth.md`. Don't pass this gate without a session.

**Ask for the login on its own.** Nothing can be created, inspected, or verified without a session, so the whole plan is guesswork until it exists. Send one short message — what to run and why — and stop there. No plan, no proposed app name, no framework analysis, no list of what comes after. The user has one thing to do; make it the only thing on screen.

> Before I can set anything up in Asgardeo I need a session on your org. Run `asg login` and tell me when you're through — it opens a browser to sign in.

Once `asg status` confirms the session, *then* lay out the plan and start. Two short messages in sequence beat one that buries the ask.

---

## Router

| User wants to… | Track |
|---|---|
| Add login / SSO / social login / MFA / passwordless to an app | **A — Authenticate an app** |
| Add roles, permissions, "only admins can…", protect an API with scopes | **B — Authorize an app** |
| Give an AI agent its own identity and credentials, or let it act on a user's behalf | **E — Agent identity** |
| Create/list/update/delete users, groups, roles, apps, APIs, IdPs, branding, orgs, agents | **C — Manage resources** |
| Configure anything else Asgardeo manages (consent, templates, governance, sessions, user stores, webhooks…) | **C**, via `references/management-apis.md` |
| Debug a failure — 403, login won't complete, empty claims | **D — Troubleshoot** |

Real sessions chain tracks (authenticate → authorize). Finish one, re-route.

---

## Track A — Authenticate an app

Goal: an app registered in Asgardeo and its SDK wired so users can log in.

1. **Identify the framework** — inspect the project or ask. Framework decides the app type: `spa` (browser SPAs), `oidc` (server-rendered/confidential), `mobile`.
2. **Settle the name and redirect URI** — both go on the app and neither is yours to pick alone:
   - **Name** — this is what the user sees in the Console for the life of the org, and it's how their teammates will recognise it. Propose one from the project (repo or package name), ask, and **end the turn** — *"I'll register it as **Orders** — different name?"* — then create only after they reply. Proposing and carrying on in the same turn is deciding for them. Never create silently under a name you invented, and never use a placeholder like `my-app` or `test-app`.
   - **Redirect URI** — the SDK's sign-in redirect must be registered on the app; confirm the dev URL before creating.
3. **Register the app** — `asg apps create --name "<name>" --type <spa|oidc|mobile> --redirect-uri <url> -N -y`. The output includes the new app's **ID and Client ID** — capture them. For `oidc` apps the user reads the client secret from the Console (`asg apps settings`); secrets never pass through chat.
4. **Wire the SDK** — `references/sdk-integration.md` routes to the framework's docs quickstart; wire the provider + login/logout with `clientId` and `baseUrl`. (It also covers calling a protected API and reading roles, needed later in Track B.)
5. **More than username/password?** Social, enterprise, MFA, passwordless → `references/authentication-methods.md`. Be explicit about which parts are CLI-editable and which are Console.
6. **Someone to log in as** — a fresh org has no users. Offer to create a test user (`asg users create`) *before* the login test.
7. **Verify** — the user runs the app and signs in with that user. First suspect on failure: redirect-URI mismatch (Track D).
8. **Offer what's next** — typically role-gating (Track B).

---

## Track B — Authorize an app (RBAC)

Asgardeo authorization is **role-based access control over API scopes**: scopes are what the app or API checks; roles are how users get them. Read `references/authorize-app.md` and run its pipeline **in order** — each step depends on the previous:

1. **Register the API resource + its scopes** (`asg apis create`). Gating in-app features rather than a backend? Model those features as scopes on an API resource representing the app.
2. **Authorize the app** for that API and scopes (`asg apps apis add`; check with `asg apps apis list`).
3. **Set the role audience** — Application (one app) or Organization (org-wide). **Warn:** switching an app to Organization audience permanently deletes its application roles.
4. **Create roles** whose permissions are the scope names from step 1 (`asg roles create -p <scope>`), and **assign** them — to users directly, or to a group when more than one person holds the role.
5. **Switch the app to JWT access tokens** (`asg apps protocol update --edit "accessToken.type=JWT"`). Asgardeo issues **opaque** tokens by default, which a backend cannot decode or read scopes from — this blocks step 6 and is easy to miss. Creating the app with `--access-token-type jwt` avoids it entirely.
6. **Enforce in the app** — request the scopes at login; validate the token and check its `scope` claim (worked Express example in `authorize-app.md`). To branch on role *names* instead, request the roles claim (`asg apps claims --add`) — reading it correctly is covered in `references/sdk-integration.md`.

Say plainly when a step is Console-only. And remind the user: **a newly assigned role or scope appears only after that user logs in again.**

**Close by proving it** — a user *with* the role can do the gated thing; a user *without* it can't. Offer to create the second test user if needed.

---

## Track C — Manage resources

Direct CLI operations on users, groups, roles, apps, APIs, scopes, IdPs, branding, orgs, agents.

1. **Route** — `references/cli-overview.md` maps intent → command. No verb for it? **Read `references/management-apis.md` before improvising** — it maps the feature area to its REST API and shows the `asg api` call shape. Most of the wider surface is reachable that way; only a few UI experiences are Console-only. Guessing a path and getting an error is not evidence that something is Console-only.
2. **Confirm usage** — `asg <resource> <action> --help`; run unattended with `-N -y` and parse with `--format json` (conventions in `cli-overview.md`).
3. **Run and report** — ✓/✗ plus the result that matters (usually the new ID).
4. **Destructive ops need explicit confirmation** — state exactly what a `delete` or bulk update will remove and get the user's OK first. Never delete anything the user didn't ask about.

---

## Track D — Troubleshoot

- **A CLI command failed** → "When a command fails" in `references/cli-overview.md`: read the log
  first (the parsed API error is there), then the session-expired / 403 / login triage. The one rule
  worth internalizing: a 403 is a role-permission gap — re-login never fixes it.
- **App login (SDK) fails after wiring** → "When login fails after wiring" in
  `references/sdk-integration.md`: redirect-URI mismatch first, then missing claims/scopes.
- **An agent can't get a token** → `references/agent-identity.md`, the section for the option in use.
  `ABA-60007` means the application was created without `--api-based-auth`.

---

## Track E — Agent identity

Goal: an AI agent with its own credentials, its own roles, and tokens that identify it — acting
either as itself or on a user's behalf.

Read `references/cli-overview.md` (this track runs a dozen management commands — the flags and the
deprecated `list` verbs are there) and `references/agent-identity.md`. **Ask before building:** there are two ways an agent can act, and
the choice changes what you wire up. Put them to the user first —

1. **On its own** — the agent's own permissions, for work not tied to a particular person
2. **On behalf of a user** — it borrows a specific person's permissions, with their consent
   (in the browser when they're signing in, or by CIBA when they're away)

— in the same message as the proposed agent **name** and the **role name and scopes** (read the API to know them), then **end the turn and wait**; nothing is created until they answer. When they have, **lead with the plan** exactly as in Tracks A and B — what gets created, which files change, how it will be verified — then start. Most assistant-style agents are the second. The setup is shared to begin
with: the agreed **name**, then create it with `asg agents create --allow-user-login` (which also
creates the client it signs in through — the normal practice, don't ask), and give it a role. Only
the token flow differs, and the reference has a section for each.

Track B is reused wholesale for permissions: an agent's roles and scopes work exactly like a user's.
The one twist is that the agent's auto-created app takes **Application**-audience roles. What is
agent-specific is the identity, the credential handling, and the token exchange — and the Asgardeo
SDK does the exchange (`@asgardeo/javascript` or `asgardeo_ai`); don't hand-roll it. The reference
routes by language and framework.

The agent must never see the user's password. When it acts for a user, that person's sign-in happens
in the browser exactly as in Track A.

Two hard steps the reference spells out: the **secret handoff** (confirm the agent's `.env` is
gitignored, then let the CLI write the credentials into it with `--env-file` — the secret is never
shown; never read the clipboard yourself) and the **proof** at the
end — which is the user's to run, not yours: give them the exact command and what they should see,
as Track A does with "try signing in". Don't call their API yourself.

---

## Quick reference

- Command pattern: `asg <resource> <action> [flags]` — `--help` at every level
- Unattended: `-N -y`; parseable: `--format json` (stdout is then pure data)
- Base URL for SDKs: `https://api.asgardeo.io/t/<org-name>` — org from `asg status`
- Interactive dashboard: `asg tui` (point the user to it; don't launch it yourself)
