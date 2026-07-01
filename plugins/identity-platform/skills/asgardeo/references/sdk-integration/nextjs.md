# Next.js (App Router) — `@asgardeo/nextjs`

App type `oidc` (confidential — needs the client secret). Needs `clientId` and `baseUrl` — see the README.

```bash
npm install @asgardeo/nextjs
```

`.env.local`:

```
NEXT_PUBLIC_ASGARDEO_BASE_URL="https://api.asgardeo.io/t/<org-name>"
NEXT_PUBLIC_ASGARDEO_CLIENT_ID="<client-id>"
ASGARDEO_CLIENT_SECRET="<client-secret>"
```

Wrap `app/layout.tsx`:

```tsx
import { AsgardeoProvider } from '@asgardeo/nextjs/server';

export default function RootLayout({ children }) {
  return (
    <html lang="en"><body><AsgardeoProvider>{children}</AsgardeoProvider></body></html>
  );
}
```

Use `SignInButton` / `SignOutButton` / `SignedIn` / `SignedOut`, and add a `middleware.ts` at the project
root using `asgardeoMiddleware()` for auth routing (fetch the live guide for the exact middleware shape if
needed).

## App Router gotchas (these will bite — pre-empt them)

- **Render-prop / interactive components need `'use client'`.** A function child (e.g.
  `<User>{(user) => …}</User>`) can't live in a Server Component — it throws "Functions cannot be passed
  directly to Client Components". Put such components in a file starting with `'use client'` and import it
  into your server page/layout.
- **Duplicate React types.** `@asgardeo/nextjs` bundles its own `@types/react`, which can collide and cause
  "X cannot be used as a JSX component" errors. Dedupe with `package.json` overrides, then reinstall:
  ```json
  "overrides": { "@types/react": "$@types/react", "@types/react-dom": "$@types/react-dom" }
  ```
  (Pin to the app's installed versions instead of `$…` on npm older than 8.3.)

## Reading roles & claims

Decode the session / ID token **on the server** and read `roles` (and `groups`) there to gate routes,
server actions, or route handlers — don't trust client-only checks for anything security-sensitive. The
claim is empty unless the app returns it (Console step — see `authorize-app.md`), and role changes need a
re-login. API scopes ride in the **access token's** `scope` claim, not the ID token.

## Fallback

If an import doesn't resolve or the version differs, fetch
`https://wso2.com/identity-platform/docs/quick-starts/nextjs/`.
