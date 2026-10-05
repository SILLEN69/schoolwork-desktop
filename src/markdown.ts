import { fromMarkdown } from "mdast-util-from-markdown";

/** Convert model-style LaTeX delimiters, never source code or raw HTML. */
export function normalizeMath(text: string): string {
  const protectedRanges: Array<[number, number]> = [];
  function visit(node: ReturnType<typeof fromMarkdown> | any) {
    if (["code", "inlineCode", "html"].includes(node.type) && node.position) {
      protectedRanges.push([
        node.position.start.offset,
        node.position.end.offset,
      ]);
    } else for (const child of node.children || []) visit(child);
  }
  visit(fromMarkdown(text));
  const normalize = (part: string) =>
    part
      .replace(
        /(?<!\\)\\\[([\s\S]*?)\\\]/g,
        (_match, math: string) => "\n\n$$\n" + math.trim() + "\n$$\n\n",
      )
      .replace(
        /(?<!\\)\\\(([\s\S]*?)\\\)/g,
        (_match, math: string) => "$" + math.trim() + "$",
      );
  let result = "",
    offset = 0;
  for (const [start, end] of protectedRanges.sort((a, b) => a[0] - b[0])) {
    result += normalize(text.slice(offset, start)) + text.slice(start, end);
    offset = end;
  }
  return result + normalize(text.slice(offset));
}
