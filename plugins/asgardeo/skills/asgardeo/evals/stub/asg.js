/**
 * Stub `asg` CLI for Layer 1 evals.
 *
 * Stands in for the real Asgardeo CLI so the skill can be evaluated without an
 * org, a browser login or credentials. Messages, stream routing and JSON shapes
 * follow the release CLI (internal/locale/en/*.json, printer.go,
 * cmdutils.ReportCreated) so the agent sees what production prints. State lives
 * in ../.asg-stub/state.json so `view`/`list` reflect earlier `create` calls
 * within a run.
 *
 * Source lives in evals/stub/; scripts/prepare.js copies it to
 * fixtures/workspace/bin/asg.js, writes the `asg` shell wrapper beside it (which
 * passes `--` first: Node 22 otherwise consumes a `--env-file` meant for the
 * stub) and captures the real CLI's --help texts into bin/asg-help/.
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
// Client secrets carry this prefix so asg-checks.js can tell when one reached the agent.
const SECRET_PREFIX = 'stubsecret_';

// ---- args ------------------------------------------------------------------
const BOOL_FLAGS = new Set([
  '-y', '--yes', '-N', '--no-interactive', '-v', '--verbose', '--no-color', '-h', '--help',
  '--set-password', '--require-auth', '--allow-user-login', '--api-based-auth', '-c', '--copy-password', '--raw',
]);
const ALIAS = { '-n': '--name', '-i': '--id', '-t': '--type', '-p': '--permission-name', '-e': '--edit',
  '-a': '--add', '-r': '--remove', '-u': '--user-id', '-g': '--group-id', '-q': '--query', '-f': '--file',
  '-X': '--method', '-b': '--body', '-H': '--header', '-o': '--output' };
// Command aliases from constants.go, so `asg app ls` resolves like the real CLI.
const RES_ALIAS = { app: 'apps', application: 'apps', applications: 'apps', user: 'users', group: 'groups',
  role: 'roles', 'api-resource': 'apis', 'api-resources': 'apis', agent: 'agents', org: 'orgs',
  organization: 'orgs', organizations: 'orgs', scope: 'scopes', idp: 'idps' };
const VERB_ALIAS = { ls: 'list', del: 'delete' };

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
if (words[0]) words[0] = RES_ALIAS[words[0]] || words[0];
if (words[1]) words[1] = VERB_ALIAS[words[1]] || words[1];
const fmt = flags.format;
if (fmt !== undefined && !['json', 'yaml'].includes(fmt)) {
  fail(`resolving output format: invalid output format "${fmt}": supported values are "json" and "yaml"`);
}
const json = !!fmt;
const unattended = !!(flags.N || flags['no-interactive'] || flags['no-color']);
const list = (v) => (v === undefined ? [] : [].concat(v).flatMap((s) => String(s).split(',')).map((s) => s.trim()).filter(Boolean));
const uuid = () => crypto.randomUUID();
const rand = (n) => crypto.randomBytes(n).toString('base64url').slice(0, n);

// ---- state -----------------------------------------------------------------
let state = { apps: [], users: [], apis: [], roles: [], groups: [], agents: [], authorizations: [] };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch { /* fresh */ }
const save = () => { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); };

