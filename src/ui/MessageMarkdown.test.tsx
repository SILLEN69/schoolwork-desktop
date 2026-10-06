import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MessageMarkdown from "./MessageMarkdown";
import { normalizeMath } from "../markdown";

describe("message rendering", () => {
  it("renders the screenshot physics example and common LaTeX delimiters", () => {
    const html = renderToStaticMarkup(
      <MessageMarkdown
        text={String.raw`**Vertikalt:** $$h = \frac{1}{2}gt^2 \quad \Rightarrow \quad t = \sqrt{\frac{2h}{g}}$$

\[v = \frac{s}{t} \approx 2{,}5\,\text{m/s}\]

Inline \(x^2\) and $y^2$.`}
      />,
    );
    expect(html).toContain("katex-display");
    expect(html.match(/class="katex"/g)).toHaveLength(4);
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-error");
  });
  it("preserves literal math delimiters in fenced and inline source code", () => {
    const code = '```js\nconst value = "\\(x\\)";\n```\n\n`\\[formula\\]`';
    expect(normalizeMath(code)).toBe(code);
    const html = renderToStaticMarkup(<MessageMarkdown text={code} />);
    expect(html).toContain("hljs-keyword");
    expect(html).toContain("code-header");
    expect(html).not.toContain('class="katex"');
  });
  it("renders tables, links and lists without running raw HTML or trusted TeX commands", () => {
    const html = renderToStaticMarkup(
      <MessageMarkdown
        text={
          "| A | B |\n|---|---|\n| one | two |\n\n1. First\n2. Second\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))\n\n$\\href{javascript:alert(1)}{click}$"
        }
      />,
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<ol>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain('href="javascript:');
  });
  it("shows invalid math as a recoverable error and keeps surrounding content", () => {
    const html = renderToStaticMarkup(
      <MessageMarkdown text={"Before\n\n$\\frac{$\n\nAfter"} />,
    );
    expect(html).toContain("Before");
    expect(html).toContain("After");
    expect(html).toContain("katex-error");
  });
});
