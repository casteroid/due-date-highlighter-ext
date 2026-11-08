import { collectContext, snippetAround } from "./context";
import { evaluateCriteria } from "./criteria";
import { badgeLabel, relativeLabel } from "./dates";
import type { DateFormat, FindContext } from "./formats";
import { HIGHLIGHT_CSS } from "./highlightCss";
import { buildNameTables, languageForNode, resolveAmbiguous, type NameTables } from "./languages";
import type { MatchInfo } from "./messages";
import { findDates, type ParsedMatch } from "./parse";
import type { ResolvedSettings } from "./settings";
import { pickTier } from "./tiers";

export type Deadline = { timeRemaining(): number };

export type ScannerDeps = {
  doc: Document;
  registry: DateFormat[];
  resolved: ResolvedSettings;
  today: () => Date;
  schedule: (run: (deadline: Deadline) => void) => void;
  onScanComplete?: () => void;
};

export const SKIP_SELECTOR = "script,style,noscript,textarea,input,select,code,pre,[contenteditable],[data-ddh]";
const HEADINGS = "h1,h2,h3,h4";
const MIN_NODES_PER_CHUNK = 25;
const DEBOUNCE_MS = 300;
const FLASH_MS = 1100;

/** `origin` is the text node the match was found in; after wrapping it keeps the text before the first match. */
type Entry = { info: MatchInfo; el: HTMLElement | null; origin: Text; index: number };

type ScanRun = {
  generation: number;
  ctx: Omit<FindContext, "lang" | "ambiguous">;
  enabled: DateFormat[];
  disabled: DateFormat[];
  labels: Map<string, string>;
  headings: NodeListOf<Element>;
};

const hasWordChar = /[\p{L}\p{N}]/u;

export class Scanner {
  private deps: ScannerDeps;
  private entries = new Map<string, Entry>();
  private idsByOrigin = new Map<Text, string[]>();
  private counters = new Map<string, number>();
  private generation = 0;
  private observer: MutationObserver | null = null;
  private pendingRoots = new Set<Node>();
  private debounceTimer: number | undefined;

  constructor(deps: ScannerDeps) {
    this.deps = deps;
  }

  setDeps(partial: Partial<ScannerDeps>): void {
    this.deps = { ...this.deps, ...partial };
  }

  /** Scans `root` (default: the body) in idle-time chunks and wraps every date that passes the criteria. */
  scan(root: Node = this.deps.doc.body): Promise<void> {
    const { doc, registry, resolved, today } = this.deps;
    this.installStyle();
    const tables: NameTables = buildNameTables(resolved.pageLanguages);
    const run: ScanRun = {
      generation: this.generation,
      ctx: { tables, today: today() },
      enabled: registry.filter((f) => resolved.formatsEnabled[f.id]),
      disabled: registry.filter((f) => !resolved.formatsEnabled[f.id]),
      labels: new Map(registry.map((f) => [f.id, f.label])),
      headings: doc.querySelectorAll(HEADINGS),
    };
    const nodes = this.collectTextNodes(root);

    const { promise, resolve } = Promise.withResolvers<void>();
    let i = 0;
    const step = (deadline: Deadline) => {
      if (run.generation !== this.generation) return resolve();
      let done = 0;
      while (i < nodes.length && (deadline.timeRemaining() > 2 || done < MIN_NODES_PER_CHUNK)) {
        const node = nodes[i++]!;
        if (node.isConnected && this.accept(node)) this.processNode(node, run);
        done++;
      }
      this.observer?.takeRecords();
      if (i < nodes.length) return this.deps.schedule(step);
      resolve();
      this.deps.onScanComplete?.();
    };
    this.deps.schedule(step);
    return promise;
  }

  /** Removes every highlight and restores the original text nodes. */
  unwrapAll(): void {
    this.generation++;
    const { doc } = this.deps;
    for (const span of Array.from(doc.querySelectorAll<HTMLElement>("span[data-ddh]"))) {
      const parent = span.parentNode;
      span.replaceWith(...Array.from(span.childNodes));
      parent?.normalize();
    }
    doc.querySelector("style[data-ddh]")?.remove();
    this.observer?.takeRecords();
    this.entries.clear();
    this.idsByOrigin.clear();
    this.counters.clear();
  }

