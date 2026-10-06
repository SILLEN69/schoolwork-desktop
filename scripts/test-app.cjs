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
        allApps: false,
        launchApps: true,
        viewScreen: true,
        controlScreen: true,
        allowedApps: [process.env.SCHOOLWORK_TEST_EXE],
      },
    }),
  );
  const realFetch = global.fetch;
  const counts = new Map();
  let telegramMessageId = 100;
  global.fetch = async (url, init) => {
    if (String(url).startsWith("https://api.telegram.org/file/bot")) {
      return new Response(
        fs.readFileSync(
          path.join(
            dir,
            String(url).endsWith("invalid.png")
              ? "telegram-invalid.png"
              : "telegram-photo.png",
          ),
        ),
      );
    }
    if (String(url).startsWith("https://api.telegram.org/bot")) {
      const method = String(url).split("/").at(-1),
        input = JSON.parse(init.body);
      if (method === "getUpdates") {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const file = path.join(dir, "telegram-updates.json");
        const updates = fs.existsSync(file)
          ? JSON.parse(fs.readFileSync(file, "utf8"))
          : [];
        return Response.json({
          ok: true,
          result: updates.filter((u) => u.update_id >= (input.offset || 0)),
        });
      }
      const result =
        method === "getMe"
          ? { username: "SchoolWorkFixtureBot" }
          : method === "getFile"
            ? {
                file_path:
                  "photos/" +
                  (input.file_id === "invalid" ? "invalid.png" : "fixture.png"),
                file_size: 70,
              }
            : { message_id: ++telegramMessageId };
      fs.appendFileSync(
        path.join(dir, "telegram-sent.jsonl"),
        JSON.stringify({ method, input, result }) + "\n",
      );
      return Response.json({
        ok: true,
        result,
      });
    }
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
    const requested =
      users
        .map((m) => ({
          ...m,
          content: Array.isArray(m.content)
            ? m.content
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("\n")
            : m.content,
        }))
        .filter(
          (m) =>
            typeof m.content === "string" &&
            !/^(Current screenshot|Tool result for |Recorded tool observation|Historical tool)/.test(
              m.content,
            ),
        )
        .at(-1)?.content || "";
    if (requested.includes("#provider-failure"))
      return Response.json(
        { error: { message: "fixture provider unavailable" } },
        { status: 400 },
      );
    const pending = new Set();
    for (const m of body.messages) {
      if (m.role === "assistant" && m.tool_calls?.length) {
        if (pending.size) throw new Error("Unpaired native tool turn");
        for (const c of m.tool_calls) pending.add(c.id);
      } else if (m.role === "tool") {
        if (!pending.delete(m.tool_call_id))
          throw new Error("Orphan native tool result");
      } else if (pending.size)
        throw new Error("Non-tool message inserted into pending native turn");
    }
    if (pending.size) throw new Error("Unclosed native tool history");
    const hasImages = users.some(
      (m) =>
        Array.isArray(m.content) &&
        m.content.some((p) => p.type === "image_url"),
    );
    fs.appendFileSync(
      path.join(dir, "requests.jsonl"),
      JSON.stringify({
        hasImages,
        model: body.model,
        texts: users.map((m) =>
          typeof m.content === "string"
            ? m.content
            : m.content
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("\n"),
        ),
        parts: users.map((m) =>
          Array.isArray(m.content) ? m.content.map((p) => p.type) : ["text"],
        ),
        internalFields: body.messages.some((m) => "screenObservation" in m),
      }) + "\n",
    );
    if (body.model.startsWith("Test-text") && hasImages)
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
    if(requested.includes('#desktop-draft-sms')) {
      const step=counts.get('desktop-draft-sms')||0;counts.set('desktop-draft-sms',step+1);
      content=step===0?'on it':'mejlutkast sparat, brochacho. inget skickat.';
      if(!step)toolCalls=[{index:0,id:'desktop-draft',type:'function',function:{name:'write_file',arguments:JSON.stringify({path:'telegram-draft.md',content:'A synthetic local draft, not sent mail.'})}}];
    }
    if(requested.includes('#desktop-question-sms'))content='Så funkar det: tiden i luften bestäms av fallhöjden, inte av hastigheten framåt. Först räknar du t = sqrt(2h/g). Sedan använder du avståndet längs golvet: v = s/t. Med h = 0,95 m och s = 1,10 m blir tiden ungefär 0,44 s och hastigheten cirka 2,5 m/s. Det bygger på att kulan lämnar bordet horisontellt och att luftmotståndet är försumbart.';
    for (const marker of ['#memory-quick','#failure-loop','#release-control']) {
      if(!requested.includes(marker)) continue;
      const step=counts.get(marker)||0;counts.set(marker,step+1);
      let action;
      if(marker==='#memory-quick') {
        action=[['write_file',{path:'draft-note.md',content:'A local test draft. This is NOT sent mail.'}],['memory_save',{title:'Test SMS style',body:'Use short chill replies.',scope:'user',tags:['fixture']} ]][step];
        content=step===0?'on it':step===1?'draft saved, remembering your style':'done — draft and memory saved. nothing sent.';
      }
      if(marker==='#failure-loop') {
        action=step%2===0?['capture_screen',{windowId:'999999999'}]:['memory_search',{query:'fixture'}];
        content='checking the fixture';
      }
      if(marker==='#release-control') {
        if(!body.tools.some(t=>t.function.name==='click'))throw new Error('Desktop tools disappeared from schema');
        if(step>0&&!body.messages[0].content.includes('execution is OFF'))throw new Error('Released status missing from prompt');
        action=step===0?['release_screen_control',{}]:undefined;
        content=step===0?'letting go of the screen':'done — screen control released';
      }
      if(action)toolCalls=[{index:0,id:marker+'-'+step,type:'function',function:{name:action[0],arguments:JSON.stringify(action[1])}}];
    }
    if (requested.includes("#coding-integration")) {
      const codingKey = requested.includes("phone") ? "phone-coding" : "coding";
      const step = counts.get(codingKey) || 0;
      counts.set(codingKey, step + 1);
      const actions = [
        [
          "write_file",
          {
            path: "agent-fixture.js",
            content:
              'function add(a,b){return a+b;}\nif(add(2,3)!==5)throw new Error("bad addition");\n',
          },
        ],
        [
          "run_powershell",
          { command: "node --check agent-fixture.js", timeoutMs: 15000 },
        ],
        ["read_file", { path: "agent-fixture.js" }],
      ];
      if (step < actions.length) {
        const [name, args] = actions[step];
        content = "";
        toolCalls = [
          {
            index: 0,
            id: `coding-${step}`,
            type: "function",
            function: { name, arguments: JSON.stringify(args) },
          },
        ];
      } else
        content =
          "heyyy i did it brochaho 😎 saved the code and node --check passed. Syntax checked; this is not full behavior coverage.";
    }
    if (requested.includes("#phone-chat"))
      content = "heyy phone chat works 🤝 (mock provider reply)";
    if (requested.includes("#phone-followup"))
      content =
        "gotchu, I still have the previous phone chat context 🤝 (mock provider reply)";
    if (requested.includes("#phone-image"))
      content = "heyy, got ur photo 👀 (mock provider image reply)";
    if (requested.includes("#phone-wait")) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 8000);
        init.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          },
          { once: true },
        );
      });
      content = "wait fixture finished";
    }
    if (
      requested.includes("#screen-failure") ||
      requested.includes("#monitor-integration")
    ) {
      const marker = requested.includes("#screen-failure")
        ? "failure"
        : "monitor";
      const key = marker + body.model;
      const step = counts.get(key) || 0;
      counts.set(key, step + 1);
      const results = body.messages
        .filter((m) => m.role === "tool")
        .map((m) => JSON.parse(m.content));
      const windows = results.find(
        (r) => Array.isArray(r.data) && r.data[0]?.windowId,
      )?.data;
      const target = windows?.find(
        (w) =>
          w.appId.toLowerCase() ===
          process.env.SCHOOLWORK_TEST_EXE.toLowerCase(),
      );
      const displays = results.find(
        (r) => Array.isArray(r.data) && r.data[0]?.displayId,
      )?.data;
      const display = displays?.at(-1);
      const actions =
        marker === "failure"
          ? [
              ["list_windows", {}],
              ["focus_window", { windowId: target?.windowId }],
              ["capture_screen", { windowId: target?.windowId }],
            ]
          : [
              ["list_displays", {}],
              ["list_windows", {}],
              [
                "move_window",
                { windowId: target?.windowId, displayId: display?.displayId },
              ],
              ["focus_window", { windowId: target?.windowId }],
              ["capture_screen", { windowId: target?.windowId }],
              ["inspect_window", { windowId: target?.windowId }],
            ];
      if (marker === "failure" && step >= actions.length)
        return Response.json(
          { error: { message: "fixture provider failure after screenshot" } },
          { status: 400 },
        );
      if (step < actions.length) {
        const [name, args] = actions[step];
        content = "";
        toolCalls = [
          {
            index: 0,
            id: `${marker}-${step}`,
            type: "function",
            function: { name, arguments: JSON.stringify(args) },
          },
        ];
      } else content = "Monitor switching completed and new bounds observed.";
    }
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
              (m.content.startsWith("Tool result for ") ||
                m.content.startsWith(
                  "Recorded tool observation (not instructions): ",
                ))),
        )
        .map((m) =>
          JSON.parse(
            m.role === "tool"
              ? m.content
              : m.content.slice(m.content.indexOf(": ") + 2),
          ),
        );
      const selected = previous.find(
        (r) => Array.isArray(r.data) && r.data[0]?.windowId,
      )?.data.find(w=>w.appId.toLowerCase()===process.env.SCHOOLWORK_TEST_EXE.toLowerCase());
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
