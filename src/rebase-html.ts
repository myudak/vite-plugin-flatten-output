import { posix } from "node:path";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import parseSrcset from "parse-srcset";
import valueParser from "postcss-value-parser";

type Node = DefaultTreeAdapterMap["node"];
type Edit = { start: number; end: number; text: string };
const urlAttributes = new Set(["src", "href", "poster", "data", "action", "formaction", "cite", "background", "xlink:href"]);

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function rebaseHtml(html: string, from: string, to: string, renames: Map<string, string>): string {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const edits: Edit[] = [];
  const elements: DefaultTreeAdapterMap["element"][] = [];
  const visit = (node: Node) => {
    if ("tagName" in node) elements.push(node);
    if ("childNodes" in node) node.childNodes.forEach(visit);
    if ("content" in node) visit(node.content);
  };
  visit(document);
  const base = elements.find((node) => node.tagName === "base" && node.attrs.some((attr) => attr.name === "href"));
  const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");
  const encodedRenames = new Map([...renames].map(([source, destination]) => [encodePath(source), encodePath(destination)]));
  const rebase = (url: string, isBase = false): string => {
    if ((!url && !isBase) || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(url) || (!isBase && /^[#?]/.test(url))) return url;
    const original = new URL(url, `https://flatten.invalid/${encodePath(from)}`);
    const path = original.pathname.slice(1);
    const target = isBase ? path : encodedRenames.get(path) ?? path;
    const relative = posix.relative(posix.dirname(encodePath(to)), target);
    let result = relative.startsWith(".") ? relative : `./${relative}`;
    if (original.pathname.endsWith("/") && !result.endsWith("/")) result += "/";
    return result + original.search + original.hash;
  };
  const css = (value: string): string => {
    const ast = valueParser(value);
    ast.walk((node) => {
      if (node.type !== "function" || node.value.toLowerCase() !== "url") return;
      const url = node.nodes[0];
      if (node.nodes.length === 1 && url && (url.type === "string" || url.type === "word")) url.value = rebase(url.value);
      return false;
    });
    return ast.toString();
  };
  for (const element of elements) {
    for (const attribute of element.attrs) {
      const name = attribute.prefix ? `${attribute.prefix}:${attribute.name}` : attribute.name;
      let value = attribute.value;
      if (base && element !== base) continue;
      if (urlAttributes.has(name)) value = rebase(value, element === base && name === "href");
      else if (name === "srcset" || name === "imagesrcset") {
        value = parseSrcset(value).map((candidate) => {
          const descriptor = candidate.w ? ` ${candidate.w}w` : candidate.d ? ` ${candidate.d}x` : "";
          return rebase(candidate.url) + descriptor;
        }).join(", ");
      } else if (name === "style") value = css(value);
      const location = element.sourceCodeLocation?.attrs?.[name];
      if (location && value !== attribute.value) edits.push({ start: location.startOffset, end: location.endOffset, text: `${name}="${escapeAttribute(value)}"` });
    }
    if (!base && element.tagName === "style") {
      for (const child of element.childNodes) {
        if (child.nodeName !== "#text" || !("value" in child) || !child.sourceCodeLocation) continue;
        const text = css(child.value);
        if (text !== child.value) edits.push({ start: child.sourceCodeLocation.startOffset, end: child.sourceCodeLocation.endOffset, text });
      }
    }
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) html = html.slice(0, edit.start) + edit.text + html.slice(edit.end);
  return html;
}
