import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, type ComponentPropsWithoutRef } from 'react';

function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  const [copied, setCopied] = useState(false);
  return <div className="code-block"><button type="button" onClick={async e => {
    const code = e.currentTarget.parentElement?.querySelector('code')?.textContent || '';
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); }
  }}>{copied ? '✓' : 'Copy'}</button><pre {...props}>{children}</pre></div>;
}
export default function MessageMarkdown({ text }: { text: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    pre: CodeBlock,
    img: ({ alt }) => <span>{alt || 'Image'}</span>,
    a: ({ href, children }) => <a href={href} onClick={e => { e.preventDefault(); if (href && /^https?:\/\//i.test(href)) void window.schoolwork.openUrl(href); }}>{children}</a>,
  }}>{text}</ReactMarkdown></div>;
}
