import React from "react";

/**
 * A small Markdown renderer for task descriptions.
 *
 * Safe by construction: it parses to a tree and renders React elements. Text is only ever passed to React
 * as text (which escapes it), HTML in the source is shown literally, nothing uses dangerouslySetInnerHTML,
 * and links are limited to http(s) and mailto.
 *
 * Supported: # ## ### headings, paragraphs (single newlines become line breaks), **bold**, *italic* / _italic_,
 * `code`, fenced code blocks, [links](https://...) and bare URLs, - * + and 1. lists, - [ ] task items,
 * > quotes and --- rules.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "br" };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; inline: Inline[] }
  | { type: "paragraph"; inline: Inline[] }
  | { type: "quote"; inline: Inline[] }
  | { type: "code"; text: string; lang?: string }
  | { type: "hr" }
  | { type: "list"; ordered: boolean; items: { inline: Inline[]; checked?: boolean }[] };

const MAX_DEPTH = 6; // deeper nesting is shown as plain text instead of recursing without bound
const SAFE_URL = /^(https?:\/\/|mailto:)[^\s]+$/i;

export const isSafeUrl = (url: string): boolean => SAFE_URL.test(url.trim());

// ---------------------------------------------------------------- inline

interface Candidate {
  index: number;
  length: number;
  node: Inline;
}

const isWordChar = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c);

function firstMatch(text: string, depth: number): Candidate | null {
  const found: Candidate[] = [];

  let m = /`([^`\n]+)`/.exec(text);
  if (m) found.push({ index: m.index, length: m[0].length, node: { type: "code", text: m[1] } });

  m = /\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(text);
  if (m) {
    const [whole, label, href] = m;
    found.push({
      index: m.index,
      length: whole.length,
      // an unsafe target (javascript:, data:, relative...) keeps the label as plain text and drops the link
      node: isSafeUrl(href) ? { type: "link", href, children: parseInline(label, depth + 1) } : { type: "text", text: label },
    });
  }

  // bold may contain single asterisks (nested italics) but ends at the first "**"
  m = /\*\*(?=\S)((?:[^*\n]|\*(?!\*))+?)\*\*/.exec(text);
  if (m) found.push({ index: m.index, length: m[0].length, node: { type: "strong", children: parseInline(m[1], depth + 1) } });

  m = /\*([^*\s](?:[^*\n]*[^*\s])?)\*/.exec(text);
  if (m) found.push({ index: m.index, length: m[0].length, node: { type: "em", children: parseInline(m[1], depth + 1) } });

  // _italic_ must not start or end inside a word, so snake_case_names stay literal
  const underscore = /_([^_\s](?:[^_\n]*[^_\s])?)_/g;
  while ((m = underscore.exec(text))) {
    const before = text[m.index - 1];
    const after = text[m.index + m[0].length];
    if (!isWordChar(before) && !isWordChar(after)) {
      found.push({ index: m.index, length: m[0].length, node: { type: "em", children: parseInline(m[1], depth + 1) } });
      break;
    }
    underscore.lastIndex = m.index + 1;
  }

  m = /https?:\/\/[^\s<>]*[^\s<>.,;:!?)\]'"]/.exec(text);
  if (m) found.push({ index: m.index, length: m[0].length, node: { type: "link", href: m[0], children: [{ type: "text", text: m[0] }] } });

  if (found.length === 0) return null;
  // earliest wins; at the same position the longer match wins (so ** beats *)
  return found.sort((a, b) => a.index - b.index || b.length - a.length)[0];
}

export function parseInline(text: string, depth = 0): Inline[] {
  if (!text) return [];
  if (depth > MAX_DEPTH) return [{ type: "text", text }];
  const out: Inline[] = [];
  let rest = text;
  while (rest) {
    const hit = firstMatch(rest, depth);
    if (!hit) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (hit.index > 0) out.push({ type: "text", text: rest.slice(0, hit.index) });
    out.push(hit.node);
    rest = rest.slice(hit.index + hit.length);
  }
  return out;
}

/** Inline content of a multi-line paragraph: newlines become explicit line breaks. */
const parseLines = (lines: string[]): Inline[] =>
  lines.flatMap((line, i) => (i === 0 ? parseInline(line) : [{ type: "br" } as Inline, ...parseInline(line)]));

