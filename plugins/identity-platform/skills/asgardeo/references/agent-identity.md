# Agent identity — authenticating AI agents

An **agent** in Asgardeo is an identity for an AI agent — an assistant, a copilot, an autonomous
worker. It gets its own ID and secret, its own roles, and its own access tokens, so every action it
takes is attributable to it and its permissions can be changed without touching anyone else's.

## Start here: how does the agent act?

Before creating anything, settle **whose authority the agent's token carries**. There are two
scenarios, and the choice changes what you wire up:

| | The agent acts… | Use when | Token says |
|---|---|---|---|
| **1** | **on its own** | the agent does its own work with its own permissions — monitoring, enrichment, a task nobody delegated | `sub` = the agent, `aut` = `AGENT` |
| **2** | **on behalf of a user** | the agent does something *for a specific person* — reads their data, acts in their name | `sub` = the user, `act.sub` = the agent |

**Look at the code before asking.** If the API the agent will call already reads an `act` claim,
an `actor`, or `requested_actor` — search the backend for those — someone designed it for
delegation. Say so, and lead with scenario 2:

> Your API already reads the `act` claim, so it was built for an agent acting on a user's
> behalf. I'll set that up unless you want the agent to act on its own.

Otherwise put it to the user in their terms. Everything that needs their say-so goes in this **one
message** — the scenario, the agent's name, and the role's name and scopes (you know the scopes
from reading the API) — and then **stop**:

> Two ways your agent can work, and it depends on whose data it touches:
>
> 1. **On its own** — the agent has its own permissions, like a team member with its own account.
> 2. **On behalf of a user** — it borrows a specific person's permissions, with their consent.
>
> Which fits what you're building?
>
> I'd register it as **orders-assistant**, with a role **Orders Assistant Access** granting
> `read:orders` and `write:orders` — the two scopes the API checks. Different names, or fewer scopes?

Then end the turn. Nothing gets created, and no other step runs, until the user has answered.
"I'll use X unless you say otherwise" followed by the next command is not a confirmation; it is
a decision made for them. One stop is enough; don't come back with a second question for the role.

If they're unsure, the deciding question is: **should this agent be able to touch any user's data, or
only the data of the person who asked it to act?** The first is 1, the second is 2.

Most assistant-style agents are 2 — "show me *my* orders", "cancel *my* booking". Reach for 1 when
the agent's work isn't tied to a particular person. An agent that wants standing access to a user's
data with no approval at any point has no flow — say so; the choice is 1 with its own permissions or
2 with the user's consent.

**Once they've answered, lay out the plan — then start.** Same as the login and authorization
tracks: a few lines on what gets created and what they end up with, so nothing in the run is a
surprise. Fill it from their answers:

> Here's the plan:
> - Create the agent **orders-assistant** with its own sign-in app (redirect `http://localhost:3001/callback`); credentials go into `assistant/.env`, which is gitignored.
> - Authorize that app for the **Orders API** and create the role **Orders Assistant Access** with `read:orders`, `write:orders`; assign the agent to it.
> - Wire `@asgardeo/javascript` into `assistant/index.js` so it sends the agent's token.
> - Then you run the assistant once and we check the API's activity log shows the agent.
>
> Starting.

**Steps 1–3 are the same either way.** After that, follow the matching section.

---

## Step 1 — Agree the agent's name

The name appears in the Console and in audit trails for as long as the agent exists, so it should say
what the agent does. Propose one from the project, ask in the same message as the scenario question
above, and **wait for the answer before running anything**:

> I'll register it as **orders-assistant** — different name?

A proposal the user hasn't replied to is not agreed. Never invent one silently, and never use a
placeholder like `test-agent`. If they are building several agents, give each its own identity
rather than sharing one — separate identities is the point.

## Step 2 — Create the agent, with its application

Two different things are involved here, and both get called "the app" — keep them apart:

- **The application the agent signs in *through*.** An OAuth client registration in Asgardeo: it
  has the `client_id`, the grant types, the redirect URI. The agent supplies the identity (its ID and
  secret); this app supplies the client. Tokens are issued *to* it (`aud` = its `client_id`). This is
  what step 2 is about.
- **The API or MCP server the agent *calls*.** The resource that validates the token. It is
  registered as an API resource with scopes, never as an OAuth application. That is step 3.

