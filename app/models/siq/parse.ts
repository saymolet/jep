/** Parser for the `content.xml` of a SIGame package (`.siq`).
 *
 * Two layouts exist (see https://github.com/VladimirKhil/SI, `assets/`):
 *
 * - **v4** (`ygpackage3.0.xsd`, SIQuester before 6): a question has a
 *   `<scenario>` of `<atom>`s — text, `say`, `image`/`voice`/`video` (a file in
 *   the package is written as `@name`), and a `marker` atom that separates the
 *   question from the answer part. The question type is `<type name="cat">`
 *   with `<param>`s.
 * - **v5** (`siq_5.xsd`): a question has `<params>`; `question` and `answer`
 *   are `type="content"` params with `<item>`s (`isRef="True"` for files in the
 *   package). The type is the `type` attribute of `<question>`.
 *
 * Both are normalized to {@link SiqPackage}. The parser never resolves
 * external entities: documents with a DOCTYPE are rejected outright.
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";

import { SiqImportError } from "./errors";

/** A piece of question or answer content. `kind` is normalized: v4 `voice`
 * becomes `audio`, v4 `say` becomes `text`. Unknown kinds are kept as-is. */
export interface SiqContent {
  kind: string;
  value: string;
  /** The value names a file inside the package (v4 `@name`, v5 `isRef`). */
  isRef: boolean;
}

export interface SiqPriceRange {
  min: number;
  max: number;
}

export interface SiqAnswerOption {
  label: string;
  content: SiqContent[];
}

export interface SiqQuestion {
  price: number;
  /** Normalized question type: "" (default for the round), "simple",
   * "secret", "stake", "noRisk", ... v4 names (cat, bagcat, auction,
   * sponsored) are kept; the converter maps them. */
  type: string;
  /** Secret question topic (v4 `cat` param `theme`, v5 param `theme`). */
  topic?: string;
  /** Secret question price (v4 `cost`, v5 `price` number set). */
  secretPrice?: SiqPriceRange;
  question: SiqContent[];
  answer: SiqContent[];
  right: string[];
  /** v5 `answerType` param, e.g. "select" for multiple choice. */
  answerType?: string;
  /** v5 `answerOptions` (multiple choice options). */
  options?: SiqAnswerOption[];
}

export interface SiqTheme {
  name: string;
  questions: SiqQuestion[];
}

export interface SiqRound {
  name: string;
  /** "" (normal), "final", "themeList", ... */
  type: string;
  themes: SiqTheme[];
}

export interface SiqPackage {
  name: string;
  version: number;
  authors: string[];
  comments: string;
  rounds: SiqRound[];
}

// Elements that may repeat, so they are always parsed as arrays.
const ARRAY_TAGS = new Set([
  "round",
  "theme",
  "question",
  "atom",
  "item",
  "param",
  "answer",
  "author",
  "step",
]);

interface XmlNode {
  $?: Record<string, string>;
  "#text"?: string;
  [key: string]: unknown;
}

