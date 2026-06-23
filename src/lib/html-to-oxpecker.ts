// Converts HTML into F# Oxpecker.Solid DSL markup.
// See https://lanayx.github.io/Oxpecker/src/Oxpecker.Solid/ for the target syntax.
//
// Like ./html-to-jsx.ts this is browser-only: it parses the input by assigning
// to `innerHTML` on a real DOM node and walking the resulting tree.
//
// The output is verified to compile against the real Oxpecker.Solid package by
// the Fable-based compile test in test/fsharp (run via `pnpm test:fsharp`).

import { OXPECKER_STRING_ATTRS } from "./oxpecker-string-attrs";

const NODE_TYPE = {
  ELEMENT: 1,
  TEXT: 3,
  COMMENT: 8,
};

const isServer = typeof window === "undefined";

// SVG (and a few HTML) tag names that must be camelCased to match the
// Oxpecker.Solid element functions. Mirrors the mapping in ./html-to-jsx.ts.
const ELEMENT_TAG_NAME_MAPPING: { [key: string]: string } = {
  altglyph: "altGlyph",
  altglyphdef: "altGlyphDef",
  altglyphitem: "altGlyphItem",
  animatecolor: "animateColor",
  animatemotion: "animateMotion",
  animatetransform: "animateTransform",
  clippath: "clipPath",
  feblend: "feBlend",
  fecolormatrix: "feColorMatrix",
  fecomponenttransfer: "feComponentTransfer",
  fecomposite: "feComposite",
  feconvolvematrix: "feConvolveMatrix",
  fediffuselighting: "feDiffuseLighting",
  fedisplacementmap: "feDisplacementMap",
  fedistantlight: "feDistantLight",
  fedropshadow: "feDropShadow",
  feflood: "feFlood",
  fefunca: "feFuncA",
  fefuncb: "feFuncB",
  fefuncg: "feFuncG",
  fefuncr: "feFuncR",
  fegaussianblur: "feGaussianBlur",
  feimage: "feImage",
  femerge: "feMerge",
  femergenode: "feMergeNode",
  femorphology: "feMorphology",
  feoffset: "feOffset",
  fepointlight: "fePointLight",
  fespecularlighting: "feSpecularLighting",
  fespotlight: "feSpotLight",
  fetile: "feTile",
  feturbulence: "feTurbulence",
  foreignobject: "foreignObject",
  glyphref: "glyphRef",
  lineargradient: "linearGradient",
  radialgradient: "radialGradient",
  textpath: "textPath",
};

// F# reserved words that, when they appear as an attribute name, must be
// suffixed with an apostrophe in the Oxpecker DSL (e.g. class -> class').
const FSHARP_RESERVED = new Set([
  "abstract", "and", "as", "base", "begin", "class", "default", "delegate",
  "do", "done", "downcast", "downto", "elif", "else", "end", "exception",
  "extern", "false", "finally", "fixed", "for", "fun", "function", "global",
  "if", "in", "inherit", "inline", "interface", "internal", "lazy", "let",
  "match", "member", "module", "mutable", "namespace", "new", "not", "null",
  "of", "open", "or", "override", "private", "public", "rec", "return", "sig",
  "static", "struct", "then", "to", "true", "try", "type", "upcast", "use",
  "val", "void", "when", "while", "with", "yield",
]);

// Oxpecker.Solid types many attributes as `int`/`bool`/`char` rather than
// string, and a few (width/height) even differ by element (int on <img>,
// string on <svg>). Rather than track every element-specific type, attributes
// in these sets are emitted through the generic, always-string-safe `.attr()` /
// `.bool()` extension methods so the output type-checks on any element.
// Extracted from the Oxpecker.Solid 1.0.0 bindings (Tags.fs / Svg.fs).
const INT_ATTRS = new Set([
  "cols", "colspan", "height", "maxlength", "minlength", "rows", "rowspan",
  "size", "span", "tabindex", "width",
]);
const BOOL_ATTRS = new Set([
  "async", "autofocus", "autoplay", "checked", "controls", "defer", "disabled",
  "disablepictureinpicture", "disableremoteplayback", "formnovalidate", "inert",
  "ismap", "loop", "multiple", "muted", "nomodule", "novalidate", "open",
  "playsinline", "readonly", "required", "selected", "spellcheck",
]);
const CHAR_ATTRS = new Set(["accesskey"]);

const isValidIdentifier = (name: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);

const isIntegerValue = (value: string) => /^-?\d+$/.test(value);

/** Attribute name as an F# identifier; reserved words take a trailing apostrophe. */
const fsAttrIdent = (name: string) => (FSHARP_RESERVED.has(name) ? `${name}'` : name);

