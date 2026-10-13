#!/usr/bin/env node
/**
 * alpha-verify-desktop.mjs — best-effort live desktop verification via Codex computer use.
 *
 * A second agent (Codex CLI, GPT-6.1-Sol high, computer-use plugin) visually verifies the
 * SchoolWork dev app on the desktop. This is OPTIONAL evidence for a cycle: any failure here
 * (missing binary, auth/quota error, timeout, inconclusive verdict) degrades to "skipped" and
 * must never break the development loop.
 *
 * Usage (from the worktree root):
 *   node scripts/alpha-verify-desktop.mjs --scenario "open SchoolWork dev app, type 'x' in the sidebar search, confirm the list filters"
 *
 * Output: one JSON object on stdout:
 *   { used: true,  verdict: "PASS"|"FAIL"|"INCONCLUSIVE", evidence: [...], durationMs }
 *   { used: false, reason: "<why skipped>" }
 * Exit code is always 0 so callers can chain it safely.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const WORKTREE = process.cwd();
const ALPHA_GOAL = process.env.ALPHA_GOAL_DIR ||
  "C:/Users/elias/Documents/Codex/2026-10-12/go-into-my-schoolwork-github-repository/work/alpha-goal";
const STATE = path.join(ALPHA_GOAL, "state");
const LOGS = path.join(ALPHA_GOAL, "logs");
const CODEX_BIN = process.env.ALPHA_CU_CODEX || "";
const TIMEOUT_MIN = Math.max(5, Number(process.env.ALPHA_CU_TIMEOUT_MIN || 15));
const PER_RUN_CAP = 8;   // hard cap per controller run
const HOURLY_CAP = 3;    // quota protection
const MODEL = "gpt-6.1-sol";

function out(obj) { console.log(JSON.stringify(obj)); process.exit(0); }
function logLine(line) {
  try {
    fs.mkdirSync(LOGS, { recursive: true });
    fs.appendFileSync(path.join(LOGS, "cu-verify.log"), `[${new Date().toISOString()}] ${line}\n`);
  } catch {}
}

function findCodex() {
  if (CODEX_BIN && fs.existsSync(CODEX_BIN)) return CODEX_BIN;
  const where = spawnSync("where.exe", ["codex"], { encoding: "utf8", windowsHide: true });
  const first = (where.stdout || "").split(/\r?\n/).map(s => s.trim()).find(p => p && /codex(\.exe|\.cmd|\.ps1)$/.test(p));
  if (first && fs.existsSync(first)) return first;
  const binRoot = "C:/Users/elias/AppData/Local/OpenAI/Codex/bin";
  try {
    const dirs = fs.readdirSync(binRoot).map(d => ({ d, mt: fs.statSync(path.join(binRoot, d)).mtimeMs }))
      .sort((a, b) => b.mt - a.mt);
    for (const { d } of dirs) {
      const p = path.join(binRoot, d, "codex.exe");
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  return null;
}

function parseArgs(argv) {
  const args = { scenario: "", extra: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--scenario") args.scenario = (argv[++i] || "").trim();
    else if (!argv[i].startsWith("--")) args.scenario = (args.scenario ? args.scenario + " " : "") + argv[i];
  }
  return args;
}

const { scenario } = parseArgs(process.argv.slice(2));
if (!scenario) { logLine("skipped: no --scenario"); out({ used: false, reason: "no --scenario given" }); }

// ---- throttle (durable state; keeps quota and time bounded overnight)
fs.mkdirSync(STATE, { recursive: true });
const usageFile = path.join(STATE, "cu-usage.json");
let usage = {};
try { usage = JSON.parse(fs.readFileSync(usageFile, "utf8")); } catch {}
const runKey = process.env.ALPHA_GOAL_RUN_KEY || "default";
if (usage.runKey !== runKey) usage = { runKey, startedAt: Date.now(), calls: 0, hourly: [] };
const nowMs = Date.now();
usage.hourly = (usage.hourly || []).filter(t => nowMs - t < 3600 * 1000);
if (usage.calls >= PER_RUN_CAP) { logLine(`skipped: per-run cap ${PER_RUN_CAP} reached`); out({ used: false, reason: `per-run cap (${PER_RUN_CAP}) reached` }); }
if (usage.hourly.length >= HOURLY_CAP) { logLine("skipped: hourly cap reached"); out({ used: false, reason: `hourly cap (${HOURLY_CAP}) reached` }); }

const codex = findCodex();
if (!codex) { logLine("skipped: codex binary not found"); out({ used: false, reason: "codex binary not found" }); }

const tmpDir = path.join(WORKTREE, "temp", "alpha-verify");
fs.mkdirSync(tmpDir, { recursive: true });
const lastMsgFile = path.join(tmpDir, `last-${Date.now()}.txt`);
const jsonlFile = path.join(tmpDir, `events-${Date.now()}.jsonl`);

const prompt = `You are a desktop UI verification agent for the SchoolWork Electron app (a local dev build).
You have computer use: you can see the desktop and operate the SchoolWork dev app window.

SCENARIO TO VERIFY:
${scenario}

HARD RULES
- Only interact with the SchoolWork dev app window (its title contains "SchoolWork"). Never touch other apps, files, or system settings.
- Do not modify source files, run builds, or use git. You may click, type, and scroll inside the app.
- Keep actions minimal and reversible. Do not delete data, do not change credential/model settings, do not send messages to external services.
- If the SchoolWork window is not visible, do not try to start anything: report INCONCLUSIVE with reason "app window not visible".
- If you hit a wall (UI mismatch, permissions, quota), stop and report INCONCLUSIVE with the exact reason. Do not loop.

Finish with EXACTLY this block as the end of your final message:
VERDICT: PASS | FAIL | INCONCLUSIVE
EVIDENCE:
- <1-5 short lines: what you did and what you observed>`;

logLine(`starting codex computer-use verify (model=${MODEL}, timeout=${TIMEOUT_MIN}m)`);
const started = Date.now();
const child = spawn(codex, [
  "exec",
  "-m", MODEL,
  "-s", "workspace-write",
  "-C", WORKTREE,
  "--skip-git-repo-check",
  "-o", lastMsgFile,
  "--json",
  prompt,
], { cwd: WORKTREE, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
// stdin is 'ignore': codex must never wait for piped input.

let jsonl = "";
child.stdout.on("data", (d) => { jsonl += d.toString("utf8"); fs.appendFileSync(jsonlFile, d); });
child.stderr.on("data", (d) => { try { fs.appendFileSync(jsonlFile, d); } catch {} });

let timedOut = false;
const timer = setTimeout(() => { timedOut = true; try { child.kill("SIGTERM"); } catch {} }, TIMEOUT_MIN * 60 * 1000);

child.on("close", (code) => {
  clearTimeout(timer);
  const durationMs = Date.now() - started;
  // Update usage regardless of outcome (a started call counts).
  usage.calls += 1; usage.hourly.push(nowMs);
  try { fs.writeFileSync(usageFile, JSON.stringify(usage, null, 2)); } catch {}

  const tail = (jsonl || "").slice(-6000);
  if (timedOut) { logLine(`timeout after ${TIMEOUT_MIN}m (calls=${usage.calls})`); out({ used: false, reason: `codex computer-use timed out after ${TIMEOUT_MIN} min` }); }
  if (code !== 0) {
    const sig = /(quota|rate.?limit|usage limit|429|503|billing|unauthorized|authentication|login)/i.test(tail)
      ? "provider/quota or auth error" : `exit ${code}`;
    logLine(`failed: ${sig}`);
    out({ used: false, reason: `codex exec ${sig}` });
  }
  let last = "";
  try { last = fs.readFileSync(lastMsgFile, "utf8"); } catch {}
  const vm = last.match(/VERDICT:\s*(PASS|FAIL|INCONCLUSIVE)/i);
  if (!vm) {
    logLine(`no verdict (last msg ${last.length} chars); tail: ${tail.slice(-300).replace(/\n/g, " | ")}`);
    out({ used: false, reason: "codex finished but produced no VERDICT block" });
  }
  const evm = last.match(/EVIDENCE:\r?\n((?:- .*\r?\n?)*)/);
  const evidence = evm ? evm[1].split(/\r?\n/).map(s => s.replace(/^- /, "").trim()).filter(Boolean) : [];
  const verdict = vm[1].toUpperCase();
  logLine(`verdict=${verdict} in ${Math.round(durationMs / 1000)}s (calls=${usage.calls})`);
  out({ used: true, verdict, evidence, durationMs });
});
child.on("error", (e) => {
  clearTimeout(timer);
  logLine(`spawn error: ${e.message}`);
  out({ used: false, reason: "codex spawn error: " + e.message });
});
