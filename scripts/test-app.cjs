const { app, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
// Runs the real application/IPC in isolated test data. No personal data or live provider traffic.
const dir = process.env.SCHOOLWORK_TEST_DATA;
if (!dir) throw new Error("Use test:desktop to start the isolated fixture.");
app.setPath("userData", dir);
app.whenReady().then(() => {
  fs.writeFileSync(
    path.join(dir, "schoolwork-settings.json"),
    JSON.stringify({
      encryptedKey: safeStorage
        .encryptString("test-only-not-a-real-credential")
        .toString("base64"),
      workspace: dir,
      model: "Test-vision",
      capabilities: {
        launchApps: true,
        viewScreen: true,
        controlScreen: true,
        allowedApps: [process.env.SCHOOLWORK_TEST_EXE],
      },
    }),
  );
  const realFetch = global.fetch;
  const counts = new Map();
  global.fetch = async (url, init) => {
    if (!String(url).startsWith("https://teachgpt.ssis.nu/api/v1/"))
      return realFetch(url, init);
    if (String(url).endsWith("/models"))
      return Response.json({ data: [{ id: "Test-vision" }] });
    const body = JSON.parse(init.body);
    if (body.model === "Test-json" && body.tools)
      return Response.json(
        { error: { message: "tools unsupported" } },
        { status: 400 },
      );
    const users = body.messages.filter((m) => m.role === "user");
    const hasImages = users.some(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some((p) => p.type === "image_url"),
    );
    fs.appendFileSync(
      path.join(dir, "requests.jsonl"),
      JSON.stringify({
        hasImages,
        parts: users.map((m) =>
          Array.isArray(m.content) ? m.content.map((p) => p.type) : ["text"],
        ),
        internalFields: body.messages.some((m) => "screenObservation" in m),
      }) + "\n",
    );
    if (body.model === "Test-text" && hasImages)
      return Response.json(
        { error: { message: "This model does not support image inputs." } },
        { status: 400 },
      );
    let content =
      String.raw`## Physics, clearly
**Fall time**
\[t=\sqrt{\frac{2h}{g}}=\sqrt{\frac{2\cdot0{,}95}{9{,}82}}\approx0{,}44\,\text{s}\]
**Horizontal speed:** $v=\frac{s}{t}\approx2{,}5\,\text{m/s}$.

| Quantity | Value |
|---|---|
| Height | 0.95 m |
| Speed | 2.5 m/s |

Here is the calculation in code:
` +
      "```python\nimport math\ntime = math.sqrt(2 * 0.95 / 9.82)\nprint(1.10 / time)\n```";
    let toolCalls;
    if (
      users.some(
        (m) =>
          typeof m.content === "string" &&
          m.content.includes("#launch-integration"),
      )
    ) {
      const step = counts.get("launch") || 0;
      counts.set("launch", step + 1);
      if (!step) {
        content = "";
        toolCalls = [
          {
            index: 0,
            id: "launch-fixture",
            type: "function",
            function: {
              name: "launch_app",
              arguments: JSON.stringify({
                appId: process.env.SCHOOLWORK_TEST_EXE,
              }),
            },
          },
        ];
      } else content = "Selected application launched.";
    }
    const desktop = users.some(
      (m) =>
        typeof m.content === "string" &&
        m.content.includes("#desktop-integration"),
    );
    if (desktop) {
      const key =
        body.model +
        users.find(
          (m) =>
            typeof m.content === "string" &&
            m.content.includes("#desktop-integration"),
        ).content;
      const step = counts.get(key) || 0;
      counts.set(key, step + 1);
      const previous = body.messages
        .filter(
          (m) =>
            m.role === "tool" ||
            (typeof m.content === "string" &&
              m.content.startsWith("Tool result: ")),
        )
        .map((m) =>
          JSON.parse(
            m.role === "tool"
              ? m.content
              : m.content.slice("Tool result: ".length),
          ),
        );
      const selected = previous.find(
        (r) => Array.isArray(r.data) && r.data[0]?.windowId,
      )?.data[0];
      const shot = [...previous].reverse().find((r) => r.data?.screenshotId);
      const controls =
        [...previous].reverse().find((r) => r.data?.controls)?.data?.controls ||
        [];
      const point = (name) => {
        const control = controls.find((c) => c.name === name);
        const w = shot?.data?.window;
        return control && w
          ? {
              x: Math.floor(
                ((control.left + control.width / 2 - w.left) *
                  shot.data.width) /
                  w.width,
              ),
              y: Math.floor(
                ((control.top + control.height / 2 - w.top) *
                  shot.data.height) /
                  w.height,
              ),
            }
          : { x: 0, y: 0 };
      };
      const actions = [
        ["list_windows", {}],
        ["focus_window", { windowId: selected?.windowId }],
        ["capture_screen", { windowId: selected?.windowId }],
        [
          "type_text",
          {
            screenshotId: shot?.data?.screenshotId,
            text: "Agent typed: åäö ✓",
          },
        ],
        ["capture_screen", { windowId: selected?.windowId }],
        ["inspect_window", { windowId: selected?.windowId }],
        [
          "click",
          { screenshotId: shot?.data?.screenshotId, ...point("Click test") },
        ],
        ["capture_screen", { windowId: selected?.windowId }],
        [
          "click",
          { screenshotId: shot?.data?.screenshotId, ...point("Editor") },
        ],
        ["capture_screen", { windowId: selected?.windowId }],
        [
          "key_press",
          { screenshotId: shot?.data?.screenshotId, keys: "Ctrl+A" },
        ],
        ["capture_screen", { windowId: selected?.windowId }],
        [
          "type_text",
          {
            screenshotId: shot?.data?.screenshotId,
            text: "Agent typed: åäö\nSecond line ✓",
          },
        ],
        ["capture_screen", { windowId: selected?.windowId }],
        [
          "scroll",
          {
            screenshotId: shot?.data?.screenshotId,
            ...point("Editor"),
            amount: -240,
          },
        ],
        ["inspect_window", { windowId: selected?.windowId }],
      ];
      if (step < actions.length) {
        const [name, args] = actions[step];
        toolCalls = [
          {
            index: 0,
            id: "fixture-" + step,
            type: "function",
            function: { name, arguments: JSON.stringify(args) },
          },
        ];
        content = "";
        if (body.model === "Test-json") {
          content = JSON.stringify({ action: { tool: name, arguments: args } });
          toolCalls = undefined;
        }
      } else
        content =
          "Desktop integration completed. " +
          (hasImages
            ? "Actual screenshot pixels received."
            : "No image received.");
    }
    const delta = { content, ...(toolCalls ? { tool_calls: toolCalls } : {}) };
    return new Response(
      "data: " +
        JSON.stringify({
          choices: [
            { delta, finish_reason: toolCalls ? "tool_calls" : "stop" },
          ],
        }) +
        "\n\ndata: [DONE]\n\n",
      { headers: { "Content-Type": "text/event-stream" } },
    );
  };
  require("../dist-electron/main.js");
});