// ---- output (mirrors printer.go / cmdutils) --------------------------------
// With --format, messages and Printf lines go to stderr and only the payload
// goes to stdout. Without it everything goes to stdout.
const msgOut = json ? process.stderr : process.stdout;
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const dump = (obj) => JSON.stringify(sortKeys(obj), null, 2) + '\n';
const say = (line) => msgOut.write(line + '\n');
// printer.Success: the message, then the data as JSON (stdout) when there is any.
function success(msg, payload) {
  say(`SUCCESS: ${msg}`);
  if (payload !== undefined) process.stdout.write(dump(payload));
}
// cmdutils.ReportCreated: ID lines in plain mode, the created object with --format.
function created(msg, obj) {
  say(`SUCCESS: ${msg}`);
  if (json) { process.stdout.write(dump(obj)); return; }
  if (obj.id) process.stdout.write(`ID: ${obj.id}\n`);
  if (obj.clientId) process.stdout.write(`Client ID: ${obj.clientId}\n`);
}
// List commands: the response struct with --format, a tabwriter table otherwise.
function table(fetchedLine, headers, rows, response) {
  if (fetchedLine) say(fetchedLine);
  if (json) { process.stdout.write(dump(response)); return; }
  const cells = [headers, headers.map(() => '----------'), ...rows.map((r) => r.map((c) => (c === undefined || c === '' ? '-' : String(c))))];
  const w = headers.map((_, i) => Math.max(...cells.map((r) => r[i].length)));
  for (const r of cells) process.stdout.write(r.map((c, i) => c.padEnd(w[i] + 2)).join('').trimEnd() + '\n');
}
// Filter commands open a full-screen TUI unless -N or --no-color is set.
function filtered(label, headers, rows, response) {
  if (!unattended) fail('stub: `filter` opens an interactive TUI here; the real CLI needs -N (or --no-color) to print results');
  if (!rows.length) { say(`SUCCESS: Filter completed! 0 ${label} found`); return; }
  table(null, headers, rows, response);
}
function fail(msg) { process.stderr.write(`ERROR: ${msg}\n`); process.exit(1); }
function missing(names) {
  const m = names.filter((n) => flags[n] === undefined || flags[n] === '');
  if (m.length) fail(`missing required flags: ${m.join(', ')}`);
}
function deprecated(text) { process.stderr.write(`Command "list" is deprecated, ${text}\n`); }
const SELECT = 'either ID or name prefix or query must be provided\nPlease provide either ID (-i) or name prefix (-n) or query (-q)';
function find(coll, resourceType, nameKey = 'name') {
  const { id, name, query } = flags;
  if (!id && !name && !query) fail(SELECT);
  if (id && (name || query)) fail('ID cannot be provided with name prefix or query\nPlease provide either ID (-i) or name prefix (-n) or query (-q), but not in combination');
  if (id) {
    const hit = coll.find((x) => x.id === id);
    if (!hit) fail(`resolving resource ID: no ${resourceType} found matching the specified criteria`);
    return hit;
  }
  const prefix = String(name || String(query).replace(/^.*\b(?:eq|sw|co)\s+"?([^"]*)"?.*$/, '$1'));
  const hits = coll.filter((x) => String(x[nameKey] || '').startsWith(prefix));
  if (!hits.length) fail(`resolving resource ID: no ${resourceType} found matching the specified criteria`);
  if (hits.length > 1) fail(`resolving resource ID: multiple ${resourceType} found. Please provide a specific ID (-i) in non-interactive mode`);
  say(`Found unique ${resourceType}: ${hits[0][nameKey]} (${hits[0].id})`);
  return hits[0];
}
const origin = (u) => { try { return new URL(u).origin; } catch { return null; } };
const maskSecret = (p) => (p.clientSecret ? { ...p, clientSecret: '***' } : p);
function protocolOut(msg, a) {
  const p = { clientId: a.clientId, ...a.protocol };
  success(msg, json ? p : maskSecret(p)); // the release masks the secret only without --format
}

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
  if (bad) fail(`unknown ${bad.startsWith('--') ? 'flag' : 'shorthand flag'}: ${bad}`);
})();