  /** Every recorded match still in the page, in document order. */
  getMatches(): MatchInfo[] {
    const live = [...this.entries.values()].filter((e) => (e.el ?? e.origin).isConnected);
    live.sort((a, b) => {
      if (a.origin === b.origin) return a.index - b.index;
      return a.origin.compareDocumentPosition(b.origin) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    return live.map((e) => e.info);
  }

  focus(id: string): boolean {
    const el = this.entries.get(id)?.el;
    if (!el?.isConnected) return false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("ddh-flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("ddh-flash");
    setTimeout(() => el.classList.remove("ddh-flash"), FLASH_MS);
    this.observer?.takeRecords();
    return true;
  }

  /** Watches for page changes (SPAs, delayed content) and scans only what changed, debounced. */
  observe(): void {
    const { doc } = this.deps;
    const View = doc.defaultView;
    if (!View) return;
    this.observer = new View.MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") {
          if (!this.insideHighlight(r.target)) this.pendingRoots.add(r.target);
          continue;
        }
        for (const added of Array.from(r.addedNodes)) {
          if (!this.insideHighlight(added) && !(added instanceof View.Element && added.matches("[data-ddh]"))) {
            this.pendingRoots.add(added);
          }
        }
      }
      if (this.pendingRoots.size === 0) return;
      clearTimeout(this.debounceTimer);
      this.debounceTimer = window.setTimeout(() => this.flushPending(), DEBOUNCE_MS);
    });
    this.observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = undefined;
    this.pendingRoots.clear();
  }

  private async flushPending(): Promise<void> {
    this.debounceTimer = undefined;
    const roots = [...this.pendingRoots].filter((n) => n.isConnected);
    this.pendingRoots.clear();
    const outermost = roots.filter((r) => !roots.some((other) => other !== r && other.contains(r)));
    for (const root of outermost) await this.scan(root);
  }

  private insideHighlight(node: Node): boolean {
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return el?.closest("[data-ddh]") != null;
  }

  private installStyle(): void {
    const { doc } = this.deps;
    if (doc.querySelector("style[data-ddh]")) return;
    const style = doc.createElement("style");
    style.dataset.ddh = "1";
    style.textContent = HIGHLIGHT_CSS;
    (doc.head ?? doc.documentElement).append(style);
  }

  private accept(node: Text): boolean {
    return !node.parentElement?.closest(SKIP_SELECTOR) && hasWordChar.test(node.data);
  }

  private collectTextNodes(root: Node): Text[] {
    if (root.nodeType === Node.TEXT_NODE) return [root as Text];
    const walker = this.deps.doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (this.accept(n as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    return nodes;
  }

  private nextId(formatId: string, text: string): string {
    const key = `${formatId}|${text}`;
    const n = this.counters.get(key) ?? 0;
    this.counters.set(key, n + 1);
    return `${key}#${n}`;
  }

  private forgetOrigin(node: Text): void {
    for (const id of this.idsByOrigin.get(node) ?? []) this.entries.delete(id);
    this.idsByOrigin.delete(node);
  }

  private record(origin: Text, entry: Omit<Entry, "origin">): void {
    this.entries.set(entry.info.id, { ...entry, origin });
    const ids = this.idsByOrigin.get(origin) ?? [];
    ids.push(entry.info.id);
    this.idsByOrigin.set(origin, ids);
  }

  private processNode(node: Text, run: ScanRun): void {
    const { doc, resolved } = this.deps;
    const lang = languageForNode(node, doc);
    const ctx: FindContext = { ...run.ctx, lang, ambiguous: resolveAmbiguous(resolved.ambiguousNumeric, lang) };
    const hits = findDates(node.data, run.enabled, ctx);
    const offHits = findDates(node.data, run.disabled, ctx);
    if (hits.length === 0 && offHits.length === 0) return;
    this.forgetOrigin(node);

    for (const hit of offHits) {
      this.record(node, {
        el: null,
        index: hit.index,
        info: this.info(hit, { status: "format-off", tierId: null, context: snippetAround(node, hit.index, hit.length) }),
      });
    }

    const toWrap: { hit: ParsedMatch; info: MatchInfo }[] = [];
    for (const hit of hits) {
      const mctx = collectContext(node, hit.index, hit.length, resolved.context, resolved.contextChars, run.headings);
      const reason = evaluateCriteria(mctx, hit.daysUntil, resolved);
      const tier = reason ? null : pickTier(resolved.profile, hit.daysUntil);
      const status = reason ? "filtered" : tier ? "highlighted" : "no-tier";
      const info = this.info(hit, { status, tierId: tier?.id ?? null, context: mctx.snippet, reason: reason ?? undefined });
      if (status === "highlighted") toWrap.push({ hit, info });
      else this.record(node, { el: null, index: hit.index, info });
    }

    // Right to left, so earlier offsets stay valid while splitting.
    for (const { hit, info } of toWrap.reverse()) {
      const el = this.wrap(node, hit, info, run);
      this.record(node, { el, index: hit.index, info });
    }
  }

  private info(hit: ParsedMatch, rest: Pick<MatchInfo, "status" | "tierId" | "context" | "reason">): MatchInfo {
    const info: MatchInfo = { id: this.nextId(hit.formatId, hit.text), text: hit.text, daysUntil: hit.daysUntil, formatId: hit.formatId, ...rest };
    if (info.reason === undefined) delete info.reason;
    return info;
  }

  private wrap(node: Text, hit: ParsedMatch, info: MatchInfo, run: ScanRun): HTMLElement {
    const { doc, resolved } = this.deps;
    const tier = resolved.profile.tiers.find((t) => t.id === info.tierId)!;
    node.splitText(hit.index + hit.length);
    const mid = node.splitText(hit.index);
    const span = doc.createElement("span");
    span.dataset.ddh = "1";
    span.dataset.ddhId = info.id;
    span.dataset.ddhTier = tier.id;
    span.dataset.ddhFormat = hit.formatId;
    span.className = `ddh-${tier.style}`;
    span.style.setProperty("--ddh-bg", tier.bgColor);
    span.style.setProperty("--ddh-fg", tier.textColor);
    span.title = `${tier.name} · ${relativeLabel(hit.daysUntil)} · ${run.labels.get(hit.formatId) ?? hit.formatId}`;
    if (tier.showDaysBadge) span.dataset.ddhBadge = badgeLabel(hit.daysUntil, resolved.profile.badgeStyle);
    mid.replaceWith(span);
    span.append(mid);
    return span;
  }
}
