import * as React from "react";

import type { ParamValue } from "./types";

export type RichValue =
  | React.ReactNode
  | ParamValue
  | ((chunks: React.ReactNode) => React.ReactNode);

/** formatRich turns a message with placeholders and simple tags into React
 * nodes, so translations can contain links and emphasis:
 *
 *     "Read the <link>community guidelines</link> before {action}."
 *     formatRich(message, { link: (c) => <Link to="/community">{c}</Link>, action: "uploading" })
 *
 * Tags are `<name>…</name>` (no attributes; tags can be nested) and render the
 * function given for `name`. `{name}` renders the value given for `name`.
 * Unknown tags and placeholders are left as text. */
export function formatRich(
  message: string,
  values: Record<string, RichValue> = {},
): React.ReactNode {
  const nodes = parse(message, values);
  return nodes.length === 1 ? nodes[0] : <>{nodes}</>;
}

const TOKEN = /<(\w+)>([\s\S]*?)<\/\1>|\{(\w+)\}/g;

function parse(
  message: string,
  values: Record<string, RichValue>,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of message.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(message.slice(last, index));
    last = index + match[0].length;

    const [whole, tag, inner, placeholder] = match;
    if (tag !== undefined) {
      const render = values[tag];
      if (typeof render === "function") {
        const children = parse(inner, values);
        nodes.push(
          <React.Fragment key={key++}>
            {render(children.length === 1 ? children[0] : <>{children}</>)}
          </React.Fragment>,
        );
      } else {
        nodes.push(whole);
      }
    } else if (placeholder in values) {
      const value = values[placeholder];
      nodes.push(
        <React.Fragment key={key++}>
          {typeof value === "function" ? whole : value}
        </React.Fragment>,
      );
    } else {
      nodes.push(whole);
    }
  }
  if (last < message.length) nodes.push(message.slice(last));
  return nodes;
}
