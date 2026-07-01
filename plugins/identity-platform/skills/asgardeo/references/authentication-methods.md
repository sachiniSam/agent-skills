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
| Edit an app's login flow / authentication sequence | **Yes** | `asg apps update --file` (export → edit JSON → re-import) or `--edit <path>:<value>` (`-e`) |
| Add a built-in factor to a flow (password, TOTP, Email OTP, SMS OTP) | **Yes** | edit the app's authentication sequence (no connection needed for system authenticators) |
| List existing connections to reference in a flow | **Yes** | `asg idps list` / `asg idps view` to get the IdP name/ID |
| **Create** a new connection / IdP (social, enterprise, passkey provider, etc.) | **No — Console** | `asg idps` is read-only (list/view/delete). Create it in the Console, then reference it |
| Conditional/adaptive auth scripts, JIT provisioning toggles | **Mostly Console** | some live in the app config (editable via `--file`); the script editor is a Console experience |

> Be honest about the split: tell the user which parts you did with the CLI and which they need to do in
> the Console (`asg apps settings --name <app>` opens it).

## Editing an app's login flow with the CLI

Don't guess the JSON schema — **export the real config, edit it, re-import.** The authentication sequence
lives in the application object.

```bash
# 1. See the current config (find the authenticationSequence block)
asg apps view --name "<app>" --format json

# 2. Export to a file, edit the authenticationSequence (add steps/options), then confirm to apply
asg apps update --name "<app>" --file app.json
#    (the CLI exports the app to app.json, you edit it in an external editor, then confirm in the terminal)

# For a single simple field, --edit (-e) avoids the round-trip (path:value, dot-separated path):
asg apps update --name "<app>" --edit protocol.callbackUrl:http://localhost:3000/callback
```

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