/** Escapes a value for use inside an F# double-quoted string literal. */
const escapeFsString = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const oxpeckerTagName = (tagName: string) => {
  const name = tagName.toLowerCase();
  const mapped = ELEMENT_TAG_NAME_MAPPING[name] ?? name;
  // Elements whose name is an F# reserved word are exposed with a trailing
  // apostrophe by Oxpecker (e.g. the SVG <use> element is `use'`).
  return FSHARP_RESERVED.has(mapped) ? `${mapped}'` : mapped;
};

export type OxpeckerConfig = {
  /** @defaultValue four spaces `"    "` */
  indent?: string;
  /** @defaultValue `"none"` */
  wrapperNode?: "none" | "fragment" | "div";
  /** @defaultValue `"none"` */
  component?: "function" | "arrow-function" | "none";
  /** @defaultValue `"SolidComponent"` */
  componentName?: string;
  /** @defaultValue `false` */
  stripStyleTag?: boolean;
  /** @defaultValue `false` */
  stripComment?: boolean;
};

class HTMLtoOxpecker {
  config: OxpeckerConfig;
  #inPreTag = false;
  #inSvg = false;

  constructor(config: OxpeckerConfig = {}) {
    config.indent ??= "    ";
    config.wrapperNode ??= "none";
    config.component ??= "none";
    config.componentName ??= "SolidComponent";
    this.config = config;
  }

  /**
   * Main entry point. Given HTML, returns Oxpecker.Solid F# markup.
   */
  convert(html: string): string {
    if (isServer) return "";
    this.#inPreTag = false;
    this.#inSvg = false;

    const container = document.createElement("div");
    container.innerHTML = this.#cleanInput(html);

    const topNodes = this.#meaningfulChildren(container);
    if (topNodes.length === 0) return "";

    // Decide whether the markup needs a wrapper element. Like the JSX
    // converter, a single top-level node is emitted directly.
    const needsWrapper = this.config.wrapperNode !== "none" && topNodes.length > 1;
    const component = this.config.component !== "none";

    // Base indent level: the markup is nested one level deeper for each of the
    // (optional) component function and wrapper element.
    let level = 0;
    if (component) level++;
    if (needsWrapper) level++;

    let body = this.#renderNodes(topNodes, level);

    if (needsWrapper) {
      const wrapperTag = this.config.wrapperNode === "div" ? "div" : "Fragment";
      const wrapIndent = this.#indent(component ? 1 : 0);
      body = [`${wrapIndent}${wrapperTag}() {`, ...body, `${wrapIndent}}`];
    }

    if (component) {
      const header = [`[<SolidComponent>]`, `let ${this.config.componentName} () =`];
      body = [...header, ...body];
    }

    return body.join("\n") + "\n";
  }