Creating an agent on its own gives you only the identity, not the client. Asgardeo creates the
client with the agent when "Allow users to log in to this agent" is on, and that is the normal
practice: one agent, one client, same ID. **Do it this way by default, without asking** — the
question "which application should the agent sign in through" means nothing to most users, and a
separate client is the right answer for a standalone agent anyway.

The one situation to handle differently: the agent's code lives inside a service that already has an
Asgardeo application — for example an assistant that is a route in a backend registered in Track A.
Then say so in a line and offer the choice, defaulting to a separate client:

> Your backend already has an Asgardeo app. I'll give the assistant its own client anyway — keeps
> its tokens distinct — unless you'd rather it sign in through the existing one.

If they choose the existing one, use *An application already exists* below.

### Create the agent with its own application (default)

`--allow-user-login` asks Asgardeo to create an application alongside the agent. It shares the
agent's ID, has API-based authentication on, and the CLI shapes it as a public client with PKCE,
the authorization-code grant, the redirect URI you give, and JWT access tokens. `--env-file` makes
the CLI write the credentials straight into the agent's env file, so the secret is never shown.
Together that is everything the flows below need — but prepare the file first:

1. **Pick the env file the agent's code reads** (`.env` next to it) and confirm git ignores it:
   `git check-ignore -q <path>/.env || echo "NOT ignored"`. If it isn't ignored — including
   when it is already tracked, which `.gitignore` alone does not undo — fix that first. Never use
   `.env.example`; that file is meant to be committed.
2. **Write the file with what you already know.** The CLI fills in the rest:
   ```
   ASGARDEO_BASE_URL=https://api.asgardeo.io/t/<org>
   REDIRECT_URI=http://localhost:3001/callback
   ```
3. **Create the agent, pointing the CLI at that file:**
   ```bash
   asg agents create --name "orders-assistant" --description "Answers customer questions about orders" \
     --allow-user-login --redirect-uri "http://localhost:3001/callback" \
     --env-file assistant/.env -N -y
   ```

- **`--redirect-uri`** is where a user's browser returns after signing in (section 2). It is
  required either way — the agent's own login checks it too. `http://localhost:3001/callback` is
  the usual dev value; confirm it with the user as you would for an app.
- **`--env-file`** writes `AGENT_ID`, `AGENT_SECRET` and `CLIENT_ID` into the file: existing lines
  for those keys are replaced, every other line is kept, and a new file is created private. The
  secret goes Asgardeo → CLI → disk and appears nowhere else.
- For an agent that asks users for approval out of band rather than through a browser, add
  `--agent-type background` (see *Using CIBA* below).

The output confirms what happened without repeating the values:

```
Agent secret written to assistant/.env (not shown). Keep that file out of version control.
Application (same ID as the agent) client ID: <client-id>
SUCCESS: Agent created successfully
ID: <agent-id>
```

`--format json` also returns `applicationId` and `clientId`. Read the file back only to confirm
the keys are present (`grep -c '^AGENT_SECRET=' assistant/.env`), never to print it.

**The secret can never be read again** after this. If it is lost, regenerate it in the Console
(the agent → **Credentials** → **Regenerate**) and update every place the old one was used. If the
user wants it in a secret manager rather than a file, `-c` puts it on *their* clipboard instead;
never read the clipboard yourself (`pbpaste`, `xclip`, …) — there is no way to check what is in it.

### An application already exists

Only when the user chose to reuse one. Create a plain agent (same env-file handling as above), and
make sure the application allows sign-in over the API — the agent flows need it, and it is off by
default on ordinary apps:

```bash
asg agents create --name "orders-assistant" --description "…" --env-file assistant/.env -N -y
asg apps update --id <appId> --edit "advancedConfigurations.enableAPIBasedAuthentication=true" -N
asg apps protocol view --id <appId> --protocol oidc -N --format json   # clientId, grantTypes, callbackURLs, accessToken.type
```

Check the protocol output: the grants must include `authorization_code`, `callbackURLs` must
contain the agent's redirect URI, and `accessToken.type` should be `JWT` (an API cannot read scopes
out of an opaque token). Fix any of them with `asg apps protocol update --id <appId> --edit …`.
Without API-based authentication the agent's first login fails with
`ABA-60007 App native authentication is not enabled`.

## Step 3 — Give the agent its permissions

