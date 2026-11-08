import { buildRegistry } from "../core/customFormats";
import { badgeLabel, relativeLabel } from "../core/dates";
import type { DateFormat } from "../core/formats";
import { buildNameTables } from "../core/languages";
import type { InjectResponse, MatchInfo, Message, PageState } from "../core/messages";
import { resolveSettings, type ResolvedSettings } from "../core/settings";
import { findMatchingRule, isSupportedUrl, pagePatternForTab, sitePatternForTab, toOrigin } from "../core/sites";
import { loadSettings, newId, onSettingsChanged, updateSettings } from "../core/storage";
import type { Settings, SiteRule } from "../core/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const header = $("header");
const status = $("status");
const chips = $("chips");
const list = $<HTMLUListElement>("list");
const empty = $("empty");
const formatsBox = $<HTMLDetailsElement>("formats");
const formatRows = $("format-rows");
const showAllFormats = $<HTMLButtonElement>("show-all-formats");

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

type State = {
  tab: chrome.tabs.Tab & { id: number; url: string };
  settings: Settings;
  registry: DateFormat[];
  rule: SiteRule | undefined;
  resolved: ResolvedSettings | null;
  matches: MatchInfo[];
};

let state: State | null = null;
let filterTier: string | null = null;
let selected = 0;
let showAll = false;

function sendToTab<T>(message: Message): Promise<T | null> {
  if (!state) return Promise.resolve(null);
  return chrome.tabs.sendMessage<Message, T>(state.tab.id, message).catch(() => null);
}

async function loadState(tab: State["tab"]): Promise<State> {
  const settings = await loadSettings();
  const registry = buildRegistry(settings.customFormats, buildNameTables(settings.criteria.pageLanguages));
  return {
    tab,
    settings,
    registry,
    rule: findMatchingRule(settings.siteRules, tab.url),
    resolved: resolveSettings(settings, tab.url, registry),
    matches: state?.matches ?? [],
  };
}

async function enable(pattern: string): Promise<void> {
  const origin = toOrigin(pattern);
  if (!origin || !state) return;
  // Must be the first await: the permission prompt needs the click's user gesture.
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) {
    status.textContent = "Permission denied, so the extension cannot run here.";
    return;
  }
  await updateSettings((s) => {
    const existing = s.siteRules.find((r) => r.pattern === pattern);
    if (existing) existing.enabled = true;
    else s.siteRules.push({ id: newId(), pattern, enabled: true });
  });
  const res = await chrome.runtime.sendMessage<Message, InjectResponse>({ type: "injectIntoTab", tabId: state.tab.id });
  status.textContent = res.ok ? "" : `Could not start on this page: ${res.error}`;
  await reload();
}

function renderHeader(s: State): void {
  header.replaceChildren();
  if (!s.rule) {
    header.append(
      el("span", { className: "site", textContent: `Not active on ${sitePatternForTab(s.tab.url)}` }),
      el("button", { type: "button", textContent: "Enable on this site", onclick: () => void enable(sitePatternForTab(s.tab.url)) }),
      el("button", { type: "button", textContent: "Enable on this page only", onclick: () => void enable(pagePatternForTab(s.tab.url)) }),
    );
    return;
  }
  const ruleId = s.rule.id;
  const profileSelect = el(
    "select",
    {
      title: "Tier profile for this rule",
      onchange: () =>
        void updateSettings((st) => {
          const r = st.siteRules.find((x) => x.id === ruleId);
          if (r) r.tierProfileId = profileSelect.value;
        }),
    },
    ...s.settings.tierProfiles.map((p) => el("option", { value: p.id, textContent: p.name })),
  );
  profileSelect.value = s.resolved?.profile.id ?? s.settings.defaultProfileId;
  header.append(
    el("span", { className: "site", title: s.rule.pattern, textContent: `Active on ${s.rule.pattern}` }),
    profileSelect,
    el("button", {
      type: "button",
      textContent: "Disable here",
      onclick: () =>
        void updateSettings((st) => {
          const r = st.siteRules.find((x) => x.id === ruleId);
          if (r) r.enabled = false;
        }),
    }),
  );
}

function highlighted(s: State): MatchInfo[] {
  return s.matches.filter((m) => m.status === "highlighted");
}

function renderChips(s: State): void {
  chips.replaceChildren();
  if (!s.resolved) return;
  const counts = new Map<string, number>();
  for (const m of highlighted(s)) if (m.tierId) counts.set(m.tierId, (counts.get(m.tierId) ?? 0) + 1);
  for (const tier of s.resolved.profile.tiers.filter((t) => t.enabled)) {
    const chip = el("button", {
      type: "button",
      className: `chip${filterTier === tier.id ? " active" : ""}${filterTier && filterTier !== tier.id ? " dim" : ""}`,
      textContent: `${tier.name} (${counts.get(tier.id) ?? 0})`,
      onclick: () => {
        filterTier = filterTier === tier.id ? null : tier.id;
        selected = 0;
        render();
      },
    });
    chip.style.background = tier.bgColor;
    chip.style.color = tier.textColor;
    chips.append(chip);
  }
}

