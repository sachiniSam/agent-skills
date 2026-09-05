# SDK integration — wiring an app to Asgardeo

The Asgardeo docs' quickstarts are the source of truth for SDK syntax — it drifts between versions,
so the skill doesn't embed it. What the skill adds: the inputs, the routing, and the integration
knowledge the quickstarts don't cover.

## Inputs every integration needs (from the CLI)

- **`clientId`** — in the `asg apps create` output (`Client ID:` line, or the payload with
  `--format json`); re-fetch anytime with `asg apps view --name "<app>" --format json -N`.
- **`baseUrl`** — `https://api.asgardeo.io/t/<org-name>`, org as shown by `asg status`.
- **client secret** (`oidc` apps only) — the user reads it from the Console (`asg apps settings`);
  it never passes through chat.
- The SDK's redirect/callback URL must be a **registered redirect URI** on the app
  (`asg apps view` to confirm) — a mismatch is the #1 cause of broken login.

## Route by framework

Pages live under `https://wso2.com/identity-platform/docs/`. Fetch the row's page — **one fetch,
not a crawl**; it supplies the SDK-specific part (package, provider setup, sign-in/out, user object).

| Framework | App type | SDK | Fetch |
|-----------|----------|-----|-------|
| React (SPA) | `spa` | `@asgardeo/react` | `quick-starts/react/` |
| Next.js | `oidc` | `@asgardeo/nextjs` | `quick-starts/nextjs/` |
| Vue | `spa` | `@asgardeo/vue` | `quick-starts/vue/` |
| Angular | `spa` | | `quick-starts/angular/` |
| Nuxt | `spa` | | `quick-starts/nuxt/` |
| Vanilla JS / other SPA | `spa` | `@asgardeo/auth-spa` | `quick-starts/javascript/` |
| Spring Boot | `oidc` | | `quick-starts/springboot/` |
| Node / Express | `oidc` | `@asgardeo/passport-asgardeo` | `complete-guides/expressjs/introduction/` (then the pages its nav lists) |
| .NET (ASP.NET Core / Blazor) | `oidc` | standard OIDC middleware | `complete-guides/dotnet/introduction/` (then the pages its nav lists) |
| Android / Flutter | `mobile` | | `tutorials/auth-users-into-android-apps/` / `…-flutter-apps/` |

Then:

1. Register the app with the row's type (`asg apps create --name "<name>" --type <type>
   --redirect-uri <url> -N -y`) and capture the identifiers from the output. Agree the name with the
   user before creating — it is theirs, not a placeholder.
2. Fetch the row's page and wire its snippet into the **user's existing project** with the inputs
   above — skip the quickstart's scaffold-a-new-app steps.
3. Verify login with a test user (Track A flow).

**Framework not listed:** browse `get-started/try-samples/` for the current link — don't guess
deep URLs.

## Calling a protected API

Two things the quickstarts don't cover:

**Request the API's scopes at login.** The provider config takes a `scopes` option — list the API's
scopes alongside `openid` and `profile` (e.g. `read:orders`). Without them the token carries no
scopes and every backend check fails. It's defined in `@asgardeo/javascript`, so the React, Vue and
JS SDKs all accept it.

**Get the access token.** In `@asgardeo/react`, `useAsgardeo()` returns `getAccessToken()`; the Vue
and JS SDKs expose the equivalent on their composable/client. Send it as
`Authorization: Bearer <token>`.

Non-JS stacks (Spring Boot, .NET): both live in the OIDC library's own configuration — a scope list
at client setup, and the token from the request's security context.

If a name doesn't resolve, the installed SDK version differs from the docs — check the package's
type definitions under `node_modules/@asgardeo/<pkg>/dist` (they match what's installed), or
re-fetch the quickstart.

Sending the token is half the job; the API must verify it and check the scope per request —
`authorize-app.md` step 6.

## Reading the user and their roles

- **The `roles` claim is empty unless the app requests it**
  (`asg apps claims --id <appId> --add "http://wso2.org/claims/roles" -N -y`), and a user picks up
  newly assigned roles only at their **next login**.
- **Roles usually arrive via `/oauth2/userinfo`, not inside the access token** — a backend
  inspecting only the token sees nothing. Use scopes for API authorization, roles for UI.
- **The value can be a comma-separated string** (`"Employee,Admin"`), not always an array:
  ```js
  const roles = [profile?.roles].flat().flatMap(r => String(r ?? '').split(','));
  ```
- **Profile field names vary** by SCIM mapping and SDK version — read from the SDK's
  flattened/normalized profile object instead of assuming fixed names.
- **Gating UI in a SPA is cosmetic.** A browser app enforces nothing; the security boundary is the
  API checking the token's `scope`. Hide buttons with role checks, never rely on them.

## When login fails after wiring

- **Redirect-URI mismatch** — the #1 cause. The SDK's redirect must exactly match a URI registered
  on the app. Redirect URIs are a protocol setting, so check and fix them with:
  ```bash
  asg apps protocol view --id <appId> --format json -N        # see callbackURLs
  asg apps protocol update --id <appId> --edit 'callbackURLs=["http://localhost:3000"]' -N -y
  ```
- **Roles claim empty** — see above: claim not requested, or no re-login since assignment.
- **Scopes missing from the access token** — the app isn't authorized for the API/scopes (check
  `asg apps apis list --id <appId>`; grant with `asg apps apis add`), or the SDK config
  didn't request them at login.
- **The access token won't decode** — it's opaque, which is Asgardeo's default. Any code that
  splits it on `.` and base64-decodes the payload silently yields nothing, so scope-based UI gating
  fails closed. Switch the app to JWT:
  `asg apps protocol update --id <appId> --edit "accessToken.type=JWT" -N -y`.
