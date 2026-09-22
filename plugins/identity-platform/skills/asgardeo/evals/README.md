# asgardeo — promptfoo evals

Evaluates the `asgardeo` skill as a real agent skill discovered from the fixture
workspace. See [EVALS.md](../../../../../EVALS.md) at the repo root for the shared guide.

## Layer 1: stubbed CLI

`fixtures/workspace/bin/asg` is a fake `asg` (Node, builtins only) that prints what
the real CLI prints — help texts and success/identifier lines are copied from the
CLI source — and keeps a small state file so `view`/`list` reflect earlier
`create` calls. `npm run eval` puts it first on PATH. No org, login or credentials
are needed, and nothing is created anywhere.

What this layer proves: the skill drives the CLI correctly (session check first,
right app type per framework, redirect URI registered = redirect URI wired, real
client ID and base URL copied into the code, secrets kept out of chat, the RBAC
pipeline in order). What it cannot prove: that the real CLI and Asgardeo accept
those commands today, or that a browser sign-in completes. That is a live run
against a sandbox org, not part of this suite.

## Run

```bash
npm install
npm run eval                       # whole matrix, 2 at a time
npm run eval:one -- "A/React"      # one scenario by description substring
npm run view
npm run reset                      # restore the fixture apps the agent edited
```

Requires Node >= 22.22 and `claude` logged in (or `ANTHROPIC_API_KEY`). Each run
bills the API (multi-turn agent + grader); run it on skill changes, not on every save.

The provider allows Bash, Write, Edit and WebFetch inside `fixtures/workspace`
so the agent can run the (stubbed) CLI, wire the SDK into the fixture apps and
read the docs quickstarts. Prompts tell it not to install packages.

## Layout

```text
assert/asg-checks.js      deterministic checks over the agent's tool calls
fixtures/workspace/
  .claude/skills/asgardeo real copy of the skill (refresh: node tools/sync-fixtures.js identity-platform asgardeo)
  bin/asg, bin/asg.js     the stub CLI; bin/asg-help/ holds real --help output
  apps/<framework>/       one minimal project per SDK row in references/sdk-integration.md,
                          plus orders-api (RBAC), orders-mcp (MCP), orders-assistant (agent)
tests/triggering.yaml     activates on the right prompts, stays out of api-publish's way
tests/task-quality.yaml   one scenario per framework + tracks B, C, D, E, F
```

## Adding a scenario

1. Add a minimal project under `fixtures/workspace/apps/`.
2. Add a test in `tests/task-quality.yaml`: put the answers the skill would ask for
   (name, URL, scopes) in the prompt and approve the plan up front, pick `checks`
   from `assert/asg-checks.js`, and write one rubric for what can't be checked
   deterministically.
3. If the scenario needs a CLI command the stub doesn't know, add it to
   `bin/asg.js` and capture its real `--help` into `bin/asg-help/`.