function focusMatch(id: string): void {
  void sendToTab<boolean>({ type: "focusMatch", id });
}

function renderList(s: State): void {
  list.replaceChildren();
  const tiers = new Map(s.resolved?.profile.tiers.map((t) => [t.id, t]));
  const badgeStyle = s.resolved?.profile.badgeStyle ?? "signed";
  const rows = highlighted(s).filter((m) => !filterTier || m.tierId === filterTier);
  selected = Math.min(selected, Math.max(rows.length - 1, 0));

  rows.forEach((m, i) => {
    const dot = el("span", { className: "dot" });
    dot.style.background = (m.tierId && tiers.get(m.tierId)?.bgColor) || "transparent";
    const li = el(
      "li",
      { className: i === selected ? "selected" : "", title: m.context, onclick: () => select(i, true) },
      dot,
      el("span", { className: "text", textContent: m.text }),
      el("span", { className: "days", textContent: badgeLabel(m.daysUntil, badgeStyle) }),
      el("span", { className: "meta", textContent: `${relativeLabel(m.daysUntil)} · ${m.context}` }),
    );
    li.dataset.id = m.id;
    list.append(li);
  });

  empty.hidden = rows.length > 0 || !s.resolved;
  empty.replaceChildren();
  if (rows.length === 0 && s.resolved) {
    empty.append(el("p", { textContent: filterTier ? "No dates in this tier" : "No dates found" }));
    const keywords = s.resolved.contextKeywords;
    if (keywords.length > 0) {
      empty.append(
        el("p", { textContent: `Context keywords are set (${keywords.join(", ")}): dates without one of them nearby are hidden.` }),
      );
    }
  }
}

function select(index: number, jump: boolean): void {
  const items = list.querySelectorAll<HTMLLIElement>("li");
  if (items.length === 0) return;
  selected = Math.max(0, Math.min(index, items.length - 1));
  items.forEach((li, i) => li.classList.toggle("selected", i === selected));
  const li = items[selected]!;
  li.scrollIntoView({ block: "nearest" });
  if (jump && li.dataset.id) focusMatch(li.dataset.id);
}

list.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") select(selected + 1, false);
  else if (e.key === "ArrowUp") select(selected - 1, false);
  else if (e.key === "Enter") select(selected, true);
  else return;
  e.preventDefault();
});

function renderFormats(s: State): void {
  formatsBox.hidden = !s.rule || !s.resolved;
  formatRows.replaceChildren();
  if (!s.rule || !s.resolved) return;
  const ruleId = s.rule.id;
  const resolved = s.resolved;

  const found = new Map<string, { example: string; count: number }>();
  for (const m of s.matches) {
    const entry = found.get(m.formatId) ?? { example: m.text, count: 0 };
    entry.count++;
    found.set(m.formatId, entry);
  }
  const formats = s.registry.filter((f) => showAll || found.has(f.id));

  for (const f of formats) {
    const info = found.get(f.id);
    const checkbox = el("input", {
      type: "checkbox",
      checked: resolved.formatsEnabled[f.id] ?? f.defaultEnabled,
      title: "On for this site",
      onchange: () =>
        void updateSettings((st) => {
          const r = st.siteRules.find((x) => x.id === ruleId);
          if (r) r.formats = { ...r.formats, [f.id]: checkbox.checked };
        }),
    });
    formatRows.append(
      el(
        "label",
        { className: "format-row" },
        checkbox,
        el(
          "span",
          {},
          f.label,
          el("br"),
          el("span", { className: "example", textContent: info?.example ?? f.examples[0] ?? "" }),
        ),
        el("span", { className: "count", textContent: String(info?.count ?? 0) }),
      ),
    );
  }
  if (formats.length === 0) formatRows.append(el("p", { className: "example", textContent: "No dates found in any format." }));
  showAllFormats.hidden = showAll;
}

function render(): void {
  if (!state) return;
  renderHeader(state);
  renderChips(state);
  renderList(state);
  renderFormats(state);
}

async function refreshMatches(): Promise<void> {
  if (!state) return;
  const page = await sendToTab<PageState>({ type: "getMatches" });
  state.matches = page?.matches ?? [];
  render();
}

async function reload(): Promise<void> {
  if (!state) return;
  state = await loadState(state.tab);
  await refreshMatches();
}

showAllFormats.addEventListener("click", () => {
  showAll = true;
  render();
});
$("rescan").addEventListener("click", () => void sendToTab<boolean>({ type: "rescan" }));
$("settings").addEventListener("click", () => void chrome.runtime.openOptionsPage());

async function init(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !isSupportedUrl(tab.url)) {
    header.replaceChildren(el("span", { className: "site", textContent: "Not available on this page" }));
    for (const id of ["chips", "list", "empty", "formats", "rescan"]) $(id).hidden = true;
    return;
  }
  state = await loadState({ ...tab, id: tab.id, url: tab.url });
  render();
  await refreshMatches();
  list.focus();
}

chrome.runtime.onMessage.addListener((message: Message, sender) => {
  if (message.type === "scanComplete" && sender.tab?.id === state?.tab.id) void refreshMatches();
});
onSettingsChanged(() => void reload());

void init();
