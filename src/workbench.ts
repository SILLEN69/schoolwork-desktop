export type WorkbenchEntry = { name: string; path: string; type: "dir" | "file"; size: number };
export type RecentFile = { path: string; name: string };

/** highlight.js language for a file name, or null for plain-text preview. */
export function languageForPath(name: string): string | null {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : "";
  const byName: Record<string, string> = {
    "dockerfile": "dockerfile",
    "makefile": "makefile",
  };
  if (byName[name.toLowerCase()]) return byName[name.toLowerCase()];
  const byExt: Record<string, string> = {
    ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    json: "json", jsonc: "json",
    css: "css", scss: "scss", less: "less",
    html: "xml", htm: "xml", xml: "xml", svg: "xml", vue: "xml",
    py: "python", rb: "ruby", rs: "rust", go: "go", java: "java",
    c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp", cs: "csharp",
    sh: "shell", bash: "shell", zsh: "shell", ps1: "shell",
    sql: "sql", md: "markdown", markdown: "markdown",
    yml: "yaml", yaml: "yaml", ini: "ini", toml: "ini",
    diff: "diff", patch: "diff",
  };
  return byExt[ext] || null;
}

/**
 * Case-insensitive substring filter over a flat tree. A file stays when its
 * relative path matches; a directory stays when it matches or when a
 * descendant stays. An empty query keeps everything.
 */
export function filterWorkbenchTree(entries: WorkbenchEntry[], query: string): Set<string> {
  const needle = query.trim().toLowerCase();
  if (!needle) return new Set(entries.map(e => e.path));
  const kept = new Set<string>();
  for (const entry of entries) {
    if (!entry.path.toLowerCase().includes(needle)) continue;
    kept.add(entry.path);
    let parent = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
    while (parent) {
      kept.add(parent);
      parent = parent.includes("/") ? parent.slice(0, parent.lastIndexOf("/")) : "";
    }
  }
  return kept;
}

/** Human-readable file size for the preview header and notices. */
export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}

export function isMarkdownName(name: string): boolean {
  return /\.(md|markdown|mdx)$/i.test(name);
}
