# Authentication methods — configuring how users log in

"How users authenticate" = the application's **login flow** (its authentication sequence). Asgardeo
supports many methods (password, social, enterprise/federated, MFA, passwordless), and the official
guides are the source of truth: https://wso2.com/identity-platform/docs/guides/authentication/

There are two layers, and they sit on different sides of the CLI boundary:

1. **Connections / identity providers** (Google, GitHub, an enterprise OIDC/SAML IdP, etc.) — the
   reusable building blocks an org offers.
2. **The per-app login flow** — which of those (plus built-in factors like password, TOTP, Email OTP)
   the app uses, and in what sequence/conditions.

## What the CLI can and can't do

| Task | CLI? | How |
|------|------|-----|
| Edit an app's login flow / authentication sequence | **Yes** | `asg apps update --file` (interactive export → edit → re-import; with `-N` imports a prepared file) or `--edit <path>=<value>` (`-e`) |
| Add a built-in factor to a flow (password, TOTP, Email OTP, SMS OTP) | **Yes** | edit the app's authentication sequence (no connection needed for system authenticators) |
| List existing connections to reference in a flow | **Yes** | `asg idps list` / `asg idps view` to get the IdP name/ID |
| **Create** a new connection / IdP (social, enterprise, passkey provider, etc.) | **No — Console** | `asg idps` is read-only (list/view/delete). Create it in the Console, then reference it |
| Conditional/adaptive auth scripts, JIT provisioning toggles | **Mostly Console** | some live in the app config (editable via `--file`); the script editor is a Console experience |

> Be honest about the split: tell the user which parts you did with the CLI and which they need to do in
> the Console (`asg apps settings --name <app>` opens it).

## Editing an app's login flow with the CLI

Don't guess the JSON schema — **read the real sequence, edit it, patch it back.** The
agent-runnable recipe (verified end-to-end):

```bash
# 1. Read the current authenticationSequence from the app object
asg apps view --name "<app>" --format json -N > app.json     # stdout is pure JSON

# 2. Write the modified sequence to its own file, e.g. seq.json —
#    take .authenticationSequence from app.json, add/change steps/options
#    (set "type": "USER_DEFINED" when you change the flow)

# 3. Patch just that attribute back onto the app
asg apps update --name "<app>" --edit "authenticationSequence=@seq.json" -N -y

# 4. Verify
asg apps view --name "<app>" --format json -N   # check the steps took
```

Example `seq.json` adding TOTP as a second factor:

```json
{
  "type": "USER_DEFINED",
  "steps": [
    {"id": 1, "options": [{"idp": "LOCAL", "authenticator": "BasicAuthenticator"}]},
    {"id": 2, "options": [{"idp": "LOCAL", "authenticator": "totp"}]}
  ],
  "subjectStepId": 1,
  "attributeStepId": 1
}
```

Notes:
- **Use the authenticator names the app object returns**, not the ones the create API accepts —
  password is `BasicAuthenticator` in a stored sequence, though `basic` is accepted at creation
  time. Copying step 1's export is the reliable way to get them right.
- `--edit` also handles a single scalar field without a file: `--edit description="New description" -N -y`.
- **`--edit` only reaches the application object.** Protocol settings — callback URLs, grant types,
  access token type — live in a separate resource with its own command, `asg apps protocol update`
  (see `cli-overview.md`). `apps update --edit protocol.…` returns a generic 400.
- **`apps update --file` is a different beast for applications** — it round-trips the server's
  *export* format (a legacy service-provider schema where the flow lives under
  `localAndOutBoundAuthenticationConfig`), not the `apps view` JSON. Use it for whole-app
  backup/restore, not for flow editing; the `--edit … =@seq.json` patch above is the flow-editing
  path.

To add a **federated/social** step, the connection must already exist (create it in the Console), then
reference it by name/ID — get that from `asg idps list` — inside the exported sequence. To add a
**built-in MFA factor** (e.g. TOTP as a second step), add it to the sequence directly; no connection
needed.

## Method taxonomy (what the user might ask for → where it's configured)

All of these are documented under the authentication guides; navigate to the specific method's page.

- **Username & password** — the default first step; nothing to add for basic login.
- **Social login** — Google, Facebook, Apple, Microsoft, LinkedIn, GitHub. *Create the connection in the
  Console*, then add it as a step in the app's flow (CLI can edit the flow).
- **Enterprise / federated** — OIDC IdP, SAML 2.0 IdP (also eID providers, decentralized). *Connection in
  Console*, flow editable via CLI. JIT provisioning auto-creates accounts on first federated login.
- **Multi-factor (MFA)** — TOTP, Email OTP, SMS OTP, push, passkey, iProov, Duo. Built-in factors (TOTP,
  Email/SMS OTP) can be added to the flow via CLI; third-party factors need a Console connection first.
- **Passwordless** — magic link, passkey (FIDO2), Email/SMS OTP, HYPR. Passkey/HYPR connections are set
  up in the Console; the flow step is then editable.
- **Adaptive / conditional authentication** — change the flow by device/network/location/context. Authored
  with a script in the Console.
- **Identifier-first login** — prompt for the identifier before the credential; a flow option.

## Pattern to follow when a user asks for a login method

1. Identify the method and check whether it needs a **connection** (social/enterprise/third-party MFA) or
   is a **built-in factor** (password/TOTP/Email-SMS OTP).
2. If a connection is needed and doesn't exist: tell the user it's a Console step, point them to the
   method's docs page, and have them create it. Use `asg idps list` afterward to confirm it exists.
3. Edit the app's authentication sequence with `asg apps update --file` (export → edit → re-import),
   referencing the connection where needed.
4. Verify by signing in (you'll likely need a test user — see Track A) and confirm the new method appears
   and works. Re-login is needed for flow changes to take effect.