function isNode(value: unknown): value is XmlNode {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asNode(value: unknown): XmlNode | undefined {
  return isNode(value) ? value : undefined;
}

function children(node: XmlNode | undefined, name: string): XmlNode[] {
  const value = node?.[name];
  if (!Array.isArray(value)) {
    const single = asNode(value);
    return single ? [single] : [];
  }
  return value.map(asNode).filter((n): n is XmlNode => n !== undefined);
}

function child(node: XmlNode | undefined, name: string): XmlNode | undefined {
  return children(node, name)[0];
}

function attr(node: XmlNode | undefined, name: string): string | undefined {
  return node?.$?.[name];
}

function text(node: XmlNode | undefined): string {
  const value = node?.["#text"];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKind(kind: string | undefined): string {
  const k = (kind ?? "").trim().toLowerCase();
  if (k === "" || k === "text" || k === "say") return "text";
  if (k === "voice" || k === "audio") return "audio";
  return k;
}

/** parsePriceRange parses "500", "[100;500]", "[100;500]/100". */
export function parsePriceRange(value: string): SiqPriceRange | undefined {
  const v = value.trim();
  const single = /^-?\d+$/.exec(v);
  if (single) {
    const n = Number(v);
    return { min: n, max: n };
  }
  const range = /^\[\s*(-?\d+)\s*;\s*(-?\d+)\s*\](?:\s*\/\s*\d+)?$/.exec(v);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  return undefined;
}

function parseIntSafe(value: string | undefined): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

/** v4: `<scenario><atom type="...">...</atom></scenario>`. */
function parseV4Scenario(question: XmlNode): {
  question: SiqContent[];
  answer: SiqContent[];
} {
  const questionContent: SiqContent[] = [];
  const answerContent: SiqContent[] = [];
  let target = questionContent;
  for (const atom of children(child(question, "scenario"), "atom")) {
    const kind = normalizeKind(attr(atom, "type"));
    if (kind === "marker") {
      target = answerContent;
      continue;
    }
    const raw = text(atom);
    const isRef = kind !== "text" && raw.startsWith("@");
    target.push({ kind, value: isRef ? raw.slice(1) : raw, isRef });
  }
  return { question: questionContent, answer: answerContent };
}

function parseV5Content(param: XmlNode | undefined): SiqContent[] {
  return children(param, "item").map((item) => {
    const kind = normalizeKind(attr(item, "type"));
    const isRef = (attr(item, "isRef") ?? "").toLowerCase() === "true";
    return { kind, value: text(item), isRef };
  });
}

function parseQuestion(node: XmlNode): SiqQuestion {
  const params = children(child(node, "params"), "param");
  const param = (name: string) => params.find((p) => attr(p, "name") === name);
  const right = children(child(node, "right"), "answer")
    .map(text)
    .filter((a) => a.length > 0);
  const price = parseIntSafe(attr(node, "price"));

  if (params.length > 0 || child(node, "scenario") === undefined) {
    // v5 layout.
    const result: SiqQuestion = {
      price,
      type: attr(node, "type") ?? "",
      question: parseV5Content(param("question")),
      answer: parseV5Content(param("answer")),
      right,
    };
    const topic = text(param("theme"));
    if (topic) result.topic = topic;
    const priceParam = param("price");
    if (priceParam) {
      const numberSet = child(priceParam, "numberSet");
      if (numberSet) {
        const min = parseIntSafe(attr(numberSet, "minimum"));
        const max = parseIntSafe(attr(numberSet, "maximum"));
        result.secretPrice = {
          min: Math.min(min, max),
          max: Math.max(min, max),
        };
      } else {
        result.secretPrice = parsePriceRange(text(priceParam));
      }
    }
    const answerType = text(param("answerType"));
    if (answerType) result.answerType = answerType;
    const options = param("answerOptions");
    if (options) {
      result.options = children(options, "param").map((option) => ({
        label: attr(option, "name") ?? "",
        content: parseV5Content(option),
      }));
    }
    return result;
  }

  // v4 layout.
  const typeNode = child(node, "type");
  const typeParams = children(typeNode, "param");
  const typeParam = (name: string) =>
    text(typeParams.find((p) => attr(p, "name") === name));
  const result: SiqQuestion = {
    price,
    type: attr(typeNode, "name") ?? "",
    ...parseV4Scenario(node),
    right,
  };
  const topic = typeParam("theme");
  if (topic) result.topic = topic;
  const cost = typeParam("cost");
  if (cost) result.secretPrice = parsePriceRange(cost);
  return result;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  attributesGroupName: "$",
  textNodeName: "#text",
  alwaysCreateTextNode: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  removeNSPrefix: true,
  processEntities: true,
  htmlEntities: false,
  isArray: (name) => ARRAY_TAGS.has(name),
});

/** parseSiqXml parses a SIGame `content.xml` (v4 or v5). Throws
 * {@link SiqImportError} for malformed or unsupported documents. */
export function parseSiqXml(xml: string): SiqPackage {
  // Skip a byte order mark.
  const source = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  // No DTDs at all: they are the vector for entity expansion and external
  // entity attacks, and real packages never contain one.
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) {
    throw new SiqImportError("siq.error.doctype");
  }
  const valid = XMLValidator.validate(source);
  if (valid !== true) {
    throw new SiqImportError("siq.error.invalidXml", {
      line: valid.err.line,
      reason: valid.err.msg,
    });
  }

  let doc: XmlNode | undefined;
  try {
    doc = asNode(parser.parse(source));
  } catch (error) {
    throw new SiqImportError("siq.error.unreadableXml", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  const pkg = child(doc, "package");
  if (!pkg) {
    throw new SiqImportError("siq.error.noPackage");
  }

  const info = child(pkg, "info");
  return {
    name: attr(pkg, "name")?.trim() ?? "",
    version: Number(attr(pkg, "version") ?? "0") || 0,
    authors: children(child(info, "authors"), "author")
      .map(text)
      .filter((a) => a.length > 0),
    comments: text(child(info, "comments")),
    rounds: children(child(pkg, "rounds"), "round").map((round) => ({
      name: attr(round, "name")?.trim() ?? "",
      type: attr(round, "type")?.trim() ?? "",
      themes: children(child(round, "themes"), "theme").map((theme) => ({
        name: attr(theme, "name")?.trim() ?? "",
        questions: children(child(theme, "questions"), "question").map(
          parseQuestion,
        ),
      })),
    })),
  };
}
