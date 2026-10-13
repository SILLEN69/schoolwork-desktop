import { it, expect } from "vitest";
import {
  filterWorkbenchTree,
  languageForPath,
  formatBytes,
  isMarkdownName,
  interpreterForName,
  isRunnableName,
  runCommandLabel,
  appendRunOutputStream,
  createRunOutputStream,
  runOutputStreamText,
  buildExplainFileRequest,
  EXPLAIN_CONTEXT_MAX,
  MAX_RUN_OUTPUT_BYTES,
  RUN_HEAD_BYTES,
  RUN_TAIL_BYTES,
  type WorkbenchEntry,
} from "./workbench";

const entries: WorkbenchEntry[] = [
  { name: "docs", path: "docs", type: "dir", size: 0 },
  { name: "guide.md", path: "docs/guide.md", type: "file", size: 10 },
  { name: "src", path: "src", type: "dir", size: 0 },
  { name: "net", path: "src/net", type: "dir", size: 0 },
  { name: "client.ts", path: "src/net/client.ts", type: "file", size: 20 },
  { name: "app.ts", path: "src/app.ts", type: "file", size: 30 },
  { name: "README.md", path: "README.md", type: "file", size: 5 },
  { name: "package.json", path: "package.json", type: "file", size: 40 },
];

it("keeps everything for an empty or blank query", () => {
  expect([...filterWorkbenchTree(entries, "")]).toHaveLength(entries.length);
  expect([...filterWorkbenchTree(entries, "   ")]).toHaveLength(entries.length);
});

it("matches files case-insensitively and keeps their ancestor folders", () => {
  const kept = filterWorkbenchTree(entries, "CLIENT");
  expect(kept.has("src/net/client.ts")).toBe(true);
  expect(kept.has("src/net")).toBe(true);
  expect(kept.has("src")).toBe(true);
  expect(kept.has("src/app.ts")).toBe(false);
  expect(kept.has("README.md")).toBe(false);
});

it("shows folders whose own name matches, without their unmatched children", () => {
  const kept = filterWorkbenchTree(entries, "docs");
  expect(kept.has("docs")).toBe(true);
  expect(kept.has("docs/guide.md")).toBe(true);
  expect(kept.has("src")).toBe(false);
});

it("matches anywhere in the relative path, not only the file name", () => {
  const kept = filterWorkbenchTree(entries, "src/app");
  expect(kept.has("src/app.ts")).toBe(true);
  expect(kept.has("src")).toBe(true);
  expect(kept.has("package.json")).toBe(false);
});

it("maps extensions to highlight.js languages", () => {
  expect(languageForPath("app.ts")).toBe("typescript");
  expect(languageForPath("App.TSX")).toBe("typescript");
  expect(languageForPath("index.js")).toBe("javascript");
  expect(languageForPath("style.css")).toBe("css");
  expect(languageForPath("page.html")).toBe("xml");
  expect(languageForPath("main.py")).toBe("python");
  expect(languageForPath("Makefile")).toBe("makefile");
  expect(languageForPath("data.csv")).toBe(null);
  expect(languageForPath("noextension")).toBe(null);
});

it("formats byte sizes in the app's plain style", () => {
  expect(formatBytes(512)).toBe("512 B");
  expect(formatBytes(2048)).toBe("2 KB");
  expect(formatBytes(1_536_000)).toBe("1.5 MB");
  expect(formatBytes(5_242_880)).toBe("5 MB");
});

it("recognises markdown names", () => {
  expect(isMarkdownName("README.md")).toBe(true);
  expect(isMarkdownName("guide.Markdown")).toBe(true);
  expect(isMarkdownName("notes.mdx")).toBe(true);
  expect(isMarkdownName("notes.txt")).toBe(false);
});

it("picks the sensible interpreter per extension and platform", () => {
  expect(interpreterForName("hello.mjs")?.kind).toBe("node");
  expect(interpreterForName("index.js")?.kind).toBe("node");
  expect(interpreterForName("tool.cjs")?.kind).toBe("node");
  expect(interpreterForName("HELLO.MJS")?.kind).toBe("node");
  expect(interpreterForName("script.py")?.kind).toBe("python");
  expect(interpreterForName("run.sh")?.kind).toBe("bash");
  expect(interpreterForName("build.bat", "win32")?.kind).toBe("cmd");
  expect(interpreterForName("build.cmd", "win32")?.kind).toBe("cmd");
  expect(interpreterForName("setup.ps1", "win32")?.kind).toBe("powershell");
  // Windows-only shells do not exist on Linux.
  expect(interpreterForName("build.bat", "linux")).toBe(null);
  expect(interpreterForName("setup.ps1", "linux")).toBe(null);
  expect(interpreterForName("notes.txt")).toBe(null);
  expect(interpreterForName("README.md")).toBe(null);
  expect(interpreterForName("noextension")).toBe(null);
  expect(interpreterForName("archive.tar.gz")).toBe(null);
  expect(isRunnableName("a.mjs")).toBe(true);
  expect(isRunnableName("b.log")).toBe(false);
});

