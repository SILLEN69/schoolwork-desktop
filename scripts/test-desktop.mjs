import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

if (process.platform !== "win32")
  throw new Error("This integration test requires Windows.");
const data = await fs.mkdtemp(path.join(os.tmpdir(), "schoolwork-desktop-"));
const fixtureExe = path.join(data, "DesktopFixture.exe");
const framework = path.join(
  process.env.SystemRoot || "C:\\Windows",
  "Microsoft.NET",
  "Framework64",
  "v4.0.30319",
);
const compiled = spawnSync(
  path.join(framework, "csc.exe"),
  [
    "/nologo",
    "/target:exe",
    "/platform:x64",
    "/out:" + fixtureExe,
    "/r:System.Drawing.dll",
    "/r:System.Windows.Forms.dll",
    "/r:System.Web.Extensions.dll",
    path.resolve("native/TestWindow.cs"),
  ],
  { windowsHide: true, stdio: "inherit" },
);
assert.equal(compiled.status, 0);
const fixture = spawn(fixtureExe, [], { windowsHide: false, stdio: "pipe" });
const fixtureLines = [];
createInterface({ input: fixture.stdout }).on("line", (line) =>
  fixtureLines.push(line),
);
async function line() {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    if (fixtureLines.length) return fixtureLines.shift();
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error("Fixture did not respond.");
}
async function state() {
  fixture.stdin.write("state\n");
  return JSON.parse(await line());
}
let app;
const launchedPids = [];
try {
  assert.equal(await line(), "ready");
  app = await electron.launch({
    executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
    args: [path.resolve("scripts/test-app.cjs")],
    env: {
      ...process.env,
      SCHOOLWORK_TEST_DATA: data,
      SCHOOLWORK_TEST_EXE: fixtureExe,
    },
    timeout: 30000,
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForFunction(() => Boolean(window.schoolwork));
  const owner = crypto.randomUUID();
  const png = await app.evaluate(({ nativeImage }) =>
    nativeImage
      .createFromBitmap(Buffer.from([0, 0, 255, 255]), { width: 1, height: 1 })
      .toPNG()
      .toString("base64"),
  );
  const imported = await page.evaluate(
    async ({ owner, png }) =>
      window.schoolwork.importImage({
        conversationId: owner,
        name: "fixture.png",
        base64: png,
      }),
    { owner, png },
  );
  const persisted = await page.evaluate(
    async ({ owner, id }) => {
      await window.schoolwork.send({
        chatId: owner,
        userText: "Explain the physics",
        model: "Test-vision",
        attachmentIds: [id],
      });
      return window.schoolwork.getChat(owner);
    },
    { owner, id: imported.id },
  );
  assert.equal(persisted.messages[0].attachments[0].id, imported.id);
  await page.reload();
  await page
    .getByRole("button", { name: "Explain the physics", exact: true })
    .click();
  await page.locator(".katex-display").waitFor();
  await page.locator(".hljs-keyword").first().waitFor();
  await page.locator(".message-images img").waitFor();
  assert(
    await page
      .locator(".message-images img")
      .evaluate((img) => img.naturalWidth > 0),
  );
  await page.getByRole("button", { name: "Copy code", exact: true }).click();
  assert.match(
    await app.evaluate(({ clipboard }) => clipboard.readText()),
    /math\.sqrt/,
  );
  const out = process.env.SCHOOLWORK_TEST_OUTPUT || data;
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: path.join(out, "SchoolWork-math-code.png") });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(940, 740),
  );
  await page.screenshot({ path: path.join(out, "SchoolWork-narrow.png") });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  assert.equal(overflow, false);
  for (const model of ["Test-vision", "Test-json"]) {
    const desktopOwner = crypto.randomUUID();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].focus(),
    );
    fixture.stdin.write("focus\n");
    assert.equal(await line(), "focused");
    await page.evaluate(
      async ({ owner, model }) =>
        window.schoolwork.send({
          chatId: owner,
          userText: "#desktop-integration",
          model,
        }),
      { owner: desktopOwner, model },
    );
    const until = Date.now() + 30000;
    while (Date.now() < until) {
      const chat = await page.evaluate(
        (owner) => window.schoolwork.getChat(owner),
        desktopOwner,
      );
      if (chat.task?.state === "completed") break;
      if (chat.task?.state === "waiting_retry")
        throw new Error(chat.task.error);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const desktopChat = await page.evaluate(
      (owner) => window.schoolwork.getChat(owner),
      desktopOwner,
    );
    assert.equal(desktopChat.task.state, "completed");
    assert(
      !desktopChat.messages.some(
        (m) => m.role === "tool" && m.content.includes("data:image/"),
      ),
    );
    for (const message of desktopChat.messages.filter(
      (m) => m.role === "tool",
    )) {
      const result = JSON.parse(message.content);
      assert.equal(result.ok, true, message.name + ": " + result.summary);
    }
    assert.match(
      desktopChat.messages.at(-1).content,
      /Actual screenshot pixels received/,
    );
    const observed = await state();
    assert.match(observed.text, /Agent typed: åäö\r?\nSecond line ✓/);
    assert(observed.clicks > 0);
    assert(observed.wheels > 0);
    for (const message of desktopChat.messages.filter(
      (m) => m.name === "inspect_window",
    )) {
      assert(
        !JSON.parse(message.content).data.controls.some(
          (c) => c.name === "Password",
        ),
      );
    }
  }
  async function completed(owner, expected = "completed") {
    const until = Date.now() + 30000;
    while (Date.now() < until) {
      const chat = await page.evaluate(
        (owner) => window.schoolwork.getChat(owner),
        owner,
      );
      if (chat.task?.state === expected) return chat;
      if (chat.task?.state === "waiting_retry" && expected !== "waiting_retry")
        throw new Error(chat.task.error);
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("Task did not reach " + expected);
  }
  const launchOwner = crypto.randomUUID();
  await page.evaluate(
    (owner) =>
      window.schoolwork.send({
        chatId: owner,
        userText: "#launch-integration",
        model: "Test-vision",
      }),
    launchOwner,
  );
  const launchChat = await completed(launchOwner);
  const launched = JSON.parse(
    launchChat.messages.find((m) => m.name === "launch_app").content,
  );
  assert.equal(launched.ok, true);
  launchedPids.push(launched.data.pid);
  process.kill(launched.data.pid, 0);
  const rejectOwner = crypto.randomUUID();
  const rejectedImage = await page.evaluate(
    ({ owner, png }) =>
      window.schoolwork.importImage({
        conversationId: owner,
        name: "reject.png",
        base64: png,
      }),
    { owner: rejectOwner, png },
  );
  await page.evaluate(
    ({ owner, id }) =>
      window.schoolwork.send({
        chatId: owner,
        userText: "Describe image",
        model: "Test-text",
        attachmentIds: [id],
      }),
    { owner: rejectOwner, id: rejectedImage.id },
  );
  const rejected = await completed(rejectOwner, "waiting_retry");
  assert.match(rejected.task.error, /rejected images/);
  const profiles = await page.evaluate(() => window.schoolwork.settingsGet());
  assert.equal(profiles.visionProfiles["Test-text"].status, "unsupported");
  assert.match(
    await page.evaluate(
      ({ owner, id }) =>
        window.schoolwork.readImage({ conversationId: owner, id }),
      { owner: rejectOwner, id: rejectedImage.id },
    ),
    /^data:image\/png/,
  );
  const requests = (
    await fs.readFile(path.join(data, "requests.jsonl"), "utf8")
  )
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
  assert(requests.some((r) => r.hasImages));
  assert(requests.every((r) => !r.internalFields));
  const stopped = await page.evaluate(() => window.schoolwork.stopDesktop());
  console.log(
    "PASS: source app rendering, attachments, native/JSON desktop loops, launching and rejected-image recovery.",
  );
  assert.equal(stopped.controlScreen, false);
  assert.equal(
    fixture.exitCode,
    null,
    "Stopping desktop work must leave user apps running.",
  );
  assert.deepEqual(errors, []);
  // Playwright waits for the Electron process tree on Windows. Retire only the
  // extra disposable fixture we deliberately launched, after proving Stop left it alive.
  for (const pid of launchedPids.splice(0)) {
    process.kill(pid, 0);
    process.kill(pid);
  }
  console.log("Closing source test app.");
  await app.close();
  app = undefined;
  if (process.env.SCHOOLWORK_TEST_PACKAGED === "1") {
    console.log("Starting packaged app with isolated profile.");
    const packageRoot =
      process.env.SCHOOLWORK_PACKAGE_ROOT || path.resolve("release");
    const executable = path.join(packageRoot, "win-unpacked/SchoolWork.exe");
    await fs.access(
      path.join(
        packageRoot,
        "win-unpacked/resources/native/SchoolWork.DesktopBridge.exe",
      ),
    );
    app = await electron.launch({
      executablePath: executable,
      args: ["--user-data-dir=" + data],
      env: { ...process.env },
      timeout: 30000,
    });
    console.log("Packaged process started.");
    const packagedPage = await app.firstWindow();
    const packagedErrors = [];
    packagedPage.on("pageerror", (error) => packagedErrors.push(error.message));
    await packagedPage.waitForFunction(() => Boolean(window.schoolwork));
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
    const profile = await packagedPage.evaluate(() =>
      window.schoolwork.settingsGet(),
    );
    assert.equal(profile.version, "0.4.0");
    assert.equal(profile.workspace, data);
    await packagedPage
      .getByRole("button", { name: "Explain the physics", exact: true })
      .click();
    await packagedPage.locator(".katex-display").waitFor();
    await packagedPage.locator(".message-images img").waitFor();
    assert(
      await packagedPage
        .locator(".message-images img")
        .evaluate((img) => img.naturalWidth > 0),
    );
    await packagedPage.evaluate(
      (cap) =>
        window.schoolwork.setCapabilities({ ...cap, controlScreen: true }),
      profile.capabilities,
    );
    fixture.stdin.write("focus\n");
    assert.equal(await line(), "focused");
    const windows = await packagedPage.evaluate(() =>
      window.schoolwork.desktopWindows(),
    );
    const target = windows.find(
      (w) => w.appId.toLowerCase() === fixtureExe.toLowerCase(),
    );
    assert(target);
    const shot = await packagedPage.evaluate(
      (windowId) =>
        window.schoolwork.captureScreen({
          conversationId: crypto.randomUUID(),
          windowId,
        }),
      target.windowId,
    );
    assert(shot.width > 0);
    await packagedPage.screenshot({
      path: path.join(out, "SchoolWork-packaged.png"),
    });
    await packagedPage.evaluate(() => window.schoolwork.stopDesktop());
    assert.deepEqual(packagedErrors, []);
    await app.close();
    app = undefined;
    console.log(
      "PASS: packaged SchoolWork 0.4.0, restored SQLite/images, bundled KaTeX assets and bundled Windows helper capture.",
    );
  }
  console.log(
    "PASS: real Electron IPC, persisted image input, rendered math/code/copy, narrow layout, native/JSON agent loops, capture/click/Unicode/key/scroll/UI Automation and Stop.",
  );
  console.log("Screenshots: " + out);
} finally {
  await app?.close();
  for (const pid of launchedPids) {
    try {
      process.kill(pid);
    } catch {}
  }
  fixture.stdin.write("close\n");
  await new Promise((r) =>
    fixture.exitCode !== null ? r() : fixture.once("exit", r),
  );
  if (launchedPids.length) await new Promise((r) => setTimeout(r, 500));
  if (process.env.SCHOOLWORK_KEEP_TEST_DATA !== "1")
    await fs.rm(data, { recursive: true, force: true });
}
