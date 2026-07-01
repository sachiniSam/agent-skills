# Authenticating the `asg` CLI

The CLI must be authenticated before any management command works. Authentication is the one place a secret can appear, so the rule is simple: **the user runs `asg login` in their own terminal; the agent never handles credentials.**

## Why the user runs login

`asg login` is interactive and, in machine mode, asks for a client secret. The agent's shell cannot see what the user types into an interactive prompt, and a secret must never be pasted into chat or embedded in a command the agent runs. So the agent's job is to *tell the user what to run* and then *verify the result* with `asg status` — not to run `asg login` itself.

## Check status first

Before asking the user to log in, check whether a session already exists:

```bash
asg status
```

- If it reports an authenticated session, skip login and continue.
- If it reports no session (or errors), ask the user to log in.

## The two login modes

Tell the user to run `asg login` and pick the mode that fits:

**Login as User** (interactive, browser-based — preferred for humans)
1. Run `asg login` and select **Login as User**.
2. Enter the root organization name.
3. Press Enter to open the browser auth page (or copy the link shown), then enter the code displayed in the terminal.
4. Confirm the code, continue, and sign in with Asgardeo credentials in the browser.

**Login as Machine** (machine-to-machine — for automation / CI, or when user login is unavailable)

Requires a pre-created M2M application in Asgardeo with the right authorization scopes
([apps guide](https://wso2.com/identity-platform/docs/guides/applications/),
[API authorization](https://wso2.com/identity-platform/docs/apis/)). Then:
1. Run `asg login` and select **Login as Machine**.
2. Enter the organization name, client ID, and client secret.

Or as a single non-interactive command the **user** runs themselves (never the agent — it carries the secret):

```bash
asg login --org-name <org> --client-id <client-id> --client-secret <secret> --no-interactive
```

## After login

The agent re-verifies and continues:

```bash
asg status
```

To sign out:

```bash
asg logout
```

## Management-scope prerequisite (read this before managing roles/APIs/orgs)

Being authenticated is necessary but **not sufficient**. Each management operation requires the logged-in
account (or, for machine login, the linked app) to carry the matching management scope — the
`internal_*_mgt` scopes, e.g. `internal_role_mgt_view`, `internal_application_mgt_create`,
`internal_api_resource_mgt_update`. Without the right scope, the command fails with a clean JSON 403
("operation is not permitted"), and **re-login won't fix it** — it's an authorization gap, not a session
problem.

- For a **user login**, the signed-in user needs an admin role that grants those management permissions.
- For a **machine (m2m) login**, the linked application must be authorized for the relevant management API.

If a management command 403s, don't loop on re-login — see the 403 diagnosis and "inspect the granted
scopes" steps in `troubleshooting.md`, then have an admin grant the missing scope and log in again.

## Server target

`asg login` defaults to `--server asgardeo`. For a self-hosted WSO2 Identity Server, the user adds `--server identity-server --identity-server-url <url>` (and typically `--org-name carbon.super`). Ask which one they're targeting only if it isn't already clear.

## Credential safety checklist

- Never run `asg login` on the user's behalf.
- Never accept a client secret, password, or token in chat. If the user pastes one, do not echo it back, do not put it in any command, and do not store it.
- It is fine for the agent to run read/verify commands (`asg status`) and, after login, any management command — those read the session the CLI already stored.
