import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { Check, Copy } from "lucide-react";
import { normalizeMath } from "../markdown";
import "katex/dist/katex.min.css";

function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const [feedback, setFeedback] = useState("");
  const pre = useRef<HTMLPreElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [language, setLanguage] = useState("code");
  useEffect(() => {
    setLanguage(
      pre.current
        ?.querySelector("code")
        ?.className.match(/language-([\w+-]+)/)?.[1] || "code",
    );
    return () => clearTimeout(timer.current);
  }, [children]);
  const copy = async () => {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(pre.current?.textContent || "");
      setFeedback("Copied");
    } catch {
      setFeedback("Copy failed");
    }
    timer.current = setTimeout(() => setFeedback(""), 2000);
  };
  return (
    <div className="code-block">
      <div className="code-header">
        <span>{language}</span>
        <button type="button" onClick={copy} aria-label="Copy code">
          {feedback === "Copied" ? <Check size={14} /> : <Copy size={14} />}
          <span aria-live="polite">{feedback || "Copy"}</span>
        </button>
      </div>
      <pre ref={pre} {...props}>
        {children}
      </pre>
    </div>
  );
}
export default function MessageMarkdown({ text }: { text: string }) {
  const normalized = useMemo(() => normalizeMath(text), [text]);
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { trust: false, strict: "ignore", maxExpand: 1000 }],
          [rehypeHighlight, { detect: false }],
        ]}
        skipHtml
        components={{
          pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
          img: ({ alt }) => <span>{alt || "Image"}</span>,
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault();
                if (href && /^https?:\/\//i.test(href))
                  void window.schoolwork.openUrl(href);
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