switch (true) {
  case res === 'status': {
    const t = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
    process.stdout.write(`✓ Authenticated\nServer: asgardeo\nBase URL: ${BASE_URL}\nToken Expiry: ${t(new Date(Date.now() + 55 * 60e3))}\nLast Login: ${t(new Date())}\n`);
    break;
  }
  case res === 'login':
    fail('stub: `asg login` is the user\'s to run. The eval session is already authenticated; use `asg status`.');
    break;
  case res === 'logout':
    success('Logged out successfully'); break;

  // -- apps ------------------------------------------------------------------
  case key === 'apps create': {
    if (!flags.type) fail('application type is required');
    const type = String(flags.type).toLowerCase();
    missing(type === 'saml' ? ['name', 'acs-uri', 'issuer'] : ['name', 'redirect-uri']);
    if (!['saml', 'oidc', 'spa', 'mobile', 'mcp'].includes(type)) fail(`Failed to create application!: invalid application type: ${type}`);
    const tokenType = flags['access-token-type'] && String(flags['access-token-type']).toLowerCase();
    if (tokenType && !['jwt', 'opaque', 'default'].includes(tokenType)) fail(`Failed to create application!\ninvalid access token type "${tokenType}": supported values are jwt and opaque`);
    if (String(flags.name).length < 3) fail('Failed to create application!\nvalidation failed:\n  - name must be at least 3 characters long');
    const uris = list(flags['redirect-uri']);
    const jwt = type === 'mcp' || tokenType === 'jwt';
    const publicClient = ['spa', 'mobile', 'mcp'].includes(type);
    const app = {
      id: uuid(), name: flags.name, description: flags.description || '', type, clientId: rand(20),
      apiBasedAuth: !!flags['api-based-auth'],
      protocol: {
        callbackURLs: uris, allowedOrigins: [...new Set(uris.map(origin).filter(Boolean))],
        grantTypes: publicClient ? ['authorization_code', 'refresh_token'] : ['authorization_code', 'refresh_token', 'client_credentials'],
        publicClient,
        pkce: { mandatory: publicClient, supportPlainTransformAlgorithm: false },
        accessToken: { type: jwt ? 'JWT' : 'Default', userAccessTokenExpiryInSeconds: 3600 },
        refreshToken: { expiryInSeconds: 86400, renewRefreshToken: true },
      },
      claimConfiguration: { requestedClaims: [{ claim: { uri: 'http://wso2.org/claims/emailaddress' } }, { claim: { uri: 'http://wso2.org/claims/username' } }] },
    };
    if (!publicClient) app.protocol.clientSecret = SECRET_PREFIX + rand(32);
    state.apps.push(app); save();
    created(`Application ${app.name} (${type}) created successfully`, appView(app));
    break;
  }
  case key === 'apps list':
    table(`fetched ${state.apps.length} out of ${state.apps.length} applications (from index: 0)`, ['ID', 'Name', 'Description'],
      state.apps.map((a) => [a.id, a.name, a.description]),
      { totalResults: state.apps.length, startIndex: 1, count: state.apps.length, applications: state.apps.map((a) => ({ id: a.id, name: a.name, description: a.description })), links: [] });
    break;
  case key === 'apps filter':
    filtered('applications', ['ID', 'Name', 'Description'], state.apps.map((a) => [a.id, a.name, a.description]),
      { totalResults: state.apps.length, startIndex: 1, count: state.apps.length, applications: state.apps.map((a) => ({ id: a.id, name: a.name, description: a.description })), links: [] });
    break;
  case key === 'apps view': {
    if (!flags.id && !flags.name && !flags.query) fail('provide an application ID, name, or query');
    success('Application fetched successfully!', appView(find(state.apps, 'applications')));
    break;
  }
  case key === 'apps update': {
    find(state.apps, 'applications');
    for (const e of [].concat(flags.edit || [])) if (!/^([a-zA-Z]+(\.[a-zA-Z]+)*)=\s*.*$/.test(e)) fail(`invalid field format: ${e}`);
    say('Updating application...');
    success('Application updated successfully'); break;
  }
  case key === 'apps settings':
    if (unattended) fail('Failed to open application settings!\ncannot open browser in non-interactive mode');
    find(state.apps, 'applications'); // opens the browser; nothing is printed without -v
    break;
  case key === 'apps protocol view': {
    if (flags.protocol && !['oidc', 'saml'].includes(flags.protocol)) fail(`unsupported protocol "${flags.protocol}": supported protocols are oidc, saml`);
    say('Fetching protocol configuration......');
    protocolOut('Protocol configuration fetched successfully', find(state.apps, 'applications'));
    break;
  }
  case key === 'apps protocol update': {
    const a = find(state.apps, 'applications');
    const edits = [].concat(flags.edit || []);
    if (!edits.length) fail('Failed to update the protocol configuration!\nat least one --edit field is required');
    for (const e of edits) {
      const i = e.indexOf('=');
      if (i < 0 || !/^[a-zA-Z]+(\.[a-zA-Z]+)*$/.test(e.slice(0, i))) fail(`Failed to update the protocol configuration!\ninvalid field format: ${e}`);
      const p = e.slice(0, i).split('.'); let v = e.slice(i + 1);
      try { v = JSON.parse(v); } catch { /* string */ }
      let o = a.protocol; let exists = true;
      while (p.length > 1) {
        const k = p.shift();
        if (o[k] !== undefined && (typeof o[k] !== 'object' || Array.isArray(o[k]))) fail(`Failed to update the protocol configuration!\ncannot edit inside "${k}": it is not a nested object`);
        if (o[k] === undefined) { exists = false; o[k] = {}; }
        o = o[k];
      }
      if (!(p[0] in o)) exists = false;
      if (!exists) say(`Note: ${e.slice(0, i)} is not in the current configuration, so it will be added. Check the spelling if you meant to change an existing field.`);
      o[p[0]] = v;
      if (p[0] === 'callbackURLs') a.protocol.allowedOrigins = [...new Set([].concat(v).map(origin).filter(Boolean))];
    }
    save();
    protocolOut(`${flags.protocol || 'oidc'} protocol configuration updated successfully`, a);
    break;
  }
  case key === 'apps apis add': {
    const a = find(state.apps, 'applications');
    missing(['api-id']);
    const api = state.apis.find((x) => x.id === flags['api-id']);
    if (!api) fail(`Failed to authorize the API resource!\nAPI resource not found: ${flags['api-id']}`);
    const scopes = list(flags.scopes);
    const unknown = scopes.filter((s) => !api.scopes.some((x) => x.name === s));
    if (unknown.length) fail(`Failed to authorize the API resource!\nscope(s) not defined on the API resource: ${unknown.join(', ')}`);
    state.authorizations.push({ appId: a.id, apiId: api.id, scopes, policy: flags.policy || 'RBAC' }); save();
    success(`API resource ${api.id} authorized for application ${a.id}`); break;
  }
  case key === 'apps apis list': {
    const a = find(state.apps, 'applications');
    success('Authorized APIs fetched successfully', state.authorizations.filter((x) => x.appId === a.id).map((x) => {
      const api = state.apis.find((y) => y.id === x.apiId) || {};
      return { id: x.apiId, identifier: api.identifier, displayName: api.name, policyId: x.policy, scopes: x.scopes.map((name) => ({ name, displayName: name })) };
    }));
    break;
  }
  case key === 'apps apis remove': {
    const a = find(state.apps, 'applications');
    missing(['api-id']);
    state.authorizations = state.authorizations.filter((x) => !(x.appId === a.id && x.apiId === flags['api-id'])); save();
    success(`API resource ${flags['api-id']} revoked from application ${a.id}`); break;
  }
  case key === 'apps claims': {
    const a = find(state.apps, 'applications');
    const cc = a.claimConfiguration;
    if (!flags.add && !flags.remove) { success('Claim configuration fetched successfully', cc); break; }
    const remove = list(flags.remove);
    const uris = [...new Set([...cc.requestedClaims.map((c) => c.claim.uri), ...list(flags.add)])].filter((u) => !remove.includes(u));
    cc.requestedClaims = uris.map((uri) => ({ claim: { uri } })); save();
    success(`Requested claims updated for application ${a.id}`); break;
  }
  case key === 'apps export': {
    const a = find(state.apps, 'applications');
    if (!flags.file) fail('Failed to export the application configuration!\nan output file is required: pass --file <name>.json');
    if (!String(flags.file).endsWith('.json')) fail('Failed to export the application configuration!\ninvalid file type: only JSON is supported');
    const { clientSecret, ...protocol } = a.protocol;
    fs.writeFileSync(path.resolve(String(flags.file)), dump({ applicationName: a.name, description: a.description, inboundProtocolConfiguration: { oidc: protocol } }));
    success(`Application configuration exported to ${flags.file}`); break;
  }

  // -- users / groups --------------------------------------------------------
  case key === 'users create': {
    missing(['email', 'first-name', 'last-name']);
    if (flags['set-password'] && !flags.password) fail('Failed to create user!\nPassword is required');
    const store = flags['user-store'] || 'DEFAULT';
    const u = { id: uuid(), userName: flags.email, emails: [flags.email], name: { givenName: flags['first-name'], familyName: flags['last-name'] }, userStore: store };
    state.users.push(u); save();
    created(`user created successfully: ${flags.email} (${store})`, u);
    break;
  }
  case key === 'users list':
    deprecated("This command only fetches limited number of API Resources.\nUse 'asg users filter' command instead");
    table(`fetched ${state.users.length} out of ${state.users.length} users (from index: 1)`, ['ID', 'Username', 'Email'],
      state.users.map((u) => [u.id, u.userName, u.emails[0]]), { totalResults: state.users.length, startIndex: 1, itemsPerPage: state.users.length, Resources: state.users });
    break;
  case key === 'users filter':
    filtered('users', ['id', 'userName', 'emails'], state.users.map((u) => [u.id, u.userName, u.emails.join(',')]),
      { totalResults: state.users.length, startIndex: 1, itemsPerPage: state.users.length, Resources: state.users });
    break;
  case key === 'users view':
    success('User fetched successfully!', find(state.users, 'Users', 'userName')); break;
  case key === 'groups create': {
    missing(['name']);
    const g = { id: uuid(), displayName: flags.name, members: [] }; state.groups.push(g); save();
    created('Group created successfully', g); break;
  }
  case key === 'groups list':
    deprecated("This command only fetches limited number of groups.\nUse 'asg groups filter' command instead");
    table(`fetched ${state.groups.length} out of ${state.groups.length} groups (from index: 1)`, ['ID', 'Display Name'],
      state.groups.map((g) => [g.id, g.displayName]), { totalResults: state.groups.length, startIndex: 1, itemsPerPage: state.groups.length, Resources: state.groups });
    break;
  case key === 'groups filter':
    filtered('groups', ['id', 'displayName'], state.groups.map((g) => [g.id, g.displayName]),
      { totalResults: state.groups.length, startIndex: 1, itemsPerPage: state.groups.length, Resources: state.groups });
    break;

  // -- apis ------------------------------------------------------------------
  case key === 'apis create': {
    const type = String(flags.type || 'business').toLowerCase();
    if (!['business', 'mcp'].includes(type)) fail(`invalid API resource type: ${flags.type} (expected one of: business, mcp)`);
    missing(['name', 'description', 'identifier']);
    let scopes = [];
    if (flags.scopes) {
      const raw = String(flags.scopes).startsWith('@') ? fs.readFileSync(String(flags.scopes).slice(1), 'utf8') : flags.scopes;
      try { scopes = JSON.parse(raw); } catch (err) { fail(`handling scope flag: parsing json: ${err.message}`); }
    }
    const api = { id: uuid(), name: flags.name, identifier: flags.identifier, description: flags.description,
      type: type.toUpperCase(), requiresAuthorization: !!flags['require-auth'], scopes: scopes.map((s) => ({ id: uuid(), ...s })) };
    state.apis.push(api); save();
    created(`API Resource created successfully: ${api.name} (${api.identifier})`, api); break;
  }
  case key === 'apis list':
    deprecated("This command only fetches limited number of API Resources.\nUse 'asg apis filter' command instead");
    say('[WARN]: Listing all API Resources\n');
    table(`fetched ${state.apis.length} out of ${state.apis.length} APIs`, ['ID', 'Name', 'Identifier', 'Type'],
      state.apis.map((a) => [a.id, a.name, a.identifier, a.type]),
      { totalResults: state.apis.length, links: [], apiResources: state.apis.map(({ id, name, identifier, type, requiresAuthorization }) => ({ id, name, identifier, type, requiresAuthorization })) });
    break;
  case key === 'apis filter': {
    const q = String(flags.query || '');
    const rows = state.apis.filter((a) => !/type eq/i.test(q) || q.toUpperCase().includes(a.type));
    filtered('APIs', ['ID', 'Name', 'Identifier', 'Type'], rows.map((a) => [a.id, a.name, a.identifier, a.type]),
      { totalResults: rows.length, links: [], apiResources: rows.map(({ id, name, identifier, type, requiresAuthorization }) => ({ id, name, identifier, type, requiresAuthorization })) });
    break;
  }
  case key === 'apis view':
    if (!flags.id && !flags.name && !flags.query) fail('API Resource Name or query is required to filter the APIs');
    success('API details fetched successfully', find(state.apis, 'api-resources')); break;
  case key === 'apis scopes list': {
    if (!flags.id && !flags.name && !flags.query) fail('either API resource id (-i) or name prefix (-n) or query (-q) is required');
    const api = find(state.apis, 'api-resources');
    table(`fetched ${api.scopes.length} API scopes`, ['ID', 'Name', 'Description'], api.scopes.map((s) => [s.id, s.name, s.description]), api.scopes);
    break;
  }

  // -- roles -----------------------------------------------------------------
  case key === 'roles create': {
    missing(['name', 'audience-type']);
    const aud = String(flags['audience-type']).toLowerCase();
    if (!['application', 'organization'].includes(aud)) fail(`invalid audience type: ${flags['audience-type']}. Allowed values are 'Application' or 'Organization'`);
    // The release prompts for an application here even with -N, which hangs an unattended run.
    if (aud === 'application' && !flags['audience-id']) fail('stub: Application audience without --audience-id: the real CLI would stop at an interactive application picker, even with -N');
    const r = { id: uuid(), displayName: flags.name,
      audience: aud === 'application' ? { type: 'application', value: flags['audience-id'] } : { type: 'organization', value: ORG },
      permissions: list(flags['permission-name']).map((value) => ({ value })), users: [], groups: [] };
    state.roles.push(r); save();
    created('Role Created Successfully', r); break;
  }
  case key === 'roles list':
    deprecated("This command only fetches limited number of API Resources.\nUse 'asg roles filter' command instead");
    table(`fetched ${state.roles.length} out of ${state.roles.length} roles`, ['ID', 'Display Name'],
      state.roles.map((r) => [r.id, r.displayName]), { totalResults: state.roles.length, startIndex: 1, itemsPerPage: state.roles.length, Resources: state.roles });
    break;
  case key === 'roles filter':
    filtered('roles', ['id', 'displayName'], state.roles.map((r) => [r.id, r.displayName]),
      { totalResults: state.roles.length, startIndex: 1, itemsPerPage: state.roles.length, Resources: state.roles });
    break;
  case key === 'roles view':
    success('Role details fetched successfully', find(state.roles, 'Roles', 'displayName')); break;
  case key === 'roles users add' || key === 'roles groups add': {
    const r = find(state.roles, 'Roles', 'displayName');
    const kind = verb; // users | groups
    const one = kind === 'users' ? 'user-id' : 'group-id';
    let ids = list(flags[one]);
    if (flags[kind]) { try { ids = ids.concat(JSON.parse(flags[kind]).map((m) => m.value)); } catch { fail(`invalid --${kind} JSON`); } }
    if (!flags[one] && !flags[kind] && unattended) fail(`${kind} data must be provided in non-interactive mode`);
    if (!ids.length) fail(`no ${kind} to add: provide --${one} <id> or --${kind} '[{"value": "<${kind.slice(0, -1)}-id>"}]'`);
    r[kind].push(...ids.map((value) => ({ value }))); save();
    success(`${kind === 'users' ? 'Users' : 'Groups'} added successfully to role ${flags.id ? '' : r.displayName} (id:${r.id})`); break;
  }
  case key === 'roles users list' || key === 'roles groups list': {
    const r = find(state.roles, 'Roles', 'displayName');
    table(`fetched ${r[verb].length} role ${verb}`, verb === 'users' ? ['ID', 'Username'] : ['ID', 'Display Name'], r[verb].map((m) => [m.value, m.display]), r[verb]);
    break;
  }

  // -- agents ----------------------------------------------------------------
  case key === 'agents create': {
    missing(['name']);
    const login = !!flags['allow-user-login'];
    if (flags['copy-password']) fail('Failed to create agent\n--copy-password needs a clipboard and this system has none, which is the usual state of a headless machine. Omit the flag to print the secret, or use --env-file to write it to a file.');
    if (login && !flags['redirect-uri']) fail("Failed to create agent\n--redirect-uri is required with --allow-user-login (the agent's application needs a callback URI)");
    if (login && flags['agent-type'] && !['interactive', 'background'].includes(flags['agent-type'])) fail(`Failed to create agent\ninvalid --agent-type "${flags['agent-type']}": use interactive or background`);
    if (flags['env-file'] === '') fail('--env-file needs a path');
    const id = uuid(); const secret = rand(32);
    const agent = { id, userName: flags.name, description: flags.description || '', allowUserLogin: login, agentType: flags['agent-type'] || 'interactive' };
    state.agents.push(agent);
    const payload = { ...agent, password: secret };
    let clientId;
    if (login) {
      clientId = rand(20);
      state.apps.push({ id, name: flags.name, description: 'Agent application', type: 'oidc', clientId, apiBasedAuth: true,
        protocol: { callbackURLs: list(flags['redirect-uri']), allowedOrigins: [], grantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
          publicClient: false, pkce: { mandatory: false }, accessToken: { type: 'JWT' }, clientSecret: SECRET_PREFIX + rand(32) },
        claimConfiguration: { requestedClaims: [] } });
      say("Configuring the agent's application...");
      Object.assign(payload, { applicationId: id, clientId });
    }
    save();
    say('Important!');
    if (flags['env-file']) {
      const f = path.resolve(String(flags['env-file']));
      let body = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      const set = (k, v) => { body = body.match(new RegExp(`^${k}=.*$`, 'm')) ? body.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : body + (body && !body.endsWith('\n') ? '\n' : '') + `${k}=${v}\n`; };
      set('AGENT_ID', id); set('AGENT_SECRET', secret); if (clientId) set('CLIENT_ID', clientId);
      fs.writeFileSync(f, body, { mode: 0o600 });
      say(`Agent secret written to ${f} (not shown). Keep that file out of version control.`);
      delete payload.password;
    } else {
      say('Make sure to copy your agent secret now as you will not be able to see this again.');
      say(`\tAgent Secret: ${secret}`);
    }
    if (clientId) say(`Application (same ID as the agent) client ID: ${clientId}`);
    created('Agent created successfully', json ? payload : { id, clientId });
    break;
  }
  case key === 'agents list':
    deprecated("This command only fetches a limited number of agents.\nUse 'asg agents filter' instead");
    table(`fetched ${state.agents.length} out of ${state.agents.length} agents (from index: 1)`, ['ID', 'Agent Name', 'Description'],
      state.agents.map((a) => [a.id, a.userName, a.description]), { totalResults: state.agents.length, startIndex: 1, itemsPerPage: state.agents.length, Resources: state.agents });
    break;
  case key === 'agents filter':
    filtered('agents', ['id', 'urn:scim:wso2:agent:schema.DisplayName', 'urn:scim:wso2:agent:schema.Description'],
      state.agents.map((a) => [a.id, a.userName, a.description]), { totalResults: state.agents.length, startIndex: 1, itemsPerPage: state.agents.length, Resources: state.agents });
    break;
  case key === 'agents view':
    success('Agent fetched successfully', find(state.agents, 'Agents', 'userName')); break;

  // -- raw management API ----------------------------------------------------
  case res === 'api': {
    const endpoint = verb;
    if (!endpoint) fail('Please provide an API endpoint to send the request to.');
    const method = String(flags.method || 'GET').toUpperCase();
    if (!['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) fail(`unsupported HTTP method: ${method}`);
    const body = method === 'GET' ? [] : { id: uuid() };
    if (flags.raw) { process.stdout.write(JSON.stringify(body) + '\n'); break; }
    success('Request Success!', { stub: true, method, endpoint, result: body }); break;
  }
  case res === 'tui':
    fail('stub: the TUI needs an interactive terminal');
    break;
  default:
    fail(`unknown command "${key}" for "asg"`);
}

// The object `apps create` reports and `apps view` prints (GET /applications/{id}).
function appView(a) {
  return { id: a.id, name: a.name, description: a.description, clientId: a.clientId, issuer: `${BASE_URL}/oauth2/token`,
    templateId: a.type, advancedConfigurations: { enableAPIBasedAuthentication: a.apiBasedAuth }, claimConfiguration: a.claimConfiguration };
}
