# SDK integration — pick your framework

Read **only** the file for the user's framework — each is self-contained (install, config, login/logout,
reading roles/claims, gotchas, and a fallback URL). Don't load the others.

| Framework | File | App type | SDK |
|-----------|------|----------|-----|
| React (SPA) | [`react.md`](./react.md) | `spa` | `@asgardeo/react` |
| Next.js (App Router) | [`nextjs.md`](./nextjs.md) | `oidc` | `@asgardeo/nextjs` |
| Vue | [`vue.md`](./vue.md) | `spa` | `@asgardeo/vue` |
| Vanilla JS / other SPA | [`javascript.md`](./javascript.md) | `spa` | `@asgardeo/auth-spa` |
| Node / Express | [`node-express.md`](./node-express.md) | `oidc` | `@asgardeo/passport-asgardeo` |
| .NET (ASP.NET Core / Blazor) | [`dotnet.md`](./dotnet.md) | `oidc` | `Microsoft.AspNetCore.Authentication.OpenIdConnect` |

Two values every file needs (from the CLI):
- **`clientId`** — `asg apps view --name "<app>" --format json` (the `create` command doesn't reliably return it).
- **`baseUrl`** — `https://api.asgardeo.io/t/<org-name>`, org as shown by `asg status`.

`oidc` (confidential) apps also need the **client secret** — the user reads it from the Console
(`asg apps settings`); don't round-trip secrets through chat. The SDK's redirect/callback URL must be a
registered redirect URI on the app (`asg apps view` to confirm) — a mismatch is the #1 cause of broken login.

## When to fetch live docs (fallback only)

Integrate from the framework file. Fetch docs only if: an import doesn't resolve, the installed SDK
version behaves differently, or the framework isn't listed above.

## Framework not listed — targeted fetch, not a crawl

**Complete guides (multi-page).** For a working integration you need three pages, not the whole guide:
the *install/configure SDK* page, *add login and logout*, and *display the logged-in user*. **Slugs differ
per framework**, so first fetch the guide's `introduction/` page (it lists the nav with exact slugs), then
pull the three you need **in parallel**. Verified examples:

| Framework | Base | Configure/install SDK | Login/logout | Display user |
|-----------|------|-----------------------|--------------|--------------|
| Angular | `…/complete-guides/angular/` | `install-asgardeo-sdk/` | `add-login-and-logout/` | `display-logged-in-user-details/` |
| Express | `…/complete-guides/expressjs/` | `install-passport-asgardeo/` | `add-login-and-logout/` | `display-logged-in-user-details/` |

(Base = `https://wso2.com/identity-platform/docs`.) `add-login-and-logout/` and `display-logged-in-user-details/`
are consistent across guides; the configure/install page is the one that varies — confirm it from the
`introduction/` nav.

**Single-page quickstarts.** One fetch: `https://wso2.com/identity-platform/docs/quick-starts/<fw>/` (e.g. Nuxt,
Android, Flutter).

If a slug 404s or the framework isn't above, browse the catalog at
`https://wso2.com/identity-platform/docs/get-started/try-samples/` for the current link — don't guess deep URLs.
