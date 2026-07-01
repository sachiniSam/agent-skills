# Authorizing an app — RBAC over API scopes

WSO2 Identity Platform authorization is **role-based access control (RBAC) built on API scopes**.
Scopes are the permissions the app/API actually checks; roles are how you grant those scopes to
users. The official flow (https://wso2.com/identity-platform/docs/guides/authorization/) is one
ordered pipeline — follow it in order, because each step depends on the previous:

1. Register the API resource and its scopes.
2. Authorize the app for that API + scopes (RBAC policy).
3. Set the role audience for the app.
4. Create roles from the authorized scopes and assign users/groups.
5. Enforce in the app — validate the token and check its scopes.

You'll need the application's ID — get it from `asg apps view --name "<name>" --format json`
(or `asg apps list`). Confirm exact flags with `asg <cmd> --help`; the shapes below are starting
points. Where a step is Console-only, it's flagged — say so plainly, don't imply the CLI did it.

---

## 1. Register the API resource and its scopes

```bash
asg apis create \
  --name "Orders API" \
  --identifier "https://api.example.com/orders" \
  --require-auth \
  --scopes '[{"name":"read:orders","description":"Read orders","displayName":"Read Orders"},
             {"name":"write:orders","description":"Create/modify orders","displayName":"Write Orders"}]' \
  -y
```

- `--identifier` is the API's audience (`aud`) value (a URN or URL); it's what tokens are issued for.
- Each scope `name` is a **permission**; it must match the scope string the app requests at login.
- `--require-auth` turns on authorization (omit only for a truly public API).
- `--scopes` takes a JSON array, or `@scopes.json` to load from a file (cleaner for long lists).
- **Gating your app's own features (not a separate backend)?** Still model those features as scopes on
  an API resource that represents the app — RBAC checks scopes either way.

Add scopes to an existing API later:

```bash
asg apis scopes add -i <apiId> --scopes '[{"name":"delete:orders","description":"Delete orders","displayName":"Delete Orders"}]'
asg apis scopes list -i <apiId>
```

---

## 2. Authorize the app for the API + scopes

Grant a *specific app* access to the API resource, select which scopes it may request, and set the
authorization policy. There's no dedicated `asg apps` subcommand for this yet, but it's **not**
Console-only — do it with a raw management-API call via `asg api` (the CLI's authenticated escape hatch):

```bash
asg api --method POST \
  --path "/api/server/v1/applications/<appId>/authorized-apis" \
  --body '{"id":"<apiId>","policyIdentifier":"RBAC","scopes":["read:orders","write:orders"]}'
```

- `policyIdentifier` is `RBAC` (the default for protected business APIs and management/org APIs) or
  `NO POLICY` for an API that needs no role check.
- Confirm exact `asg api` flags with `asg api --help`; these management endpoints can change, so if the
  call fails, check the API reference (`https://wso2.com/identity-platform/docs/apis/`) for the current shape.

**Console fallback:** `asg apps settings --name <app>` → **API Authorization → Authorize an API Resource**
→ pick the **API Resource**, the **Authorized Scopes**, and **Authorization Policy = RBAC**.

---

## 3. Set the role audience

Roles have an **audience** that decides what they can gate:

- **Application** — the role belongs to one app and controls access to APIs **authorized for that app**.
  Create with `--audience-type Application --audience-id <appId>`.
- **Organization** — org-wide; controls access to org-level APIs. Create with `--audience-type Organization`
  (no `--audience-id`).

The app's role-audience setting is configured on the app (Console). **Warn the user:** switching an app
from Application to Organization audience **permanently deletes its application roles**.

---

## 4. Create roles from the authorized scopes and assign them

A role's permissions are chosen from the scopes of the APIs authorized to the app — so steps 1–2 must be
done first.

> **Heads-up:** role management needs its own scopes (`internal_org_role_mgt_create`, `..._view`, etc.)
> that a default CLI session often *doesn't* carry, even when `apps`/`apis`/`users` commands work. If
> `asg roles create`/`filter` 403s (frequently as a WSO2-branded HTML permission page, not JSON), it's a
> scope gap — verify the granted scopes (the `scope:` line in the CLI config, see `troubleshooting.md`),
> have an admin grant the role-mgmt scope and re-login, or do this step in the Console as a fallback.

```bash
asg roles create \
  --name "Orders Admin" \
  --audience-type Application \
  --audience-id <appId> \
  -p read:orders -p write:orders \
  -y
```

- `-p` / `--permission-name` is repeatable; the permission names **are** the API scope names from step 1.
- Drop `--audience-id` and use `--audience-type Organization` for an org-wide role.
- Get the new role's ID with `asg roles filter --query "displayName eq Orders Admin" --format json` if
  `create` doesn't echo it.

Assign to users:

```bash
asg roles users add --id <roleId> --user-id <userId>          # repeat -u for several
asg roles users add --name "Orders Admin" --users @users.json  # bulk from a file
```

Assign to groups (so membership drives the role):

```bash
asg roles groups add --id <roleId> --group-id <groupId>
```

Check assignments with `asg roles users list --id <roleId>` / `asg roles groups list --id <roleId>`.

---

## 5. Enforce in the app

The app requests the scopes at login (e.g. `scope: ['openid','profile','read:orders']` in the SDK config).
On success, the scopes the user's roles permit ride in the access token's `scope` claim. Your app or
backend then, per request:

1. extracts the access token,
2. validates it — JWT signature + claims, or introspection for opaque tokens. The access token's `aud` is
   commonly the client ID, so also check `azp`/`client_id` to defend against token substitution,
3. checks the token's `scope` against what the action requires,
4. allows or denies.

**A user must re-login after a role change** to pick up newly granted scopes — they ride in the token,
so an existing session won't reflect the change until a fresh login.

### Optional — gate on the `roles` claim instead of scopes

If you'd rather branch on role *names* than on scopes, return the `roles` attribute. Add it to the app's
requested claims — again via `asg api`, not Console-only:

```bash
asg api --method PATCH --path "/api/server/v1/applications/<appId>" \
  --body '{"claimConfiguration":{"requestedClaims":[{"claim":{"uri":"http://wso2.org/claims/roles"},"mandatory":false}]}}'
```

(Console fallback: `asg apps settings` → **User Attributes** → enable **Roles**.) Then read it in the SDK —
see "Reading roles & claims" in the user's framework file under `sdk-integration/`. Two gotchas that bite
backend RBAC:

- **Roles usually arrive via the `/oauth2/userinfo` endpoint, not in the access token** — a backend
  inspecting only the access token gets nothing. Prefer scope-based checks (above) for API authorization;
  use the roles claim mainly for app-side UI gating.
- **The `roles` value can be a comma-separated string** (`"roles":"Employee,Admin"`), not always an array —
  handle string-or-array when you parse it. Role names are what you check against, so keep them stable.

This is an app-side convenience; the authorization the doc defines is the scope check above.

---

## Quick command reference

| Goal | Command |
|------|---------|
| Register API + scopes | `asg apis create --name … --identifier … --require-auth --scopes '[…]' -y` |
| Add scope to API | `asg apis scopes add -i <apiId> --scopes '[…]'` |
| Authorize app for API + set RBAC policy (Console) | `asg apps settings --name <app>` → API Authorization |
| Create app role (perms = API scopes) | `asg roles create --name … --audience-type Application --audience-id <appId> -p <scope> -y` |
| Create org role | `asg roles create --name … --audience-type Organization -p <scope> -y` |
| Assign role → user | `asg roles users add --id <roleId> --user-id <userId>` |
| Assign role → group | `asg roles groups add --id <roleId> --group-id <groupId>` |
| List role's users/groups | `asg roles users list --id <roleId>` / `asg roles groups list --id <roleId>` |
