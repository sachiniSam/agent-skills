# Authenticating the `asg` CLI

One rule governs everything here: **the user logs in; the agent verifies.** The agent never runs
`asg login` and never handles a credential — no secrets in chat, in commands, or in files.

## 1. Check for a session

```bash
asg status
```

Authenticated → done, skip the rest. No session (or an error) → step 2.

## 2. The user logs in

Ask the user to run, in their own terminal:

```bash
asg login
```

and choose **Login as User**. What they'll see: the CLI asks for their **root organization name**,
then opens the browser at the sign-in page with the device code pre-filled; they sign in with their
Asgardeo credentials and the terminal completes on its own. (If no browser can open — SSH, headless —
the CLI prints the URL and code to use from any device, and keeps waiting.)

**If login stops with "CLI access is turned off for this organization"**, nothing about the command
is wrong: CLI access is on by default only for organizations created after CLI support shipped, and
an older one has to turn it on once in the Asgardeo Console, on the CLI tab. The CLI detects this
before opening a browser and prints the steps. The user enables it and re-runs `asg login` —
don't re-run it for them, and don't try another org name or server URL, which will not help.

Two special cases:

- **Self-hosted WSO2 Identity Server:** add `--server identity-server --identity-server-url <url>`
  (org is typically `carbon.super`).
- **CI / no human available:** machine login with a pre-created M2M app authorized for the needed
  management APIs — run by the user or CI, never the agent, because the secret rides in the command
  line:
  ```bash
  asg login --org-name <org> --client-id <id> --client-secret <secret> --no-interactive
  ```

## 3. Verify and continue

```bash
asg status
```

Confirm it shows the expected organization, then proceed. Don't continue past a failed check.

## Sessions renew themselves

Access tokens expire hourly, but the CLI refreshes them silently — a session stays usable across a
long task with no re-login. Two consequences:

- A **"session has expired" error** means the silent refresh itself failed (refresh token expired or
  revoked): ask the user to run `asg login` again.
- A **403 is never a session problem** — it's a missing permission on the signed-in user's role, and
  re-login won't change it. See "When a command fails" in `cli-overview.md` instead of looping on login.

## Signing out

```bash
asg logout
```

Clears the stored tokens (including the refresh token).
