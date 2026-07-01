# Vanilla JavaScript / other SPA — `@asgardeo/auth-spa`

App type `spa` (public client, no secret). Needs `clientId` and `baseUrl` — see the README.

```bash
npm install @asgardeo/auth-spa
```

```javascript
import { AsgardeoSPAClient } from '@asgardeo/auth-spa';

const auth = AsgardeoSPAClient.getInstance();
await auth.initialize({
  signInRedirectURL: 'http://localhost:5173',
  signOutRedirectURL: 'http://localhost:5173',
  clientID: '<client-id>',
  baseUrl: 'https://api.asgardeo.io/t/<org-name>',
  scope: ['openid', 'profile'],
});

// auth.signIn() / auth.signOut() / auth.trySignInSilently()
```

`signInRedirectURL` must be a registered redirect URI on the app.

## Reading roles & claims

```javascript
const decoded = await auth.getDecodedIDToken();
if (decoded.roles?.includes('Admin')) { /* show admin UI */ }
```

The `roles` claim is empty unless the app is configured to return it (Console step — see
`authorize-app.md`), and a user must re-login to pick up newly assigned roles. UI gating in a SPA is
cosmetic — enforce real authorization on the API (token scopes).

## Fallback

If an import doesn't resolve or the version differs, fetch
`https://wso2.com/identity-platform/docs/quick-starts/javascript/`.