Scopes and roles work exactly as they do for users, so run the pipeline in `authorize-app.md`:
register the API resource and its scopes, authorize the agent's application for them, create a role
holding those scopes, put the agent in the role.

One thing is specific to the auto-created application: its role audience is **Application**, so
the role must be created against it — an Organization-audience role will not be picked up:

```bash
asg apps apis add --id <agentId> --api-id <apiId> --scopes read:orders,write:orders -N -y
asg roles create --name "Orders Assistant Access" --audience-type Application --audience-id <agentId> \
  -p read:orders -p write:orders -N -y
asg roles users add -i <roleId> -u <agentId> -N -y
```

The role name and scopes are the ones the user agreed to in the opening question — not a new
invention here. If the org already has a role carrying exactly those scopes on this app, say so and
reuse it rather than creating a duplicate.

(With an existing application, use its ID in place of `<agentId>` for the first two commands, and
whichever audience it is set to.) Agents are role members alongside users, which is why this is
`roles users add` with the agent's ID.

Check it landed before moving on — a missing role assignment surfaces later as a token with the scope
quietly absent, which is harder to diagnose:

```bash
asg agents view --id <agentId> -N --format json   # "roles" lists "Orders Assistant Access"
```

Give the agent only the scopes it needs. An agent acting on its own can reach anything its roles
allow, with no human in the loop to catch a mistake.

---

## The SDK, by language

The identity calls are the same whichever agent framework is in use — Vercel AI, LangChain, Google
ADK, CrewAI. What differs by framework is only how the token is handed to the tools or MCP client,
and each framework's quickstart shows that part.

| Language | Install | Client | Own token | On-behalf-of | Framework quickstarts (tool wiring) |
|---|---|---|---|---|---|
| TypeScript / Node | `npm install @asgardeo/javascript` | `new AsgardeoJavaScriptClient({ baseUrl, clientId, afterSignInUrl, scopes })` | `getAgentToken(agentConfig)` | `getOBOSignInURL(agentConfig)` → `getOBOToken(agentConfig, { code, state, session_state })` | `quick-starts/vercel-ai-ts/`, `langchain-ts/`, `google-adk-ts/` |
| Python | `pip install asgardeo asgardeo_ai` | `AgentAuthManager(AsgardeoConfig(base_url, client_id, redirect_uri), AgentConfig(agent_id, agent_secret))` | `await m.get_agent_token([scopes])` | `m.get_authorization_url_with_pkce([scopes])` → `await m.get_obo_token(code, agent_token=…, code_verifier=…)` | `quick-starts/langchain-py/`, `google-adk-py/`, `crew-ai-py/`, `vercel-ai-py/` |

Quickstart paths are under `https://wso2.com/identity-platform/docs/`. Fetch the one for the user's
framework and language when wiring the token into tools; use this file for the identity part.

The examples below are TypeScript. The Python calls map one-to-one.

---

# 1. AI agent acting on its own

The agent authenticates with its own ID and secret and receives a token that identifies it. The SDK
does the whole exchange in one call — use it rather than hand-rolling the OAuth flow.

Install with `npm install @asgardeo/javascript dotenv` and let npm pick the version: the package is
pre-1.0 (0.23.x at the time of writing), so a hand-written range like `^1.0.0` doesn't resolve.
If a method here looks off, the truth is in `node_modules/@asgardeo/javascript/dist/*.d.ts`.

```js
// auth.js — get an access token for this agent
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { AsgardeoJavaScriptClient } from '@asgardeo/javascript';

// Load assistant/.env by its own location, so this works from any working directory.
dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) });

const asgardeo = new AsgardeoJavaScriptClient({
  baseUrl: process.env.ASGARDEO_BASE_URL,        // https://api.asgardeo.io/t/<org>
  clientId: process.env.CLIENT_ID,               // the application's client_id (step 2)
  afterSignInUrl: process.env.REDIRECT_URI,      // must match the app's redirect URI
  scopes: ['openid', 'read:orders'],             // what to ask for
});

const agentConfig = {
  agentID: process.env.AGENT_ID,
  agentSecret: process.env.AGENT_SECRET,
};

export async function getAgentToken() {
  const token = await asgardeo.getAgentToken(agentConfig);
  return token.accessToken;   // also: refreshToken, expiresIn, scope
}
```

