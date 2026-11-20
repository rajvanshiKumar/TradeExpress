#!/usr/bin/env node
/**
 * One command to start everything for local development:
 *   node scripts/dev-all.mjs        (or: npm run dev   from the repo root)
 *
 *   listing-api  http://localhost:8000   Product Listing AI backend (embedded PostgreSQL)
 *   assistant    http://localhost:8100   Form Assistant AI service (form-assistant/)
 *   frontend     http://localhost:3000   Next.js app (calls the assistant through /api/assist)
 *
 * Port 3000 busy (e.g. another project)?  FRONTEND_PORT=3100 node scripts/dev-all.mjs
 *
 * Ctrl+C stops all three. The assistant's API key is read from form-assistant/.env and handed to
 * the frontend server process only; it is never written elsewhere or sent to the browser.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";
const venvPython = (dir) => path.join(root, dir, ".venv", win ? "Scripts/python.exe" : "bin/python");
const portArgIdx = process.argv.findIndex((a) => a === "--port" || a === "-p");
const cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : null;
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || cliPort || 3000);
const COLORS = { "listing-api": 36, assistant: 35, frontend: 33 };

function readEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

const assistEnv = readEnvFile(path.join(root, "form-assistant", ".env"));
const preflight = [
  [venvPython("backend"), "backend/.venv is missing. Create it and install backend/requirements.lock.txt (see docs/DEPLOYMENT.md)."],
  [venvPython("form-assistant"), 'form-assistant/.venv is missing. Run: cd form-assistant && python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"'],
  [path.join(root, "frontend", "node_modules"), "frontend/node_modules is missing. Run: cd frontend && npm install"],
];
for (const [p, msg] of preflight) if (!fs.existsSync(p)) fail(msg);
if (!assistEnv.ASSIST_API_KEY) {
  fail("form-assistant/.env needs ASSIST_API_KEY (min 16 chars) and an AI provider. Copy form-assistant/.env.example to form-assistant/.env.");
}

const services = [
  {
    name: "listing-api",
    cwd: path.join(root, "backend"),
    cmd: venvPython("backend"),
    args: ["scripts/run_dev.py"],
    port: 8000,
    ready: "http://localhost:8000/health",
    env: { TX_CORS_ORIGINS: JSON.stringify([`http://localhost:${FRONTEND_PORT}`]) },
  },
  {
    name: "assistant",
    cwd: path.join(root, "form-assistant"),
    cmd: venvPython("form-assistant"),
    args: ["-m", "uvicorn", "app.main:app_factory", "--factory", "--port", "8100"],
    port: 8100,
    ready: "http://localhost:8100/health",
    env: {},
  },
  {
    name: "frontend",
    cwd: path.join(root, "frontend"),
    cmd: "npm",
    args: ["run", "dev", ...(FRONTEND_PORT === 3000 ? [] : ["--", "-p", String(FRONTEND_PORT)])],
    shell: true, // npm is a .cmd shim on Windows
    port: FRONTEND_PORT,
    ready: `http://localhost:${FRONTEND_PORT}`,
    env: { PORT: String(FRONTEND_PORT), ASSIST_URL: "http://localhost:8100", ASSIST_API_KEY: assistEnv.ASSIST_API_KEY },
  },
];

/** True if something already accepts connections on localhost:port (IPv4 or IPv6). */
function inUse(port) {
  const probe = (host) =>
    new Promise((resolve) => {
      const sock = net.connect({ port, host });
      sock.setTimeout(800);
      sock.once("connect", () => (sock.destroy(), resolve(true)));
      sock.once("timeout", () => (sock.destroy(), resolve(false)));
      sock.once("error", () => resolve(false));
    });
  return Promise.all([probe("127.0.0.1"), probe("::1")]).then((r) => r.some(Boolean));
}

async function portFree(port) {
  if (await inUse(port)) return false;
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port); // dual-stack, like the real servers
  });
}

const busy = [];
for (const s of services) if (!(await portFree(s.port))) busy.push(`${s.name} (port ${s.port})`);
if (busy.length) {
  fail(`These ports are already in use: ${busy.join(", ")}.\n  Stop whatever is using them (is a previous run still open?) and try again. Nothing was started.`);
}

const children = [];
let stopping = false;

function prefix(name, chunk) {
  const tag = `\x1b[${COLORS[name]}m[${name}]\x1b[0m `;
  for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) console.log(tag + line);
}

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log("\nStopping all services…");
  for (const c of children) {
    if (c.exitCode !== null || !c.pid) continue;
    if (win) spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else {
      try {
        process.kill(-c.pid, "SIGTERM");
      } catch {
        c.kill("SIGTERM");
      }
    }
  }
  setTimeout(() => process.exit(code), 800);
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

for (const s of services) {
  const child = spawn(s.cmd, s.args, {
    cwd: s.cwd,
    env: { ...process.env, ...s.env },
    shell: !!s.shell,
    detached: !win,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  child.stdout.on("data", (d) => prefix(s.name, d));
  child.stderr.on("data", (d) => prefix(s.name, d));
  child.on("error", (e) => {
    console.error(`[${s.name}] failed to start: ${e.message}`);
    stopAll(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`\n✖ ${s.name} exited unexpectedly (code ${code}). Stopping the rest.`);
      stopAll(1);
    }
  });
}

async function waitReady(s, timeoutMs = 180_000) {
  const t0 = Date.now();
  while (!stopping && Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(s.ready, { signal: AbortSignal.timeout(2000) });
      if (r.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const results = await Promise.all(
  services.map(async (s) => {
    const ok = await waitReady(s);
    if (ok) console.log(`\x1b[32m✔ ${s.name} ready\x1b[0m  ${s.ready}`);
    else if (!stopping) console.error(`\x1b[31m✖ ${s.name} did not become ready in time\x1b[0m`);
    return ok;
  }),
);

if (!stopping && results.every(Boolean)) {
  console.log(`
────────────────────────────────────────────────────────
  Everything is running.

  App (open this)      http://localhost:${FRONTEND_PORT}
  Form Assistant page  http://localhost:${FRONTEND_PORT}/assistant
  Listing API docs     http://localhost:8000/docs
  Assistant API docs   http://localhost:8100/docs

  Press Ctrl+C to stop all services.
────────────────────────────────────────────────────────`);
}
