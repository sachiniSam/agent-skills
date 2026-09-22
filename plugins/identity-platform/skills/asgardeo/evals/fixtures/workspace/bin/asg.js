/**
 * Stub `asg` CLI for Layer 1 evals.
 *
 * Stands in for the real Asgardeo CLI so the skill can be evaluated without an
 * org, a browser login or credentials. Output formats and help texts are taken
 * from the real CLI (internal/locale/en/*.json, cmdutils.ReportCreated) so the
 * agent sees what production prints. State lives in ../.asg-stub/state.json so
 * `view`/`list` reflect earlier `create` calls within a run.
 *
 * Node builtins only. Invoked through the `asg` shell wrapper beside it, which passes
 * `--` first: Node 22 otherwise consumes a `--env-file` meant for the stub.
 * Put ../bin first on PATH (see package.json "eval").
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HELP_DIR = path.join(__dirname, 'asg-help');
const STATE_DIR = path.join(__dirname, '..', '.asg-stub');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const ORG = 'evalorg';
const BASE_URL = `https://api.asgardeo.io/t/${ORG}`;

// ---- args ------------------------------------------------------------------
const BOOL_FLAGS = new Set([
  '-y', '--yes', '-N', '--no-interactive', '-v', '--verbose', '--no-color', '-h', '--help',
  '--set-password', '--require-auth', '--allow-user-login', '--api-based-auth', '-c', '--copy-password',
]);
const ALIAS = { '-n': '--name', '-i': '--id', '-t': '--type', '-p': '--permission-name', '-e': '--edit',
  '-a': '--add', '-r': '--remove', '-u': '--user-id', '-g': '--group-id', '-q': '--query', '-F': '--first-name', '-L': '--last-name' };

function parse(argv) {
  const words = [];
  const flags = {};
  const push = (k, v) => { flags[k] = k in flags ? [].concat(flags[k], v) : v; };
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    if (!a.startsWith('-')) { words.push(a); continue; }
    let val;
    if (a.includes('=') && a.startsWith('--')) { [a, val] = [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]; }
    a = ALIAS[a] || a;
    if (BOOL_FLAGS.has(a)) { push(a.replace(/^-+/, ''), true); continue; }
    if (val === undefined) val = argv[++i];
    push(a.replace(/^-+/, ''), val);
  }
  return { words, flags };
}
const { words, flags } = parse(process.argv.slice(2).filter((a, i) => !(i === 0 && a === '--')));
const fmt = flags.format;
const json = fmt === 'json' || fmt === 'yaml';
const list = (v) => (v === undefined ? [] : [].concat(v).flatMap((s) => String(s).split(',')));
const uuid = () => crypto.randomUUID();
const rand = (n) => crypto.randomBytes(n).toString('base64url').slice(0, n);

// ---- state -----------------------------------------------------------------
let state = { apps: [], users: [], apis: [], roles: [], groups: [], agents: [], authorizations: [] };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch { /* fresh */ }
const save = () => { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); };

