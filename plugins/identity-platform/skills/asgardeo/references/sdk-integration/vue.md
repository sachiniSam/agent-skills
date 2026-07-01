# Vue — `@asgardeo/vue`

App type `spa` (public client, no secret). Needs `clientId` and `baseUrl` — see the README.

```bash
npm install @asgardeo/vue
```

Register the plugin in `main.js`:

```javascript
import { AsgardeoPlugin } from '@asgardeo/vue';
createApp(App).use(AsgardeoPlugin).mount('#app');
```

Wrap the app in `App.vue` (kebab-case props) and use the components — same model as React:

```vue
<AsgardeoProvider client-id="<client-id>" base-url="https://api.asgardeo.io/t/<org-name>">
  <SignedOut><SignInButton /></SignedOut>
  <SignedIn><UserDropdown /><SignOutButton /></SignedIn>
</AsgardeoProvider>
```

Available components include `SignedIn`, `SignedOut`, `SignInButton`, `SignOutButton`, `UserDropdown`,
`UserProfile`.

## Reading roles & claims

Read the signed-in user via the SDK's user composable/object and branch on `user.roles`. The `roles` claim
is empty unless the app is configured to return it (Console step — see `authorize-app.md`), and a user must
re-login to pick up newly assigned roles. UI gating in a SPA is cosmetic — enforce real authorization on
the API (token scopes).

## Fallback

If an import doesn't resolve or the version differs, fetch
`https://wso2.com/identity-platform/docs/quick-starts/vue/`.
