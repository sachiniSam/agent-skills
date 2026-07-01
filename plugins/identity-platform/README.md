# identity-platform Plugin

Agent skill for the WSO2 Identity Platform (Asgardeo).

## Skills

| Skill | Triggers |
|-------|----------|
| **asgardeo** | Install and authenticate the `asg` CLI; create and manage applications, users, groups, roles, identity providers, API resources, scopes, branding, organizations, and agents; integrate the Asgardeo SDK into your app |

## Getting Started

See the [installation instructions](../../README.md#installation) in the main README to install this plugin. Once installed, just describe what you want in plain language — the skill will pick up the request. Below are some prompts to try.

### Adding authentication to an app

Go from zero to working login in your framework of choice.

```
> Add Asgardeo login to my React app.
```
```
> Integrate Asgardeo authentication into my Next.js project.
```
```
> Set up SSO for my Vue SPA using Asgardeo.
```

The skill installs the `asg` CLI, helps you log in, registers an OAuth2/OIDC application, and wires the matching Asgardeo SDK into your code.

### Managing applications

```
> Create an OIDC app in Asgardeo and give me the client ID.
```
```
> List my Asgardeo applications.
```
```
> Update the redirect URIs on my web-portal app.
```

### Managing users, groups, and roles

```
> Create a user in my Asgardeo org.
```
```
> Add the developers group to the admin role.
```
```
> Show me all roles assigned to user alice.
```

### Managing API resources and scopes

```
> Register an API resource for my payments service in Asgardeo.
```
```
> Add a read:orders scope to my orders API.
```

### Other resources

The CLI also manages identity providers, branding, organizations, and agents — just describe what you need.

```
> List the identity providers configured in my org.
```
```
> Update the branding for my Asgardeo org.
```
