import React from "react";
import { render, screen } from "@testing-library/react";
import { Markdown, isSafeUrl, parseInline, parseMarkdown } from "./markdown";

const html = (source: string) => {
  const { container } = render(<Markdown source={source} />);
  return container.firstElementChild as HTMLElement;
};

describe("blocks", () => {
  test("headings, paragraphs and rules", () => {
    const el = html("# Title\n\nSome text\n\n---\n\n### Small");
    expect(el.querySelector("h3")?.textContent).toBe("Title"); // levels are shifted down inside dialogs
    expect(el.querySelector("h5")?.textContent).toBe("Small");
    expect(el.querySelector("p")?.textContent).toBe("Some text");
    expect(el.querySelector("hr")).toBeInTheDocument();
  });

  test("single newlines inside a paragraph become line breaks", () => {
    const el = html("line one\nline two");
    expect(el.querySelectorAll("p")).toHaveLength(1);
    expect(el.querySelector("br")).toBeInTheDocument();
    expect(el.textContent).toBe("line oneline two");
  });

  test("unordered, ordered and task lists", () => {
    const ul = html("- a\n- b\n* c");
    expect(ul.querySelectorAll("ul > li")).toHaveLength(3);
    const ol = html("1. first\n2) second");
    expect(ol.querySelectorAll("ol > li")).toHaveLength(2);
    const tasks = html("- [ ] todo\n- [x] done");
    const boxes = tasks.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    expect(Array.from(boxes).map((b) => b.checked)).toEqual([false, true]);
    expect(boxes[0]).toBeDisabled();
  });

  test("a switch between bullet and numbered items starts a new list", () => {
    expect(parseMarkdown("- a\n1. b").map((b) => b.type)).toEqual(["list", "list"]);
  });

  test("code fences keep their content verbatim, including markdown and HTML", () => {
    const el = html("```js\nconst a = **not bold**;\n<b>x</b>\n```");
    const code = el.querySelector("pre code")!;
    expect(code.textContent).toBe("const a = **not bold**;\n<b>x</b>");
    expect(el.querySelector("strong")).toBeNull();
    expect(el.querySelector("b")).toBeNull();
  });

  test("an unterminated fence runs to the end instead of swallowing nothing", () => {
    expect(parseMarkdown("```\nstill code")).toEqual([{ type: "code", text: "still code", lang: undefined }]);
  });

  test("quotes merge consecutive lines", () => {
    const el = html("> one\n> two");
    expect(el.querySelectorAll("blockquote")).toHaveLength(1);
    expect(el.querySelector("blockquote")?.textContent).toBe("onetwo");
  });

  test("empty, null and whitespace input render nothing", () => {
    for (const src of ["", "   \n\n ", null, undefined]) expect(html(src as any).children).toHaveLength(0);
  });

  test("windows line endings are handled", () => {
    expect(parseMarkdown("# A\r\n\r\ntext").map((b) => b.type)).toEqual(["heading", "paragraph"]);
  });
});

describe("inline", () => {
  test("bold, italic and code, including nesting", () => {
    const el = html("**bold** and *it* and `x` and **b *both* b**");
    expect(el.querySelectorAll("strong")).toHaveLength(2);
    expect(el.querySelectorAll("em")).toHaveLength(2);
    expect(el.querySelector("strong em")?.textContent).toBe("both");
    expect(el.querySelector("code")?.textContent).toBe("x");
  });

  test("code spans are not parsed further", () => {
    const el = html("`**not bold**`");
    expect(el.querySelector("code")?.textContent).toBe("**not bold**");
    expect(el.querySelector("strong")).toBeNull();
  });

  test("snake_case words are not italicised, but _spaced emphasis_ is", () => {
    expect(html("use my_var_name here").querySelector("em")).toBeNull();
    expect(html("this is _slanted_ text").querySelector("em")?.textContent).toBe("slanted");
  });

  test("unterminated markers stay literal", () => {
    const el = html("a **half bold and a lone * star");
    expect(el.querySelector("strong")).toBeNull();
    expect(el.textContent).toContain("**half bold");
  });

  test("markdown links and bare URLs become safe external links", () => {
    const el = html("see [the docs](https://example.com/a?b=1) or https://example.org/x.");
    const links = el.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://example.com/a?b=1");
    expect(links[1]).toHaveAttribute("href", "https://example.org/x"); // trailing full stop is not part of the URL
    for (const a of Array.from(links)) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
    expect(html("[mail](mailto:a@b.co)").querySelector("a")).toHaveAttribute("href", "mailto:a@b.co");
  });
});

describe("safety", () => {
  test.each([
    ["javascript:", "[x](javascript:alert(1))"],
    ["JaVaScRiPt:", "[x](JaVaScRiPt:alert(1))"],
    ["data:", "[x](data:text/html;base64,PHNjcmlwdD4=)"],
    ["vbscript:", "[x](vbscript:msgbox)"],
    ["relative", "[x](/admin/delete)"],
    ["protocol-relative", "[x](//evil.example)"],
  ])("a %s link is never rendered as a link, but its label survives", (_name, src) => {
    const el = html(src);
    expect(el.querySelector("a")).toBeNull();
    expect(el.textContent).toContain("x");
  });

  test("HTML in the source is shown as literal text, never parsed", () => {
    const el = html('<script>window.__pwned = 1</script>\n<img src=x onerror="window.__pwned=1">\n<a href="javascript:1">click</a>');
    expect(el.querySelector("script")).toBeNull();
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector("a")).toBeNull();
    expect(el.textContent).toContain("<script>window.__pwned = 1</script>");
    expect((window as any).__pwned).toBeUndefined();
  });

  test("HTML inside bold, links and headings is escaped too", () => {
    const el = html('# <b>h</b>\n**<i>x</i>**\n[<u>l</u>](https://ok.example)');
    expect(el.querySelector("b, i, u")).toBeNull();
    expect(el.textContent).toContain("<b>h</b>");
  });

  test("entities are not decoded", () => {
    expect(html("&lt;script&gt; &amp;").textContent).toBe("&lt;script&gt; &amp;");
  });

  test("a link label cannot smuggle in a second URL scheme", () => {
    const el = html("[https://a.example](javascript:alert(1))");
    expect(el.querySelector("a[href^=javascript]")).toBeNull();
  });

  test("isSafeUrl accepts only http, https and mailto", () => {
    for (const ok of ["http://a.co", "https://a.co/x?y#z", "mailto:me@a.co", "HTTPS://A.CO"]) expect(isSafeUrl(ok)).toBe(true);
    for (const bad of ["javascript:1", "ftp://a.co", "file:///etc/passwd", "//a.co", "/x", "https://a b", ""]) expect(isSafeUrl(bad)).toBe(false);
  });
});

describe("robustness", () => {
  test("pathological input finishes quickly", () => {
    const start = Date.now();
    html("*".repeat(4000));
    html("**a ".repeat(1200));
    html("[a](".repeat(1000));
    html("_ ".repeat(2000));
    expect(Date.now() - start).toBeLessThan(3000);
  });

  test("deep nesting is cut off instead of overflowing the stack", () => {
    const nested = "**".repeat(60) + "x" + "**".repeat(60);
    expect(() => parseInline(nested)).not.toThrow();
    expect(() => html("[".repeat(500) + "x" + "](https://a.co)".repeat(1))).not.toThrow();
  });

  test("text content is preserved around formatting", () => {
    screen.queryByText("never");
    expect(html("a **b** c").textContent).toBe("a b c");
  });
});
