# Troubleshooting Asgardeo / `asg` CLI

Diagnose the cause before changing anything — most wasted effort here comes from "fixing" the wrong
layer (e.g. re-logging in to cure a permission gap that login can't touch).

## 403 — diagnose by the response body

Read the actual body content before changing anything — **not just whether it's HTML or JSON.** A 403
with an HTML body is *not* automatically an edge block; a WSO2-branded permission page is a scope gap you
can fix yourself.

| Response body | Cause | What fixes it |
|---|---|---|
| **Generic/Cloudflare-style HTML** (no WSO2 branding) | Edge/WAF block — never reached the identity layer | Not login, not scopes. Contact Asgardeo support with the endpoint + request details. |
| **WSO2-branded HTML** — a styled "You do not have permission" page | Same as the JSON case: the account (or linked M2M app) lacks the management scope | Grant the missing `internal_*_mgt` scope, then re-login (see below). |
| **JSON**, e.g. `"operation is not permitted"` | The account (or linked M2M app) lacks the management scope for that operation | An admin grants the needed role/permission — or authorizes the M2M app for the management API — **then re-login**. |

So the last two rows are the same problem in two skins — role/API-management endpoints (e.g.
`/scim2/v3/Roles`) often return the **HTML** permission page rather than JSON. Confirm by re-running with
`-v` (or the same call via `asg api`); if the raw call hits the same 403, it's a scope gap, not WAF.

**The non-obvious part:** for a scope-gap 403 (JSON *or* WSO2 HTML), re-login does *not* help on its own —
it's an authorization gap, not a stale session, so a fresh token with the same grants returns the same 403.
Management ops need the matching `internal_*_mgt` scope (e.g. `internal_role_mgt_view`,
`internal_org_role_mgt_create`, `internal_application_mgt_create`); see the management-scope prerequisite in
`auth.md`.

**Check the session's actual scopes:** the CLI records them under the `scope:` key in its config file
(macOS `~/Library/Application Support/asgardeo-cli/asgardeo-cli.yaml`; Linux typically
`~/.config/asgardeo-cli/asgardeo-cli.yaml`). The file also holds the client secret, so **have the user open
it themselves** — don't read or print it. Ask whether the scope the failing op needs is in that list; if
it's missing, that confirms the JSON-403 diagnosis.

## Login won't complete

- **Wrong organization name** — the org entered at `asg login` must be the root org name, not a display
  label. Confirm with the user.
- **User vs Machine mode mismatch** — if they meant to use an app's credentials, they must pick
  "Login as Machine"; "Login as User" expects a human browser flow.
- **Browser/device step skipped** — in user mode they must open the page and enter the code shown in the
  terminal. Re-run `asg login` and walk through it.
- After any login, confirm with `asg status` before retrying the failed command.

## App login (SDK) fails after wiring

- **Redirect-URI mismatch** — the #1 cause. The SDK's sign-in redirect must exactly match a redirect URI
  registered on the app (`asg apps view`). Update with `asg apps update` or in the Console.
- **Roles claim empty** — the app isn't requesting the `roles` attribute (set it via `asg api` or the
  Console, see `authorize-app.md` step 5), or the user logged in before the role was assigned (re-login
  needed). Note roles usually surface via `/oauth2/userinfo`, not the access token.
- **Scopes missing from the access token** — the app isn't authorized for the API resource/scopes (set it
  via `asg api` or the Console, see `authorize-app.md` step 2), or the SDK config didn't request them.

## CLI command "succeeded" but you can't find the new ID

Several `create` commands don't return the created resource's ID. This isn't an error — fetch it
explicitly with the matching `view`/`list`/`filter` (see the caveat in `cli-overview.md`).

## Still stuck? Go to the official docs (only when this skill doesn't cover it)

If the problem isn't explained above and `asg <cmd> --help` doesn't clear it up, check the official docs —
they're the source of truth (the product rebranded Asgardeo → WSO2 Identity Platform). Don't reach here by
default; use it when you're genuinely blocked.

- Docs home: `https://wso2.com/identity-platform/docs/`
- Guides (applications, authentication, authorization, users, orgs): `https://wso2.com/identity-platform/docs/guides/`
- Management APIs (for what the CLI wraps / required scopes): `https://wso2.com/identity-platform/docs/apis/`
- SDKs & quickstarts (app-side integration): `https://wso2.com/identity-platform/docs/get-started/`

Fetch the specific page you need, not the whole tree.