it("builds the interpreter argument list and display label", () => {
  const node = interpreterForName("a.mjs")!;
  expect(node.fileArgs("src/a.mjs")).toEqual(["src/a.mjs"]);
  expect(interpreterForName("x.bat", "win32")!.fileArgs("x.bat")).toEqual(["/d", "/s", "/c", "x.bat"]);
  expect(interpreterForName("x.ps1", "win32")!.fileArgs("x.ps1")).toEqual([
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", "x.ps1",
  ]);
  expect(runCommandLabel("a.mjs", "src/a.mjs")).toBe("node src/a.mjs");
  expect(runCommandLabel("script.py", "script.py")).toBe("python script.py");
  expect(runCommandLabel("x.bat", "x.bat", "win32")).toBe("x.bat  (cmd)");
  expect(runCommandLabel("x.ps1", "x.ps1", "win32")).toBe("x.ps1  (PowerShell)");
});

it("keeps output below the cap with the head and tail intact", () => {
  const stream = createRunOutputStream();
  const small = Buffer.from("hello\n");
  const first = appendRunOutputStream(stream, small);
  expect(first.pieces).toHaveLength(1);
  expect(first.pieces[0].complete).toBe(true);
  expect(stream.truncated).toBe(false);
  expect(runOutputStreamText(stream)).toBe("hello\n");

  const big = createRunOutputStream();
  const head = Buffer.from("H".repeat(40_000));
  const middle = Buffer.from("M".repeat(200_000));
  const tail = Buffer.from("T".repeat(30_000));
  const seen: string[] = [];
  for (const chunk of [head, middle, tail]) {
    const { pieces } = appendRunOutputStream(big, chunk);
    for (const piece of pieces) expect(piece.data.length).toBeLessThanOrEqual(chunk.length);
    seen.push(pieces.map(p => (p.complete ? "c" : "p")).join("+"));
  }
  expect(big.truncated).toBe(true);
  expect(big.head.length).toBe(RUN_HEAD_BYTES);
  expect(big.tail.length).toBe(RUN_TAIL_BYTES);
  const omitted = 270_000 - big.head.length - big.tail.length;
  expect(omitted).toBeGreaterThan(0);
  const marker = "[ ... " + omitted + " bytes omitted ... ]";
  // The result is exactly head + marker + tail, nothing duplicated or lost at the seams.
  expect(runOutputStreamText(big)).toBe(big.head.toString("utf8") + "\n" + marker + "\n" + big.tail.toString("utf8"));
  expect(big.head.toString("utf8")).toBe("H".repeat(40_000) + "M".repeat(RUN_HEAD_BYTES - 40_000));
  expect(big.tail.toString("utf8")).toBe("M".repeat(RUN_TAIL_BYTES - 30_000) + "T".repeat(30_000));
  // Chunk 2 split across the frozen head and the rolling tail; chunk 3 fits the tail ring whole.
  expect(seen).toEqual(["c", "p+p", "c"]);
});

it("never exceeds the cap and never emits replacement characters at cut edges", () => {
  const stream = createRunOutputStream();
  // A 3-byte UTF-8 character (€) repeated so the caps cut inside characters.
  const unit = Buffer.from("€", "utf8");
  expect(unit.length).toBe(3);
  const chunk = Buffer.concat(Array.from({ length: 30_000 }, () => unit));
  for (let i = 0; i < 10; i++) appendRunOutputStream(stream, chunk);
  expect(stream.truncated).toBe(true);
  expect(stream.total).toBe(900_000);
  const text = runOutputStreamText(stream);
  expect(text.length).toBeLessThanOrEqual(MAX_RUN_OUTPUT_BYTES + 64);
  expect(text).not.toContain("\uFFFD");
  expect(text).toContain("€");
});

it("quotes the file or selection as untrusted data in the explain request", () => {
  const content = "export const answer = 42;\n// ``` a tricky fence\nconsole.log(answer);\n";
  const request = buildExplainFileRequest({
    path: "src/app.ts",
    name: "app.ts",
    language: "en",
    content,
  });
  expect(request).toContain("`src/app.ts`");
  expect(request).toContain("export const answer = 42;");
  expect(request).toContain("untrusted");
  expect(request).toContain("typescript");
  // The content holds a ``` fence, so the wrapper must be longer.
  expect(request).toContain("````typescript");
  expect(request).not.toContain("truncated");

  const selection = buildExplainFileRequest({
    path: "src/app.ts",
    name: "app.ts",
    language: "en",
    selection: "export const answer = 42;",
    content,
  });
  expect(selection).toContain("this selection");
  expect(selection).toContain("export const answer = 42;");
  expect(selection).not.toContain("console.log(answer)");
});

it("localises the explain request and truncates oversized files", () => {
  const sv = buildExplainFileRequest({
    path: "src/app.ts",
    name: "app.ts",
    language: "sv",
    content: "a",
  });
  expect(sv).toContain("Förklara filen");
  expect(sv).toContain("obetrodd text");

  const huge = "x".repeat(EXPLAIN_CONTEXT_MAX + 500);
  const truncated = buildExplainFileRequest({ path: "big.log", name: "big.log", language: "en", content: huge });
  expect(truncated).toContain("truncated");
  expect(truncated).toContain(String(EXPLAIN_CONTEXT_MAX));
  expect(truncated.length).toBeLessThan(huge.length);
});
