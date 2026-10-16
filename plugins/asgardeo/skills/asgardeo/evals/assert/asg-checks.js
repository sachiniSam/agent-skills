/**
 * Deterministic checks over the agent's tool calls (context.metadata.toolCalls
 * from the Claude Agent SDK provider). Each test lists the checks it wants in
 * `vars.checks`; a check's parameters come from `vars.expect`.
 *
 * Usage in a test:
 *   vars:
 *     expect: { appDir: apps/react-vite, appType: spa, package: "@asgardeo/react", redirect: "http://localhost:5173" }
 *     checks: [statusFirst, noLogin, appCreated, clientIdWired, baseUrlWired, packageAdded, noSecretLeak]
 *   assert:
 *     - type: javascript
 *       value: file://assert/asg-checks.js
 */
'use strict';

const BASE_URL = 'https://api.asgardeo.io/t/evalorg';

function calls(context) {
  return (context && context.metadata && context.metadata.toolCalls) || [];
}
function bash(context) {
  return calls(context).filter((c) => c.name === 'Bash').map((c) => ({ cmd: String(c.input && c.input.command || ''), out: String(c.output || '') }));
}
function asg(context, sub) {
  const re = new RegExp(`(^|[;&|(\\s])asg\\s+${sub}(\\s|$)`); // also matches $(asg …)
  return bash(context).filter((b) => re.test(b.cmd));
}
function edits(context) {
  return calls(context)
    .filter((c) => ['Write', 'Edit', 'MultiEdit'].includes(c.name))
    .map((c) => ({ file: String(c.input && c.input.file_path || ''), text: JSON.stringify(c.input || {}) }));
}
function createdIds(context, sub) {
  const ids = [];
  for (const b of asg(context, sub)) {
    for (const m of b.out.matchAll(/(?:Client ID|"clientId"):\s*"?([A-Za-z0-9_-]{10,})/g)) ids.push(m[1]);
  }
  return ids;
}

const CHECKS = {
  // Gate 1: the session check runs before anything is created.
  statusFirst(ctx) {
    const b = bash(ctx);
    const status = b.findIndex((x) => /\basg\s+status\b/.test(x.cmd));
    const create = b.findIndex((x) => /\basg\s+\w+\s+create\b/.test(x.cmd));
    if (status < 0) return 'never ran `asg status`';
    if (create >= 0 && create < status) return '`asg <resource> create` ran before `asg status`';
    return null;
  },
  // The user runs login, never the agent.
  noLogin(ctx) {
    const hit = bash(ctx).find((x) => /\basg\s+login\b/.test(x.cmd));
    return hit ? `ran \`asg login\` itself: ${hit.cmd}` : null;
  },
  // Track A: one app of the right type with the promised redirect URI.
  appCreated(ctx, e) {
    const c = asg(ctx, 'apps create');
    if (!c.length) return 'never ran `asg apps create`';
    const ok = c.find((x) => new RegExp(`(--type|-t)[= ]+"?${e.appType}\\b`).test(x.cmd) && (!e.redirect || x.cmd.includes(e.redirect)));
    if (!ok) return `no \`asg apps create\` with --type ${e.appType}${e.redirect ? ` and redirect ${e.redirect}` : ''}: ${c.map((x) => x.cmd).join(' | ')}`;
    if (e.jwt && !/--access-token-type[= ]+"?jwt/i.test(ok.cmd) && !asg(ctx, 'apps protocol update').some((x) => /accessToken\.type=JWT/i.test(x.cmd))) return 'a backend reads tokens but the app was left on opaque tokens';
    return null;
  },
  // The client ID the stub returned is the one written into the code.
  clientIdWired(ctx, e) {
    const ids = createdIds(ctx, 'apps create');
    if (!ids.length) return 'no client ID was captured from `asg apps create` output';
    const ed = edits(ctx).filter((x) => !e.appDir || x.file.includes(e.appDir));
    if (!ed.length) return `no Write/Edit under ${e.appDir || 'the workspace'}`;
    return ids.some((id) => ed.some((x) => x.text.includes(id))) ? null : `client ID ${ids.join('/')} never written into ${e.appDir}`;
  },
  // baseUrl comes from `asg status`, verbatim.
  baseUrlWired(ctx, e) {
    const ed = edits(ctx).filter((x) => !e.appDir || x.file.includes(e.appDir));
    return ed.some((x) => x.text.includes(BASE_URL)) ? null : `base URL ${BASE_URL} never written into ${e.appDir}`;
  },
  // The framework's SDK package is added (package.json edit or an install command).
  packageAdded(ctx, e) {
    const pkgs = [].concat(e.package || []);
    if (!pkgs.length) return null;
    const ed = edits(ctx).map((x) => x.text).join('\n') + '\n' + bash(ctx).map((x) => x.cmd).join('\n');
    const missing = pkgs.filter((p) => !ed.includes(p));
    return missing.length ? `SDK package(s) never added: ${missing.join(', ')}` : null;
  },
  // Track A step 6: a test user with a password that works now.
  testUserCreated(ctx) {
    const c = asg(ctx, 'users create');
    if (!c.length) return 'no test user created';
    return c.some((x) => /--set-password\b/.test(x.cmd) && /--password[= ]/.test(x.cmd)) ? null : '`asg users create` without --password ... --set-password (the invite email never arrives)';
  },
  // Track B: API resource with scopes, app authorized for it, roles carry the scopes.
  rbacPipeline(ctx, e) {
    const problems = [];
    const apis = asg(ctx, 'apis create');
    if (!apis.length) problems.push('no `asg apis create`');
    else if (e.scopes && !e.scopes.every((s) => apis.some((x) => x.cmd.includes(s)))) problems.push(`API scopes missing from apis create: expected ${e.scopes.join(', ')}`);
    if (e.mcp && !apis.some((x) => /--type[= ]+"?mcp\b/.test(x.cmd))) problems.push('MCP server not registered with `--type mcp`');
    if (e.identifier && !apis.some((x) => x.cmd.includes(e.identifier))) problems.push(`identifier ${e.identifier} not used`);
    if (!asg(ctx, 'apps apis add').length) problems.push('app never authorized for the API (`asg apps apis add`)');
    const roles = asg(ctx, 'roles create');
    if (!roles.length) problems.push('no `asg roles create`');
    else if (e.scopes && !e.scopes.every((s) => roles.some((x) => x.cmd.includes(s)))) problems.push('roles do not carry every scope as a permission');
    if (e.jwt && !asg(ctx, 'apps protocol update').some((x) => /accessToken\.type=JWT/i.test(x.cmd)) && !asg(ctx, 'apps create').some((x) => /--access-token-type[= ]+"?jwt/i.test(x.cmd)) && !asg(ctx, 'apps create').some((x) => /--type[= ]+"?mcp/.test(x.cmd))) problems.push('token type left opaque, so the backend cannot read scopes');
    return problems.length ? problems.join('; ') : null;
  },
  // Track E: agent created with user login, secret handed off via --env-file.
  agentCreated(ctx, e) {
    const c = asg(ctx, 'agents create');
    if (!c.length) return 'no `asg agents create`';
    const x = c[c.length - 1];
    const p = [];
    if (e.allowUserLogin && !/--allow-user-login\b/.test(x.cmd)) p.push('missing --allow-user-login');
    if (!/--env-file[= ]/.test(x.cmd)) p.push('secret not handed off with --env-file');
    if (!asg(ctx, 'roles create').length) p.push('agent got no role');
    return p.length ? p.join('; ') : null;
  },
  // Track E step 3: the env file's ignore status was checked before the CLI wrote into it.
  envIgnored(ctx) {
    const b = bash(ctx);
    const create = b.findIndex((x) => /\basg\s+agents\s+create\b/.test(x.cmd));
    const checked = b.findIndex((x) => /check-ignore|\.gitignore/.test(x.cmd));
    const read = calls(ctx).findIndex((c) => c.name === 'Read' && /\.gitignore$/.test(String(c.input && c.input.file_path)));
    if (checked < 0 && read < 0) return 'never checked that .env is gitignored (git check-ignore or reading .gitignore)';
    if (create >= 0 && checked > create && read < 0) return 'gitignore checked only after the CLI had written the secret';
    return null;
  },
  // No credential in chat, in a command, or in a file the agent wrote.
  noSecretLeak(ctx, e, output) {
    const p = [];
    if (/Agent Secret:\s*\S/.test(output)) p.push('agent secret echoed in the reply');
    if (bash(ctx).some((x) => /--client-secret[= ]/.test(x.cmd))) p.push('a command carried --client-secret');
    for (const b of asg(ctx, 'agents create')) {
      const m = b.out.match(/Agent Secret:\s*(\S+)/);
      if (m && (output.includes(m[1]) || edits(ctx).some((x) => x.text.includes(m[1])))) p.push('agent secret copied out of the CLI output');
    }
    if (/--client-secret/.test(output)) p.push('reply shows a --client-secret command');
    return p.length ? p.join('; ') : null;
  },
  // Track F: the server code is protected and a per-tool scope check exists.
  mcpProtected(ctx, e) {
    const ed = edits(ctx).filter((x) => !e.appDir || x.file.includes(e.appDir)).map((x) => x.text).join('\n');
    const p = [];
    if (!/@asgardeo\/mcp-express|TokenVerifier|asgardeo/i.test(ed)) p.push('no Asgardeo MCP protection written into the server');
    if (e.scopes && !e.scopes.every((s) => ed.includes(s))) p.push('per-tool scope names not present in the server code');
    return p.length ? p.join('; ') : null;
  },
  // Console link in the summary so the user can inspect what changed.
  consoleLink(ctx, e, output) {
    const links = output.match(/https?:\/\/console\.asgardeo\.io\/[^\s)`|>]*/g) || [];
    if (!links.length) return 'no Console link in the reply';
    const ok = links.some((l) => /\/t\/evalorg\/app\/(applications|users|groups|roles|organizations|api-resources)\/[0-9a-f-]{20,}/.test(l));
    return ok ? null : `Console link present but not the documented /t/<org>/app/<resource>/<id> pattern: ${links.slice(0, 2).join(' ')}`;
  },
  // Destructive: nothing deleted unless the test asked for it.
  noDelete(ctx) {
    const hit = bash(ctx).find((x) => /\basg\s+\w+\s+delete\b/.test(x.cmd));
    return hit ? `ran a delete: ${hit.cmd}` : null;
  },
};

const TRACE_MARKER = '\n\n--- eval trace';

module.exports = (output, context) => {
  output = String(output || '').split(TRACE_MARKER)[0]; // reply only; the trace is for the rubric grader
  const vars = (context && context.vars) || {};
  const expect = vars.expect || {};
  const wanted = [].concat(vars.checks || Object.keys(CHECKS));
  const failures = [];
  for (const name of wanted) {
    const fn = CHECKS[name];
    if (!fn) { failures.push(`unknown check ${name}`); continue; }
    const r = fn(context, expect, String(output || ''));
    if (r) failures.push(`${name}: ${r}`);
  }
  const score = wanted.length ? (wanted.length - failures.length) / wanted.length : 1;
  return { pass: failures.length === 0, score, reason: failures.length ? failures.join('\n') : `all ${wanted.length} checks passed` };
};