`import 'dotenv/config'` would read `.env` from the *working directory*, so it silently finds nothing
when the agent is started from the repo root — and an empty secret surfaces as
"Agent authentication failed." Loading by module path avoids that.

Then send it like any bearer token: `headers: { Authorization: \`Bearer ${await getAgentToken()}\` }` —
to an MCP client's transport, to `fetch`, to whatever the framework's tool layer takes.

Under the hood this is the app-native flow — `/oauth2/authorize` with `response_mode=direct`, the
agent's ID and secret to `/oauth2/authn` as the *Username & Password* authenticator, then the code
exchange with PKCE — which is why the application needs API-based authentication and the
authorization-code grant. Tokens last about an hour; the response includes a refresh token, so a
long-running agent should refresh rather than log in again on every call.

Verify by decoding the token. Expect:

```json
{ "sub": "<agentId>", "aut": "AGENT", "scope": "openid read:orders", "aud": "<clientId>" }
```

`aut: AGENT` is how an API can tell an agent's own token from a user's. If a scope is missing, look at
step 3 — the app's API authorization, the role's audience, the role assignment — not at the API's
validation: a scope the agent isn't entitled to is dropped silently rather than refused.

**Close by telling the user to test it** — run the assistant once against their API — the way
the login track ends with "try signing in". Don't call their API yourself.

**`Agent authentication failed.` with nothing else.** The SDK discards the reason (the flow's
`flowStatus` and its response). In practice it is nearly always the secret — mistyped, stale
clipboard, or the placeholder still in `.env`. Check the `.env` line first. To see the real
status, replay the flow by hand once: `POST /oauth2/authorize` with the app's `client_id`,
`response_type=code`, `response_mode=direct`, `redirect_uri`, `scope`, then `POST /oauth2/authn`
with the `flowId`, the `authenticatorId` from the response, and the agent ID/secret as
`username`/`password`. `FAIL_INCOMPLETE` means bad credentials; a disabled agent or a missing
authenticator says so in the body.

---

# 2. AI agent acting on behalf of a user

The agent borrows a specific person's permissions, with their consent. The token names both: `sub` is
the user, `act` is the agent.

```json
{ "sub": "<the user's ID>",
  "act": { "sub": "<agentId>" },
  "scope": "openid read:orders" }
```

An API authorizes against `sub` as it would for any user, and can log `act.sub` to record which agent
acted. A compromised agent cannot silently become the user.

The agent needs **its own token first** (section 1) — that is what proves which agent is asking. The
SDK fetches it for you inside `getOBOToken`.

**The scopes in the delegated token are the user's, not the agent's.** They come from the roles
*the user* holds on the agent's application, so the person delegating needs a role there too:
create it against the agent's app (Application audience, as in step 3) with the scopes they may
delegate, and add the user with `asg roles users add -i <roleId> -u <userId> -N -y`. An agent whose
role carries `write:orders` can still not cancel on behalf of a rep who has only `read:orders` —
which is the point.

## The user is signing in

**The user's sign-in is unchanged and happens in the browser.** The agent never sees, asks for, or
handles the user's password. It contributes two things, and the SDK adds both:

1. **`requested_actor=<agentId>`** on the authorization URL — `getOBOSignInURL(agentConfig)` builds
   a normal PKCE authorization URL with it added.
2. **`actor_token=<the agent's own token>`** at the code exchange — `getOBOToken(agentConfig, code)`
   fetches the agent token and sends it with the code.

Between the two, the agent has to catch the redirect. A tiny HTTP server on the redirect URI does it:

```js
import express from 'express';
import open from 'open';
import { AsgardeoJavaScriptClient } from '@asgardeo/javascript';

const asgardeo = new AsgardeoJavaScriptClient({ baseUrl, clientId, afterSignInUrl: 'http://localhost:3001/callback', scopes: ['openid', 'read:orders'] });
const agentConfig = { agentID: process.env.AGENT_ID, agentSecret: process.env.AGENT_SECRET };

// 1. Send the user to sign in, with requested_actor set to this agent.
await open(await asgardeo.getOBOSignInURL(agentConfig));

// 2. Catch the redirect. The path and port come from the redirect URI registered in step 2.
const authCode = await new Promise((resolve) => {
  const app = express();
  const server = app.listen(3001);
  app.get('/callback', (req, res) => {
    const { code, state, session_state } = req.query;
    res.send('<h1>Signed in — you can close this window.</h1>');
    server.close();
    resolve({ code, state, session_state });
  });
});

// 3. Exchange the code plus the agent's own token for the delegated token.
const oboToken = await asgardeo.getOBOToken(agentConfig, authCode);
// oboToken.accessToken: sub = the user, act.sub = the agent
```

