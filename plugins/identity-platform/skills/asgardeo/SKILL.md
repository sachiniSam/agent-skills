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
  log in to Asgardeo; or create, list, update, or delete applications, users, groups, roles,
  identity providers, API resources, scopes, branding, organizations, or agents. Also trigger
  on "add Asgardeo login", "authorize my app", "gate features by role", "integrate the
  Asgardeo SDK", "set up Asgardeo", "asg CLI", "create a user/group/role", or "why am I
  getting a 403 from Asgardeo" — even if they don't say "asg" or "OIDC" explicitly.
---

# Asgardeo (WSO2 Identity Platform)

You manage WSO2 Identity Platform (Asgardeo) end-to-end through the `asg` CLI — authenticating apps (login), authorizing apps (roles + API scopes), managing identity resources, and wiring the Asgardeo SDK into the user's code.

Users arrive with one intent — "let people log in", "lock this down by role", "add a user", "why the 403". Your job is to route them to the right track fast, not march them through phases. The official docs are at https://wso2.com/identity-platform/docs — defer to them when the CLI or SDK surface is ambiguous, and prefer reading `asg <cmd> --help` over guessing flags (the CLI self-documents).

**Your approach:**
- **Lead with a plan.** Before working a track, tell the user in a few lines what you're about to do and what they'll end up with, then start. It orients them and lets them redirect early. Example for Track A: *"I'll register an SPA app in Asgardeo, install the React SDK, wire up login/logout, then we'll create a test user and you can try signing in."*
- **Close with what's next.** Don't dead-end. After finishing a track, offer the natural follow-up — and pre-empt blockers: e.g. after wiring login, a brand-new org may have **no one to log in as**, so offer to create a test user *before* asking them to test. After that, offer to gate features by role (Track B).
- Use ✓ for success, ✗ for failure. When something fails, diagnose the likely cause before trying another approach (see Track D).
- **"Track A/B/C/D" are internal routing labels — never say them to the user.** When you state a plan or offer a next step, describe the thing in plain language ("set up login", "gate features by role", "protect your API", "create a test user"), not the track name. The user doesn't know what a "Track" is.

## Reference files

Read these when a track points you to them — don't load them all upfront:
- `references/auth.md` — CLI login (user/device) + the management-scope prerequisite. Read before handling login or when management commands return permission errors.
- `references/cli-overview.md` — intent → command map across every resource domain, plus output caveats. Read when routing a management task.
- `references/authorize-app.md` — the full RBAC pipeline (API resource + scopes → authorize app → role audience → roles → enforce) with exact commands and Console-only steps. Read in Track B.
- `references/authentication-methods.md` — login methods (social, enterprise, MFA, passwordless) and how to edit an app's login flow (CLI vs Console). Read in Track A when the user wants more than username/password.
- `references/sdk-integration/` — one self-contained file per framework (React, Next.js, Vue, JS, Node/Express, .NET): setup, login/logout, reading roles/claims, gotchas. Read only the file for the user's framework (`README.md` is the selector + fallback doc-map). Read before touching app code.
- `references/troubleshooting.md` — 403 diagnosis, scope gaps, inspecting granted scopes. Read in Track D.

Bundled script (invoke with `node` against the absolute path):
- `scripts/install-asg-cli.js` — clones the asgardeo-cli repo and builds it with `go install`.

---

## Gate — get the CLI ready and authenticated (always first)

Every track below depends on this. Do it before anything else.

**1. Check / install the CLI**

```bash
asg --help
```

