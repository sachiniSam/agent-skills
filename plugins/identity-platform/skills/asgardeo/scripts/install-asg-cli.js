#!/usr/bin/env node
// Install the Asgardeo `asg` CLI by building it from source.
//
// The CLI has no released binaries yet, so we clone the repo and `go install` it.
// Idempotent: safe to re-run. Prints one status line at the end.
//
// Steps:
//   1. Verify Go is installed.
//   2. Clone (or reuse) the asgardeo-cli repo.
//   3. `go install .` from cmd/asg — drops the binary in `go env GOBIN` or `$(go env GOPATH)/bin`.
//   4. Ensure that bin directory is on PATH for future shells.
//
// Env overrides:
//   ASG_REPO   git URL to clone (default the wso2-enterprise repo)
//   ASG_SRC    local clone directory (default "$HOME/asgardeo-cli")

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const IS_WIN = process.platform === 'win32';
const REPO = process.env.ASG_REPO || 'https://github.com/wso2-enterprise/asgardeo-cli';
const SRC = process.env.ASG_SRC || path.join(os.homedir(), 'asgardeo-cli');
const BIN_NAME = IS_WIN ? 'asg.exe' : 'asg';

function run(exe, args, opts = {}) {
  return spawnSync(exe, args, { encoding: 'utf8', ...opts });
}

function goEnv(key) {
  const r = run('go', ['env', key]);
  return r.status === 0 ? (r.stdout || '').trim() : '';
}

// Resolve where `go install` will place the binary.
function goBinDir() {
  const gobin = goEnv('GOBIN');
  if (gobin) return gobin;
  const gopath = goEnv('GOPATH') || path.join(os.homedir(), 'go');
  return path.join(gopath, 'bin');
}

function ensureClone() {
  // Treat the directory as the repo if it has the module we build from.
  if (fs.existsSync(path.join(SRC, 'cmd', 'asg'))) {
    // Best-effort refresh; ignore failures (offline, dirty tree, detached HEAD).
    run('git', ['-C', SRC, 'pull', '--ff-only'], { stdio: ['ignore', 'ignore', 'ignore'] });
    return 'reused-existing-clone';
  }
  if (fs.existsSync(SRC) && fs.readdirSync(SRC).length > 0) {
    throw new Error(`${SRC} exists but is not the asgardeo-cli repo. Set ASG_SRC to a different path or remove it, then retry.`);
  }
  const r = run('git', ['clone', REPO, SRC], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (r.status !== 0) {
    throw new Error(`git clone failed. The repo is private — clone it yourself with credentials, then re-run (or set ASG_SRC to an existing clone): git clone ${REPO}`);
  }
  return 'freshly-cloned';
}

function updatePathUnix(binDir) {
  const shell = process.env.SHELL || '';
  const rc = shell.endsWith('/zsh') ? path.join(os.homedir(), '.zshrc') : path.join(os.homedir(), '.bashrc');
  let existing = '';
  try { existing = fs.readFileSync(rc, 'utf8'); } catch { /* missing file is fine */ }
  if (existing.includes(binDir) || (process.env.PATH || '').split(':').includes(binDir)) {
    return 'path-already-configured';
  }
  try {
    fs.appendFileSync(rc, `\nexport PATH="${binDir}:$PATH"\n`);
    return `path-added-to:${rc}`;
  } catch {
    return `path-update-failed:${rc}`;
  }
}

function updatePathWindows(binDir) {
  const ps = (script) => run('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script]);
  const getR = ps(`[Environment]::GetEnvironmentVariable('Path','User')`);
  if (getR.status !== 0) return 'path-update-failed:User-Env';
  const current = (getR.stdout || '').trim();
  if (current.split(';').some((p) => p.toLowerCase() === binDir.toLowerCase())) {
    return 'path-already-configured';
  }
  const sep = current && !current.endsWith(';') ? ';' : '';
  const setR = ps(`[Environment]::SetEnvironmentVariable('Path', ${JSON.stringify(current + sep + binDir)}, 'User')`);
  return setR.status === 0 ? 'path-added-to:User-Env' : 'path-update-failed:User-Env';
}

function main() {
  if (run('go', ['version']).status !== 0) {
    throw new Error('Go is required to build the asg CLI. Install Go from https://go.dev/dl/ and retry.');
  }

  const cloneStatus = ensureClone();

  const moduleDir = path.join(SRC, 'cmd', 'asg');
  const install = run('go', ['install', '.'], { cwd: moduleDir, stdio: ['ignore', 'inherit', 'inherit'] });
  if (install.status !== 0) {
    throw new Error(`'go install .' failed in ${moduleDir}. See the output above.`);
  }

  const binDir = goBinDir();
  const binPath = path.join(binDir, BIN_NAME);
  if (!fs.existsSync(binPath)) {
    throw new Error(`build succeeded but '${BIN_NAME}' was not found in ${binDir} (go env GOBIN/GOPATH).`);
  }

  const pathStatus = IS_WIN ? updatePathWindows(binDir) : updatePathUnix(binDir);
  console.log(`asg installed at ${binPath} (${cloneStatus}; ${pathStatus})`);
}

try {
  main();
} catch (err) {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
}
