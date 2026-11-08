import type { ContextParts } from "./types";

export const BLOCK_SELECTOR =
  "p,div,li,td,th,dd,dt,blockquote,section,article,header,footer,main,aside,h1,h2,h3,h4,h5,h6,tr,table,ul,ol,dl,body," +
  "[role=cell],[role=gridcell],[role=row]";
const CELL_SELECTOR = "td,th,[role=cell],[role=gridcell]";
const INVISIBLE = "script,style,noscript,template";

export type MatchContext = {
  before: string | null;
  columnHeader: string | null;
  sectionHeading: string | null;
  snippet: string;
};

function blockOf(node: Text): Element {
  const doc = node.ownerDocument;
  return node.parentElement?.closest(BLOCK_SELECTOR) ?? doc.body ?? doc.documentElement;
}

/** Visible text of the block before (`dir = -1`) or after (`dir = 1`) `node`, up to `chars` characters. */
function collect(node: Text, dir: -1 | 1, chars: number): string {
  const doc = node.ownerDocument;
  const walker = doc.createTreeWalker(blockOf(node), NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest(INVISIBLE) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  walker.currentNode = node;
  const parts: string[] = [];
  let length = 0;
  while (length < chars) {
    const next = dir < 0 ? walker.previousNode() : walker.nextNode();
    if (!next) break;
    const data = (next as Text).data;
    parts.push(data);
    length += data.length;
  }
  return dir < 0 ? parts.reverse().join("") : parts.join("");
}

/** The last `chars` characters before `offset` in `node`, within the same text block. */
export function textBefore(node: Text, offset: number, chars: number): string {
  const own = node.data.slice(0, offset);
  const text = own.length >= chars ? own : collect(node, -1, chars - own.length) + own;
  return text.slice(-chars);
}

function textAfter(node: Text, end: number, chars: number): string {
  const own = node.data.slice(end);
  const text = own.length >= chars ? own : own + collect(node, 1, chars - own.length);
  return text.slice(0, chars);
}

const squash = (s: string) => s.replace(/\s+/g, " ");

/** About 15 characters either side of the match, for the popup. */
export function snippetAround(node: Text, offset: number, length: number, side = 15): string {
  const before = squash(textBefore(node, offset, side * 4));
  const after = squash(textAfter(node, offset + length, side * 4));
  const head = before.length > side ? `…${before.slice(-side)}` : before;
  const tail = after.length > side ? `${after.slice(0, side)}…` : after;
  return (head + node.data.slice(offset, offset + length) + tail).trim();
}

function span(cell: Element): number {
  const raw = cell.getAttribute("colspan") ?? cell.getAttribute("aria-colspan");
  const n = raw === null ? 1 : Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function headerRowFor(cell: Element): Element | null {
  const table = cell.closest("table");
  if (table && cell.matches("td,th")) {
    const head = table.tHead?.rows[0];
    if (head) return head;
    for (const row of Array.from(table.rows)) {
      if (row.cells.length > 0 && Array.from(row.cells).every((c) => c.tagName === "TH")) return row;
    }
    return null;
  }
  const grid = cell.closest("[role=table],[role=grid],[role=treegrid]");
  if (!grid) return null;
  return Array.from(grid.querySelectorAll("[role=row]")).find((r) => r.querySelector("[role=columnheader]")) ?? null;
}

/** Text of the header cell above `node`'s table column (colspans accounted for), or null outside tables. */
export function columnHeaderText(node: Node): string | null {
  const cell = node.parentElement?.closest(CELL_SELECTOR);
  const row = cell?.closest("tr,[role=row]");
  if (!cell || !row) return null;

  let column = 0;
  for (const sibling of Array.from(row.children)) {
    if (sibling === cell) break;
    if (sibling.matches(CELL_SELECTOR) || sibling.matches("[role=columnheader],[role=rowheader]")) column += span(sibling);
  }

  const header = headerRowFor(cell);
  if (!header || header === row) return null;
  let start = 0;
  for (const h of Array.from(header.children)) {
    const width = span(h);
    if (column >= start && column < start + width) return h.textContent?.trim() || null;
    start += width;
  }
  return null;
}

/** Text of the last `h1`–`h4` before `node`; `headings` must be in document order. */
export function sectionHeadingText(node: Node, headings: ArrayLike<Element>): string | null {
  let found: Element | null = null;
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!;
    if (!(h.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
    found = h;
  }
  return found?.textContent?.trim() || null;
}

export function collectContext(
  node: Text,
  offset: number,
  length: number,
  parts: ContextParts,
  chars: number,
  headings: ArrayLike<Element>,
): MatchContext {
  return {
    before: parts.before ? textBefore(node, offset, chars) : null,
    columnHeader: parts.columnHeader ? columnHeaderText(node) : null,
    sectionHeading: parts.sectionHeading ? sectionHeadingText(node, headings) : null,
    snippet: snippetAround(node, offset, length),
  };
}
