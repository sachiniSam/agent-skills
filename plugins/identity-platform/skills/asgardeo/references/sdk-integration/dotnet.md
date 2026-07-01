# .NET (ASP.NET Core / Blazor) — standard OIDC middleware

No WSO2-specific package — Asgardeo is a standard OIDC provider, so the app uses ASP.NET Core's built-in
OpenID Connect middleware. App type `oidc` (confidential — needs the client secret). Distilled from the
11-page complete guide so you don't have to crawl it.

```bash
dotnet add package Microsoft.AspNetCore.Authentication.OpenIdConnect
```

`Program.cs` — cookie + OIDC, pointed at Asgardeo's discovery endpoint:

```csharp
builder.Services.AddAuthentication(options => {
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
})
.AddCookie()
.AddOpenIdConnect(options => {
    // discovery doc for the org; note the /oauth2/token path segment
    options.MetadataAddress = "https://api.asgardeo.io/t/<org-name>/oauth2/token/.well-known/openid-configuration";
    options.ClientId     = builder.Configuration["CLIENT_ID"];
    options.ClientSecret = builder.Configuration["CLIENT_SECRET"];
    options.ResponseType = "code";
    options.Scope.Clear(); options.Scope.Add("openid"); options.Scope.Add("profile");
    options.SaveTokens   = true;            // keep tokens server-side (protected cookie)
    options.CallbackPath = "/signin-oidc";  // must be a registered redirect URI on the app
});
```

Login / logout endpoints (minimal API style):

```csharp
app.MapGet("/login",  (string? returnUrl) => TypedResults.Challenge(new() { RedirectUri = returnUrl ?? "/" }));
app.MapPost("/logout", (string? returnUrl) => TypedResults.SignOut(
    new() { RedirectUri = returnUrl ?? "/" },
    new[] { CookieAuthenticationDefaults.AuthenticationScheme, OpenIdConnectDefaults.AuthenticationScheme }));
```

Put `CLIENT_ID`/`CLIENT_SECRET` in config/user-secrets, never in source. The `CallbackPath`
(`/signin-oidc`) and the post-logout URL must be registered redirect URIs on the app (`asg apps view` to
confirm).

## Reading roles & claims

Claims come off `User.Claims` — `sub` (user id), `given_name`/`family_name`, `username`, and `roles` when
the app returns it. In Blazor, gate UI with `<AuthorizeView>`; in MVC/minimal APIs use `[Authorize(Roles =
"Admin")]` or check `User.IsInRole(...)`. The `roles` claim is empty unless the app is configured to return
it (Console step — see `authorize-app.md`), and a user must re-login to pick up newly assigned roles.

## Fallback

If something behaves differently, the complete guide is at
`https://wso2.com/identity-platform/docs/complete-guides/dotnet/` — fetch the `configure-authentication-properties/`,
`add-login-and-logout/`, and `display-logged-in-user-details/` pages only.