// ---------------------------------------------------------------- blocks

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const HR = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
const LIST_ITEM = /^\s{0,3}([-*+]|\d+[.)])\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const FENCE = /^```\s*([\w-]*)\s*$/;
const TASK = /^\[( |x|X)\]\s+(.*)$/;

export function parseMarkdown(source: string | null | undefined): Block[] {
  const lines = (source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const isSpecial = (line: string) => HEADING.test(line) || HR.test(line) || LIST_ITEM.test(line) || QUOTE.test(line) || FENCE.test(line);

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (an unterminated block simply runs to the end)
      blocks.push({ type: "code", text: body.join("\n"), lang: fence[1] || undefined });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, inline: parseInline(heading[2]) });
      i++;
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) quoted.push(QUOTE.exec(lines[i++])![1]);
      blocks.push({ type: "quote", inline: parseLines(quoted) });
      continue;
    }

    const first = LIST_ITEM.exec(line);
    if (first) {
      const ordered = /\d/.test(first[1]);
      const items: { inline: Inline[]; checked?: boolean }[] = [];
      while (i < lines.length) {
        const item = LIST_ITEM.exec(lines[i]);
        if (!item || /\d/.test(item[1]) !== ordered) break;
        const task = TASK.exec(item[2]);
        items.push(task ? { inline: parseInline(task[2]), checked: task[1] !== " " } : { inline: parseInline(item[2]) });
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && (para.length === 0 || !isSpecial(lines[i]))) para.push(lines[i++]);
    blocks.push({ type: "paragraph", inline: parseLines(para) });
  }
  return blocks;
}

// ---------------------------------------------------------------- rendering

function renderInline(nodes: Inline[]): React.ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return <React.Fragment key={i}>{n.text}</React.Fragment>;
      case "br":
        return <br key={i} />;
      case "strong":
        return <strong key={i}>{renderInline(n.children)}</strong>;
      case "em":
        return <em key={i}>{renderInline(n.children)}</em>;
      case "code":
        return (
          <code key={i} className="bg-C44 rounded-[3px] px-[4px] py-[1px] font-mono text-[0.9em]">
            {n.text}
          </code>
        );
      case "link":
        return (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow" className="text-C22 underline underline-offset-2 hover:text-C11 break-all">
            {renderInline(n.children)}
          </a>
        );
      default:
        return null;
    }
  });
}

const HEADING_CLASS = { 1: "text-[16px] font-extrabold mt-3", 2: "text-[14px] font-bold mt-3", 3: "text-[13px] font-bold mt-2" } as const;

export function Markdown({ source, className = "" }: { source: string | null | undefined; className?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={`text-[13px] leading-relaxed break-words space-y-2 ${className}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const Tag = (`h${b.level + 2}` as unknown) as keyof JSX.IntrinsicElements; // h3-h5 inside a dialog titled h1/h2
            return <Tag key={i} className={HEADING_CLASS[b.level]}>{renderInline(b.inline)}</Tag>;
          }
          case "paragraph":
            return <p key={i}>{renderInline(b.inline)}</p>;
          case "quote":
            return <blockquote key={i} className="border-l-4 border-C44 pl-3 text-gray-600">{renderInline(b.inline)}</blockquote>;
          case "code":
            return (
              <pre key={i} className="bg-C44 rounded-[6px] p-2 overflow-x-auto text-[12px]">
                <code className="font-mono">{b.text}</code>
              </pre>
            );
          case "hr":
            return <hr key={i} className="border-C44" />;
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={`${b.ordered ? "list-decimal" : "list-disc"} pl-5 space-y-[2px]`}>
                {b.items.map((item, j) => (
                  <li key={j} className={item.checked !== undefined ? "list-none -ml-5 flex gap-2 items-start" : ""}>
                    {item.checked !== undefined && (
                      <input type="checkbox" checked={item.checked} readOnly disabled aria-label={item.checked ? "Done" : "Not done"} className="mt-[3px]" />
                    )}
                    <span className={item.checked ? "line-through text-gray-500" : ""}>{renderInline(item.inline)}</span>
                  </li>
                ))}
              </Tag>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