In a web app that already has Asgardeo login, the same two additions go through the framework SDK:
`requested_actor` in the sign-in call's additional params, and the exchange done server-side with the
agent's token. Only use a direct username/password submission for a scripted test with a throwaway
account — never for a real user.

Watch for `invalid_grant — Actor token is not provided in the request.` at the exchange: it means
`actor_token` was omitted, and it appears *after* a successful sign-in, so it reads like the login
failed when it did not.

**Close by telling the user to test it:** start the agent, sign in when the browser opens, use it
once.

## Using CIBA when the user isn't there

When the agent needs a person's approval but they are not at a screen, CIBA asks them out of band:
the agent requests, Asgardeo notifies the user, the agent waits until they approve. A *background*
agent is one set up this way.

If the agent was created with `--agent-type background`, its application already has the CIBA grant,
an approval expiry (`--ciba-expiry`, default 120 s) and notification channels
(`--notification-channels`, default `EMAIL`). Otherwise add them — **all three edits in one
command**, since the grant is rejected until the expiry time is set — keeping `authorization_code`,
which the agent's own token still needs:

```bash
asg apps protocol update --id <appId> --protocol oidc \
  --edit 'grantTypes=["authorization_code","refresh_token","urn:openid:params:grant-type:ciba"]' \
  --edit 'cibaAuthenticationRequest.authReqExpiryTime=120' \
  --edit 'cibaAuthenticationRequest.notificationChannels=["EMAIL"]' -N -y
```

`notificationChannels` accepts `EMAIL`, `SMS`, or `EXTERNAL` (the application delivers the
notification itself). For `EMAIL`, the user needs a registered email address.

The SDK has no CIBA helper yet, so this part is two plain requests from the agent's code:

```js
// 1. Ask. login_hint names the user; actor_token is the agent's own token.
const askRes = await fetch(`${BASE}/oauth2/ciba`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: CLIENT_ID,
    scope: 'openid read:orders', login_hint: userEmail,
    binding_message: 'Cancel order #482 for Acme Corp',
    actor_token: await getAgentToken(),
  }),
});
const { auth_req_id, interval, expires_in } = await askRes.json();

// 2. Poll until the user answers or the request expires.
const deadline = Date.now() + expires_in * 1000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, interval * 1000));
  const pollRes = await fetch(`${BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:openid:params:grant-type:ciba', client_id: CLIENT_ID, auth_req_id,
    }),
  });
  const body = await pollRes.json();
  if (pollRes.ok) return body.access_token;           // approved
  if (body.error !== 'authorization_pending') throw new Error(body.error_description);
}
throw new Error('the user did not respond in time');
```

(A confidential client sends `Authorization: Basic base64(client_id:client_secret)` on both calls
instead of `client_id` in the body.)

`binding_message` is what the user sees in the notification, and all they have to judge by — say what
the agent wants to do, specifically. An agent that asks vaguely trains people to approve without
reading. Respect `interval` rather than polling faster, and stop at `expires_in`.

---

## When something doesn't match

Steps 1–3, the agent's own token with scopes, and the on-behalf-of authorization URL have been
checked against a live organization. The delegated token after a real person signs in or approves an
email is expected to carry the `act` claim shown above; if a real run produces something different,
believe the token.

When the org returns something this file doesn't cover, go to the source, in this order:

- **The agent flows and their prerequisites** — the *Agent authentication* guide:
  `https://wso2.com/identity-platform/docs/guides/agentic-ai/ai-agents/agent-authentication/`
- **Creating and managing agents, credentials, roles** — the sibling guides under
  `guides/agentic-ai/ai-agents/` (*Register and manage agents*, *Agent credentials*, *Access control for agents*)
- **A framework's tool wiring** — its quickstart from the table above
- **CIBA for agents end to end** — `tutorials/ciba-for-ai-agents/`
- **Where the SDK's behaviour is the question** — its source: `asgardeo/javascript` on GitHub,
  `packages/javascript/src/AsgardeoJavaScriptClient.ts`