  /** Strips script tags (and optionally style tags / comments) before parsing. */
  #cleanInput(html: string): string {
    html = html.trim();
    html = html.replace(/<script([\s\S]*?)<\/script>/g, "");
    if (this.config.stripStyleTag) {
      html = html.replace(/<style([\s\S]*?)<\/style>/g, "");
    }
    if (this.config.stripComment) {
      html = html.replace(/<!--([\s\S]*?)-->/g, "");
    }
    return html;
  }

  #indent(level: number): string {
    return this.config.indent!.repeat(level);
  }

  /** Children that survive into the output (drops whitespace-only text nodes). */
  #meaningfulChildren(node: Node): Node[] {
    const result: Node[] = [];
    node.childNodes.forEach((child) => {
      if (child.nodeType === NODE_TYPE.TEXT) {
        if (this.#inPreTag || !/^\s*$/.test(child.textContent ?? "")) {
          result.push(child);
        }
      } else if (
        child.nodeType === NODE_TYPE.ELEMENT ||
        child.nodeType === NODE_TYPE.COMMENT
      ) {
        result.push(child);
      }
    });
    return result;
  }

  #renderNodes(nodes: Node[], level: number): string[] {
    const lines: string[] = [];
    for (const node of nodes) {
      lines.push(...this.#renderNode(node, level));
    }
    return lines;
  }

  #renderNode(node: Node, level: number): string[] {
    switch (node.nodeType) {
      case NODE_TYPE.ELEMENT:
        return this.#renderElement(node as Element, level);
      case NODE_TYPE.TEXT:
        return this.#renderText(node, level);
      case NODE_TYPE.COMMENT:
        return this.#renderComment(node, level);
      default:
        return [];
    }
  }

  #renderText(node: Node, level: number): string[] {
    const indent = this.#indent(level);
    if (this.#inPreTag) {
      const raw = (node.textContent ?? "").replace(/\r/g, "");
      if (raw === "") return [];
      return [`${indent}"""${raw}"""`];
    }
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text === "") return [];
    return [`${indent}"${escapeFsString(text)}"`];
  }

  #renderComment(node: Node, level: number): string[] {
    if (this.config.stripComment) return [];
    const indent = this.#indent(level);
    const text = (node.textContent ?? "").trim();
    if (text.includes("\n")) {
      return [`${indent}(* ${text} *)`];
    }
    return [`${indent}// ${text}`];
  }

  #renderElement(node: Element, level: number): string[] {
    const tagName = oxpeckerTagName(node.tagName);
    // Context flags must be set before attributes/children are processed: <pre>
    // preserves whitespace, and inside <svg> the width/height attributes are
    // typed as strings (vs int on HTML elements).
    const wasInPre = this.#inPreTag;
    const wasInSvg = this.#inSvg;
    if (tagName === "pre") this.#inPreTag = true;
    if (tagName === "svg") this.#inSvg = true;

    const result = this.#renderElementInner(node, level, tagName);

    this.#inPreTag = wasInPre;
    this.#inSvg = wasInSvg;
    return result;
  }

  #renderElementInner(node: Element, level: number, tagName: string): string[] {
    const indent = this.#indent(level);
    const { params, methods } = this.#buildAttributes(node);
    const header = `${tagName}(${params.join(", ")})${methods.join("")}`;

    // <style> contents are emitted as a single (triple-quoted) string child.
    if (tagName === "style") {
      const css = (node.textContent ?? "").trim();
      if (!css) return [`${indent}${header}`];
      const inner = this.#indent(level + 1);
      return [`${indent}${header} {`, `${inner}"""`, css, `${inner}"""`, `${indent}}`];
    }

    const children = this.#meaningfulChildren(node);

    if (children.length === 0) {
      return [`${indent}${header}`];
    }

    // Inline a lone text child: tag() { "text" }
    if (children.length === 1 && children[0].nodeType === NODE_TYPE.TEXT && !this.#inPreTag) {
      const text = (children[0].textContent ?? "").replace(/\s+/g, " ").trim();
      if (text === "") return [`${indent}${header}`];
      return [`${indent}${header} { "${escapeFsString(text)}" }`];
    }

    const childLines = this.#renderNodes(children, level + 1);
    return [`${indent}${header} {`, ...childLines, `${indent}}`];
  }

  #buildAttributes(node: Element): { params: string[]; methods: string[] } {
    const params: string[] = [];
    const methods: string[] = [];

    const attr = (name: string, value: string) =>
      methods.push(`.attr("${name}", "${escapeFsString(value)}")`);

    for (let i = 0; i < node.attributes.length; i++) {
      const { name, value } = node.attributes[i];

      // Bare attribute (e.g. <input disabled>, <div contenteditable>): presence
      // is the meaning. Known booleans become a named `name=true`, anything
      // else is toggled on with the generic .bool extension.
      if (value === "") {
        if (BOOL_ATTRS.has(name)) params.push(`${fsAttrIdent(name)}=true`);
        else methods.push(`.bool("${name}", true)`);
        continue;
      }

      // Boolean attributes with an explicit value (disabled="disabled", etc.).
      if (BOOL_ATTRS.has(name)) {
        params.push(`${fsAttrIdent(name)}=${value.toLowerCase() !== "false"}`);
        continue;
      }

      // width/height are typed `int` on HTML elements but `string` on SVG ones.
      if (name === "width" || name === "height") {
        if (this.#inSvg) params.push(`${name}="${escapeFsString(value)}"`);
        else if (isIntegerValue(value)) params.push(`${name}=${value}`);
        else attr(name, value);
        continue;
      }

      // Other int-typed attributes (tabindex, colspan, rows, ...): emit a named
      // int when the value is a plain integer, otherwise fall back to .attr.
      if (INT_ATTRS.has(name)) {
        if (isIntegerValue(value)) params.push(`${fsAttrIdent(name)}=${value}`);
        else attr(name, value);
        continue;
      }

      // char-typed (accesskey): keep it a string via the generic extension.
      if (CHAR_ATTRS.has(name)) {
        attr(name, value);
        continue;
      }

      // Idiomatic string named argument, but only for attributes Oxpecker
      // actually exposes as a property — otherwise the property-initializer
      // syntax fails to compile (e.g. blockquote has no `cite`). Reserved F#
      // words take a trailing apostrophe; defined hyphenated SVG props
      // (stop-color, ...) are written with backtick-quoting.
      if (OXPECKER_STRING_ATTRS.has(name)) {
        const fsName = isValidIdentifier(name) ? fsAttrIdent(name) : `\`\`${name}\`\``;
        params.push(`${fsName}="${escapeFsString(value)}"`);
        continue;
      }

      // Anything Oxpecker doesn't model as a named property (custom attrs,
      // data-*, aria-* in their hyphenated HTML form, xlink:href, ...) is bound
      // through the generic, always-string-safe .attr extension.
      attr(name, value);
    }

    return { params, methods };
  }
}

export default HTMLtoOxpecker;
