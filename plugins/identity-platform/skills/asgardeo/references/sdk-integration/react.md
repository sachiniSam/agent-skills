# React (SPA) — `@asgardeo/react`

App type `spa` (public client, no secret). Needs `clientId` and `baseUrl` — see the README.

```bash
npm install @asgardeo/react
```

Wrap the root (e.g. `main.tsx`):

```jsx
import { AsgardeoProvider } from '@asgardeo/react';

createRoot(document.getElementById('root')).render(
  <AsgardeoProvider
    clientId="<client-id>"
    baseUrl="https://api.asgardeo.io/t/<org-name>"
  >
    <App />
  </AsgardeoProvider>
);
```

Login/logout via ready-made components:

```jsx
import { SignInButton, SignOutButton, SignedIn, SignedOut, User } from '@asgardeo/react';

<SignedOut><SignInButton /></SignedOut>
<SignedIn>
  <User>{(user) => <span>Hi {user?.username}</span>}</User>
  <SignOutButton />
</SignedIn>
```

## Reading the user & roles

Prefer the `useUser()` hook over the `User` render-prop when you need the full profile — it exposes
`profile` / `flattenedProfile`, and the exact field names (username, email, roles) vary by SCIM mapping
and SDK version, so read from the flattened profile rather than assuming a fixed shape:

```jsx
import { useUser } from '@asgardeo/react';

const { profile, flattenedProfile } = useUser();
// e.g. flattenedProfile?.email, flattenedProfile?.username
```

The `roles` claim is empty unless the app is configured to return it (see `authorize-app.md` step 5), and
a user must **re-login** to pick up newly assigned roles. Roles typically arrive via userinfo and can be a
comma-separated string, not an array — normalize before checking:

```jsx
const roles = [flattenedProfile?.roles].flat().flatMap(r => String(r ?? '').split(','));
if (roles.includes('Admin')) { /* show admin UI */ }
```

A SPA has no server, so UI gating is **cosmetic** — enforce real authorization on the API the app calls
(token scopes), never in the browser alone.

## Calling your protected API

Get the access token and send it as a Bearer header on requests to your backend:

```jsx
import { useAsgardeo } from '@asgardeo/react';

const { getAccessToken } = useAsgardeo();

async function callApi() {
  const token = await getAccessToken();
  const res = await fetch('https://api.example.com/orders', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
```

Your backend then validates the token and checks its `scope` per request (see `authorize-app.md` step 5).
If a hook or field name doesn't resolve, confirm the current surface against the quickstart below —
the SDK's API shifts between versions.

## Fallback

If an import doesn't resolve or the installed version differs, fetch
`https://wso2.com/identity-platform/docs/quick-starts/react/`.