// ---- output (mirrors cmdutils.ReportCreated / printer.Success) -------------
const msgOut = json ? process.stderr : process.stdout;
function success(msg, data, identifiers) {
  msgOut.write(`SUCCESS: ${msg}\n`);
  if (json && data) { process.stdout.write(JSON.stringify(data, null, 2) + '\n'); return; }
  for (const [label, key] of [['ID', 'id'], ['Client ID', 'clientId']]) {
    if (identifiers && identifiers[key]) process.stdout.write(`${label}: ${identifiers[key]}\n`);
  }
}
function data(obj) {
  if (json) { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); return; }
  const rows = Array.isArray(obj) ? obj : [obj];
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) process.stdout.write(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}\n`);
    process.stdout.write('\n');
  }
}
function fail(msg, code = 1) { process.stderr.write(`ERROR: ${msg}\n`); process.exit(code); }
function find(coll, { id, name }) {
  const hit = coll.find((x) => (id && x.id === id) || (name && x.name === name));
  if (!hit) fail(`${coll === state.apps ? 'Application' : 'Resource'} not found${id ? ` with id ${id}` : name ? ` with name ${name}` : ''}`);
  return hit;
}
const origin = (u) => { try { return new URL(u).origin; } catch { return null; } };

// ---- help ------------------------------------------------------------------
if (flags.help || words.length === 0) {
  for (let n = words.length; n >= 0; n--) {
    const f = path.join(HELP_DIR, (n ? words.slice(0, n).join('_') : 'root') + '.txt');
    if (fs.existsSync(f)) { process.stdout.write(fs.readFileSync(f, 'utf8')); process.exit(0); }
  }
  fail(`unknown command "${words.join(' ')}" for "asg"`);
}

// ---- commands --------------------------------------------------------------
const [res, verb, sub] = words;
const key = [res, verb, sub].filter(Boolean).join(' ');

// Like cobra, reject flags the real command does not define. The known set is
// read from the captured --help text, so an invented flag fails here exactly as
// it would against the real CLI.
(function rejectUnknownFlags() {
  // Only when this exact command's help was captured; a parent's flag list
  // would reject valid leaf flags.
  const helpFile = path.join(HELP_DIR, words.join('_') + '.txt');
  if (!fs.existsSync(helpFile) || /^Available Commands:/m.test(fs.readFileSync(helpFile, 'utf8'))) return;
  const known = new Set(['format', 'no-color', 'no-interactive', 'verbose', 'help', 'yes']);
  const shorts = new Set(['N', 'y', 'v', 'h']);
  for (const m of fs.readFileSync(helpFile, 'utf8').matchAll(/^\s+(?:-(\w),\s+)?--([a-z][a-z0-9-]*)/gm)) { known.add(m[2]); if (m[1]) shorts.add(m[1]); }
  const raw = process.argv.slice(2).filter((a) => a.startsWith('-') && a !== '--');
  const bad = raw.find((a) => {
    const k = a.startsWith('--') ? a.slice(2).split('=')[0] : null;
    if (k !== null) return !known.has(k);
    return !shorts.has(a.slice(1)) && !(ALIAS[a] && known.has(ALIAS[a].slice(2)));
  });
  if (bad && res !== 'api') fail(`unknown ${bad.startsWith('--') ? 'flag' : 'shorthand flag'}: ${bad}`);
})();

switch (true) {
  case res === 'status': {
    const exp = new Date(Date.now() + 55 * 60e3).toISOString();
    process.stdout.write(`✓ Authenticated\nServer: asgardeo\nBase URL: ${BASE_URL}\nToken Expiry: ${exp}\nLast Login: ${new Date().toISOString()}\n`);
    break;
  }
  case res === 'login':
    fail('stub: `asg login` is the user\'s to run. The eval session is already authenticated; use `asg status`.');
    break;
  case res === 'logout':
    success('Logged out successfully'); break;

  // -- apps ------------------------------------------------------------------
  case key === 'apps create': {
    const type = String(flags.type || 'oidc').toLowerCase();
    if (!flags.name) fail('required flag(s) "name" not set');
    if (!['saml', 'oidc', 'spa', 'mobile', 'mcp'].includes(type)) fail(`unsupported application type "${type}" (saml, oidc, spa, mobile, mcp)`);
    const uris = list(flags['redirect-uri']);
    if (type !== 'saml' && !uris.length) fail('required flag(s) "redirect-uri" not set');
    const jwt = type === 'mcp' || String(flags['access-token-type'] || '').toLowerCase() === 'jwt';
    const app = {
      id: uuid(), name: flags.name, description: flags.description || '', type, clientId: rand(20),
      apiBasedAuth: !!flags['api-based-auth'],
      protocol: {
        callbackURLs: uris, allowedOrigins: [...new Set(uris.map(origin).filter(Boolean))],
        grantTypes: type === 'spa' || type === 'mcp' ? ['authorization_code', 'refresh_token'] : ['authorization_code', 'refresh_token', 'client_credentials'],
        publicClient: type === 'spa' || type === 'mobile' || type === 'mcp',
        pkce: { mandatory: type === 'spa' || type === 'mobile' || type === 'mcp', supportPlainTransformAlgorithm: false },
        accessToken: { type: jwt ? 'JWT' : 'Default', userAccessTokenExpiryInSeconds: 3600 },
        refreshToken: { expiryInSeconds: 86400, renewRefreshToken: true },
      },
      requestedClaims: ['http://wso2.org/claims/emailaddress', 'http://wso2.org/claims/username'],
    };
    if (!app.protocol.publicClient) app.protocol.clientSecret = rand(40);
    state.apps.push(app); save();
    success(`Application ${app.name} (${type}) created successfully`, { id: app.id, name: app.name, clientId: app.clientId, type }, app);
    break;
  }
  case key === 'apps list' || key === 'apps filter':
    data(state.apps.map(({ id, name, type, clientId }) => ({ id, name, type, clientId }))); break;
  case key === 'apps view': {
    const a = find(state.apps, flags);
    data({ id: a.id, name: a.name, description: a.description, clientId: a.clientId, type: a.type, apiBasedAuth: a.apiBasedAuth, requestedClaims: a.requestedClaims });
    break;
  }
  case key === 'apps update':
    find(state.apps, flags); success('Application updated successfully'); break;
  case key === 'apps settings': {
    const a = find(state.apps, flags);
    process.stdout.write(`https://console.asgardeo.io/t/${ORG}/app/applications/${a.id}#tab=protocol\n`);
    break;
  }
  case key === 'apps protocol view': {
    const a = find(state.apps, flags);
    const { clientSecret, ...p } = a.protocol; // the secret is never printed
    data({ clientId: a.clientId, ...p });
    break;
  }
  case key === 'apps protocol update': {
    const a = find(state.apps, flags);
    for (const e of list(flags.edit).length ? [].concat(flags.edit) : []) {
      const i = e.indexOf('='); if (i < 0) fail(`invalid --edit "${e}" (expected path=value)`);
      const p = e.slice(0, i).split('.'); let v = e.slice(i + 1);
      try { v = JSON.parse(v); } catch { /* string */ }
      let o = a.protocol; while (p.length > 1) { const k = p.shift(); o[k] = o[k] || {}; o = o[k]; }
      o[p[0]] = v;
      if (p[0] === 'callbackURLs') a.protocol.allowedOrigins = [...new Set([].concat(v).map(origin).filter(Boolean))];
    }
    save(); success('Application updated successfully'); break;
  }
  case key === 'apps apis add': {
    const a = find(state.apps, flags);
    const api = find(state.apis, { id: flags['api-id'] });
    const scopes = list(flags.scopes);
    const unknown = scopes.filter((s) => !api.scopes.some((x) => x.name === s));
    if (unknown.length) fail(`scope(s) not defined on API resource ${api.name}: ${unknown.join(', ')}`);
    state.authorizations.push({ appId: a.id, apiId: api.id, scopes, policy: flags.policy || 'RBAC' }); save();
    success(`API resource ${api.name} authorized for application ${a.name}`); break;
  }
  case key === 'apps apis list': {
    const a = find(state.apps, flags);
    data(state.authorizations.filter((x) => x.appId === a.id).map((x) => ({ apiId: x.apiId, apiName: find(state.apis, { id: x.apiId }).name, scopes: x.scopes, policy: x.policy })));
    break;
  }
  case key === 'apps claims': {
    const a = find(state.apps, flags);
    a.requestedClaims = [...new Set([...a.requestedClaims, ...list(flags.add)])].filter((c) => !list(flags.remove).includes(c));
    save();
    if (flags.add || flags.remove) success('Requested claims updated successfully'); else data({ requestedClaims: a.requestedClaims });
    break;
  }

  // -- users / groups --------------------------------------------------------
  case key === 'users create': {
    if (!flags.email) fail('required flag(s) "email" not set');
    const u = { id: uuid(), userName: flags.email, email: flags.email, givenName: flags['first-name'] || '', familyName: flags['last-name'] || '',
      userStore: flags['user-store'] || 'DEFAULT', passwordSet: !!(flags.password && flags['set-password']) };
    state.users.push(u); save();
    success(`user created successfully: ${u.email} (${u.id})`, u, u);
    if (!u.passwordSet) msgOut.write('An email has been sent to the user to set their password.\n');
    break;
  }
  case key === 'users list' || key === 'users filter':
    data(state.users.map(({ id, userName, email }) => ({ id, userName, email }))); break;
  case key === 'users view':
    data(find(state.users, { id: flags.id, name: flags.name || flags.email })); break;
  case key === 'groups create': {
    const g = { id: uuid(), name: flags.name, members: [] }; state.groups.push(g); save();
    success('Group created successfully', g, g); break;
  }
  case key === 'groups list':
    data(state.groups); break;

  // -- apis ------------------------------------------------------------------
  case key === 'apis create': {
    if (!flags.name || !flags.identifier) fail('required flag(s) "name", "identifier" not set');
    let scopes = [];
    if (flags.scopes) {
      const raw = String(flags.scopes).startsWith('@') ? fs.readFileSync(String(flags.scopes).slice(1), 'utf8') : flags.scopes;
      try { scopes = JSON.parse(raw); } catch { fail('--scopes must be a valid JSON array'); }
    }
    const api = { id: uuid(), name: flags.name, identifier: flags.identifier, description: flags.description || '',
      type: (flags.type || 'business').toUpperCase(), requiresAuthorization: !!flags['require-auth'], scopes };
    state.apis.push(api); save();
    success(`API Resource created successfully: ${api.name} (${api.id})`, api, api); break;
  }
  case key === 'apis list' || key === 'apis filter':
    data(state.apis.map(({ id, name, identifier, type }) => ({ id, name, identifier, type }))); break;
  case key === 'apis view':
    data(find(state.apis, flags)); break;

  // -- roles -----------------------------------------------------------------
  case key === 'roles create': {
    if (!flags.name) fail('required flag(s) "name" not set');
    const aud = String(flags['audience-type'] || 'Application');
    if (!['Application', 'Organization'].includes(aud)) fail("--audience-type must be 'Application' or 'Organization'");
    if (aud === 'Application' && !flags['audience-id']) fail('--audience-id is required for Application audience');
    const r = { id: uuid(), name: flags.name, audience: { type: aud, value: flags['audience-id'] || ORG }, permissions: list(flags['permission-name']), users: [], groups: [] };
    state.roles.push(r); save();
    success('Role Created Successfully', r, r); break;
  }
  case key === 'roles list' || key === 'roles filter':
    data(state.roles.map(({ id, name, audience, permissions }) => ({ id, name, audience, permissions }))); break;
  case key === 'roles view':
    data(find(state.roles, flags)); break;
  case key === 'roles users add' || key === 'roles groups add': {
    const r = find(state.roles, { id: flags.id || flags['role-id'], name: flags.name || flags['role-name'] });
    const ids = list(flags['user-id'] || flags['group-id'] || flags.users || flags.groups || flags.user || flags.group);
    (verb === 'users' ? r.users : r.groups).push(...ids); save();
    success(`${verb === 'users' ? 'Users' : 'Groups'} assigned to role ${r.name}`); break;
  }
  case key === 'roles users list' || key === 'roles groups list':
    data(find(state.roles, flags)[verb]); break;

  // -- agents ----------------------------------------------------------------
  case key === 'agents create': {
    if (!flags.name) fail('required flag(s) "name" not set');
    const login = !!flags['allow-user-login'];
    if (login && !flags['redirect-uri']) fail('--redirect-uri is required with --allow-user-login');
    const id = uuid(); const secret = rand(32);
    const agent = { id, name: flags.name, description: flags.description || '', allowUserLogin: login, agentType: flags['agent-type'] || 'interactive' };
    state.agents.push(agent);
    let clientId;
    if (login) {
      clientId = rand(20);
      state.apps.push({ id, name: flags.name, description: 'Agent application', type: 'oidc', clientId, apiBasedAuth: true,
        protocol: { callbackURLs: list(flags['redirect-uri']), allowedOrigins: [], grantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
          publicClient: false, pkce: { mandatory: false }, accessToken: { type: 'JWT' } }, requestedClaims: [] });
    }
    save();
    success('Agent created successfully', { ...agent, clientId }, { id });
    if (flags['env-file']) {
      const f = path.resolve(String(flags['env-file']));
      let body = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      const set = (k, v) => { body = body.match(new RegExp(`^${k}=.*$`, 'm')) ? body.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : body + (body && !body.endsWith('\n') ? '\n' : '') + `${k}=${v}\n`; };
      set('AGENT_ID', id); set('AGENT_SECRET', secret); if (clientId) set('CLIENT_ID', clientId);
      fs.writeFileSync(f, body, { mode: 0o600 });
      process.stdout.write(`Agent secret written to ${f} (not shown). Keep that file out of version control.\n`);
    } else if (flags['copy-password']) {
      process.stdout.write('Agent secret copied to clipboard (not shown).\n');
    } else {
      process.stdout.write(`IMPORTANT: this secret is shown once.\n\tAgent Secret: ${secret}\n`);
    }
    if (clientId) process.stdout.write(`Application (same ID as the agent) client ID: ${clientId}\n`);
    break;
  }
  case key === 'agents list' || key === 'agents filter':
    data(state.agents); break;
  case key === 'agents view':
    data(find(state.agents, flags)); break;

  // -- raw management API ----------------------------------------------------
  case res === 'api': {
    const method = (verb || 'GET').toUpperCase(); const p = sub || '';
    if (!p) fail('usage: asg api <method> <path> [--data ...]');
    data({ stub: true, method, path: p, result: method === 'GET' ? [] : { id: uuid() } }); break;
  }
  case res === 'tui':
    fail('stub: the TUI needs an interactive terminal');
    break;
  default:
    fail(`unknown command "${key}" for "asg"`);
}
