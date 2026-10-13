import { it, expect } from "vitest";
import { filterWorkbenchTree, languageForPath, formatBytes, isMarkdownName, type WorkbenchEntry } from "./workbench";

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