If `asg` is not found, the CLI is built from source with Go (no released binaries yet), so Go must be installed. Ask whether the user wants to install it themselves or have you do it:
- **They do it:** point them at the [repo steps](https://github.com/wso2-enterprise/asgardeo-cli) — `git clone`, then `cd asgardeo-cli/cmd/asg && go install .`. Re-run `asg --help` after.
- **You do it:** `node <absolute-path-to-skill>/scripts/install-asg-cli.js` (checks Go, clones/reuses the repo, `go install`, ensures the Go bin dir is on PATH). It prints one status line; if it ends `path-update-failed`, tell the user to add `$(go env GOPATH)/bin` to PATH. If the private-repo clone fails, the user clones it with their credentials and re-runs.

**2. Authenticate**

Check `asg status`. If there's no session, **the user runs `asg login` themselves** (the agent never runs login or handles a secret), then re-verify with `asg status`. Details + the management-scope prerequisite are in `references/auth.md`. Don't proceed past this gate without an authenticated session.

---

## Router — match the user's intent to a track

| User shows up wanting to… | Go to |
|---|---|
| Add login / sign-in / SSO, social login (Google/GitHub), MFA, or passwordless / passkey | **Track A — Authenticate an app** |
| Add roles, permissions, "only admins can…", or protect an API with scopes | **Track B — Authorize an app** |
| Create/list/update/delete users, groups, roles, apps, APIs, IdPs, branding, orgs, agents | **Track C — Manage resources** |
| Debug a failure — 403, "operation not permitted", login won't complete | **Track D — Troubleshoot** |

Many real sessions chain these (authenticate → then authorize). Finish one track, then re-route.

---

## Track A — Authenticate an app

Register an application and wire its SDK so users can log in.

1. **Identify the framework** — inspect the project (`package.json`, layout) or ask. This picks the SDK and the app type: `spa` for browser SPAs (React/Vue/Angular/JS), `oidc` for server-rendered/confidential apps (Next.js server, Node/Express), `mobile` for mobile.
2. **Settle the redirect URI** — the SDK's sign-in redirect (e.g. `http://localhost:3000`) must be registered on the app. Confirm the dev URL.
3. **Register the app** — check flags with `asg apps create --help`, then create it:
   ```bash
   asg apps create --name "<name>" --type <spa|oidc|mobile> --redirect-uri "<url>" --no-interactive -y
   ```
   **Then fetch the client ID separately** — `apps create` does not reliably print the client ID, so don't try to parse it from the create output. Retrieve it with:
   ```bash
   asg apps view --name "<name>" --format json   # read clientId from the JSON
   ```
   For `oidc` (confidential) apps the client secret is needed too — have the user read it from the Console (`asg apps settings`); don't round-trip secrets through chat.
4. **Wire the SDK** — read the file for the user's framework in `references/sdk-integration/` (e.g. `react.md`; use `README.md` to pick if unsure). Each is self-contained — integrate from it without a doc crawl; docs are a fallback. Install the framework's SDK and add the provider + login/logout using `clientId` and `baseUrl` (`https://api.asgardeo.io/t/<org-name>`, where the org is the one `asg status` shows).
5. **(Optional) Configure how users sign in** — basic OIDC gives username/password. If the user wants social login (Google/GitHub/…), enterprise/federated login, MFA (TOTP, email/SMS OTP, passkey), or passwordless, that's the app's *login flow*. Read `references/authentication-methods.md`: connections (social/enterprise) are created in the Console, but the per-app flow is editable with `asg apps update --file` (export → edit the authentication sequence → re-import), and built-in factors like TOTP can be added without a connection. Be clear about which parts are CLI vs Console.
6. **Make sure there's someone to log in as** — before sending them off to test, ask whether they already have a user they can sign in with. If not (common in a fresh org), offer to create a test user now so the test actually works:
   ```bash
   asg users create --help        # confirm flags, then create
   ```
   (This is Track C work, surfaced here because testing login depends on it.)
7. **Verify** — have the user run the app and confirm the login redirect with that user. If it fails, a redirect-URI mismatch is the first thing to check (see Track D).
8. **Offer what's next** — e.g. *"Login works. Want to gate parts of the app by role (admins vs regular users)?"* → Track B. Don't stop at a bare success.

---

## Track B — Authorize an app (RBAC)

WSO2 authorization is **role-based access control over API scopes**, in one ordered pipeline (per the official guide). Scopes are what the app/API checks; roles are how you grant them. Run the steps in order — each depends on the previous:

1. **Register the API resource + scopes:**
   ```bash
   asg apis create --name "<API>" --identifier "<urn-or-url>" --require-auth \
     --scopes '[{"name":"read:orders","description":"Read orders","displayName":"Read Orders"}]' -y
   ```
   Gating your app's *own* features (not a separate backend)? Model those features as scopes on an API resource representing the app — RBAC checks scopes either way.
2. **Authorize the app for that API + scopes** — no dedicated `asg apps` subcommand yet, but *not* Console-only: `asg api --method POST --path "/api/server/v1/applications/<appId>/authorized-apis"` with `{"id":"<apiId>","policyIdentifier":"RBAC","scopes":[...]}`. Console is the fallback (`asg apps settings` → API Authorization, policy = RBAC).
3. **Set the role audience** — **Application** (one app) or **Organization** (org-wide). Switching an app to Organization audience permanently deletes its application roles — warn the user.
4. **Create roles from the authorized scopes and assign:**
   ```bash
   asg roles create --name <Role> --audience-type Application --audience-id <appId> -p <scope> -N -y
   asg roles users add --id <roleId> --user-id <userId>
   asg roles groups add --id <roleId> --group-id <groupId>
   ```
   A role's permissions (`-p`) are the API scope names from step 1, so steps 1–2 come first. Use `asg apps view` for the app ID. **Role management needs `internal_org_role_mgt_*` scopes the default session may lack** — if these 403 (often as an HTML permission page), it's a scope gap; verify granted scopes or fall back to the Console.
5. **Enforce in the app** — request the scopes at login; per request, validate the access token (check `azp`/`client_id`, not just `aud`) and check its `scope` claim. Optionally return the `roles` claim and branch on role names instead — but roles arrive via `/oauth2/userinfo` (not the access token) and can be a comma-string; see "Reading roles & claims" in the framework file under `references/sdk-integration/`.

Read `references/authorize-app.md` for full commands, JSON shapes, and the Console-only details.

> Where a step says "Console", say so plainly — don't pretend the CLI did it. A user must re-login to pick up a newly assigned role/scope.

**Close with what's next** — authorization is only proven by trying it. Offer to verify: a user *with* the role/scope can do the gated thing, a user *without* it can't. If they need a second test user (or a user without the role), offer to create one (Track C).

---

## Track C — Manage resources

Everything that's a direct CLI operation: users, groups, roles, IdPs, API resources, scopes, branding, organizations, agents.

1. **Route the intent** — `references/cli-overview.md` maps intent → resource + action.
2. **Confirm exact usage** — `asg <resource> <action> --help`. Use `--format json --no-interactive` when you need to parse output or run unattended. Note the caveat in cli-overview: some `create` commands don't return the new ID — fetch it with `view`/`list`.
3. **Run and report** — ✓/✗ plus the meaningful result (e.g. the created ID).
4. **Confirm before destructive actions** — `delete` and bulk updates are hard to reverse. State exactly what will be removed and get explicit confirmation. Never delete something the user didn't ask you to.

---

## Track D — Troubleshoot

Quick triage, then `references/troubleshooting.md` for the full tree:

- **403 with an HTML body** → an edge/WAF block, not your permissions. Contact Asgardeo support.
- **Clean JSON 403 "operation is not permitted"** → a missing scope/permission on the logged-in account or linked app. Re-login will *not* fix it (it's not session-level) — the account/app needs the right management scope. See `references/auth.md` (management-scope prerequisite) and `references/troubleshooting.md` (how to inspect the granted scopes in the CLI config).
- **Login won't complete** → wrong org name, or a redirect/callback mismatch.

---

## Quick reference

- **Command pattern:** `asg <resource> <action> [flags]`
- **Useful globals:** `--format json|yaml`, `-N/--no-interactive`, `--no-color`, `-v/--verbose`
- **Base URL:** `https://api.asgardeo.io/t/<org-name>` — org is what `asg status` shows
- **New IDs:** `create` may not echo the ID — fetch with `view`/`list`
- **Interactive dashboard:** `asg tui` (point the user to it; don't launch it yourself)
- **Self-hosted Identity Server:** login with `--server identity-server --identity-server-url <url>`
