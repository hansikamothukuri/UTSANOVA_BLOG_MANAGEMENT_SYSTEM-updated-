import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

/**
 * MarkdownRenderer
 * ----------------
 * Safely renders Markdown content as formatted HTML.
 *
 * Pipeline:
 *   remark-gfm     -> parses GitHub-Flavored Markdown (tables, strikethrough, task lists, autolinks)
 *   rehype-sanitize -> strips dangerous HTML / JavaScript / XSS payloads before rendering
 *
 * No raw HTML, scripts, event handlers, or iframes survive the sanitize step.
 */
const MarkdownRenderer = ({ content = '', className = '' }) => {
  return (
    <div className={`prose prose-slate max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-8 mb-4" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-2xl font-bold text-slate-900 mt-6 mb-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-xl font-bold text-slate-800 mt-5 mb-2" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="text-slate-800 text-base sm:text-lg leading-relaxed my-4" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside text-slate-800 my-4 space-y-1.5 pl-2" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside text-slate-800 my-4 space-y-1.5 pl-2" {...props} />
          ),
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          a: ({ node, ...props }) => (
            <a
              className="text-indigo-600 hover:text-indigo-700 font-medium underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-indigo-300 bg-indigo-50/50 pl-4 py-2 my-4 text-slate-700 italic rounded-r-lg"
              {...props}
            />
          ),
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code
                className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              />
            ) : (
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto my-4 text-sm font-mono">
                <code {...props} />
              </pre>
            ),
          pre: ({ node, ...props }) => <pre className="my-4" {...props} />,
          strong: ({ node, ...props }) => (
            <strong className="font-bold text-slate-900" {...props} />
          ),
          em: ({ node, ...props }) => <em className="italic text-slate-800" {...props} />,
          hr: ({ node, ...props }) => (
            <hr className="border-slate-200 my-6" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse border border-slate-200" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border border-slate-200 px-4 py-2 bg-slate-50 font-bold text-slate-900 text-left" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-slate-200 px-4 py-2 text-slate-800" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
