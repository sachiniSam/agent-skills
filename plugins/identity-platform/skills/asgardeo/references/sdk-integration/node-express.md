# Node / Express — `@asgardeo/passport-asgardeo`

App type `oidc` (confidential — needs the client secret). A Passport.js strategy. Needs `clientId`,
`baseUrl`, and the client secret — see the README.

```bash
npm install passport express-session dotenv @asgardeo/passport-asgardeo
```

Configure the strategy:

```javascript
const passport = require('passport');
const AsgardeoStrategy = require('@asgardeo/passport-asgardeo');
const BASE_URL = 'https://api.asgardeo.io/t/<org-name>';

passport.use(new AsgardeoStrategy({
  issuer: BASE_URL + '/oauth2/token',
  authorizationURL: BASE_URL + '/oauth2/authorize',
  tokenURL: BASE_URL + '/oauth2/token',
  userInfoURL: BASE_URL + '/oauth2/userinfo',
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: '/oauth2/redirect',
  scope: ['profile'],
}, (issuer, uiProfile, idProfile, context, idToken, accessToken, refreshToken, params, verified) =>
  verified(null, { uiProfile })));
```

Routes: `passport.authenticate('asgardeo')` for `/login`; the same on `/oauth2/redirect` for the callback;
`req.logout()` + a redirect to `BASE_URL + '/oidc/logout'` for sign-out. Add `express-session` +
`passport.authenticate('session')`. Put `CLIENT_ID`/`CLIENT_SECRET` in `.env`, never inline. The
`callbackURL` must be a registered redirect URI on the app.

## Reading roles & claims

Read `roles` from the verified profile / decoded ID token on the server and gate routes/handlers there.
The claim is empty unless the app is configured to return it (Console step — see `authorize-app.md`), and
a user must re-login to pick up newly assigned roles. For API access, check the **access token's** `scope`
claim per request.

## Fallback

If an import doesn't resolve or the version differs, fetch
`https://wso2.com/identity-platform/docs/quick-starts/nodejs/` (or the multi-page Express guide at
`https://wso2.com/identity-platform/docs/complete-guides/expressjs/` — fetch the config + login/logout pages only).
