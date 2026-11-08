import { buildRegistry } from "../core/customFormats";
import { buildNameTables } from "../core/languages";
import { newId } from "../core/storage";
import { toMatchPattern, toOrigin } from "../core/sites";
import type { AmbiguousNumeric, ContextParts, Settings, SiteRule } from "../core/types";
import { parseList } from "./criteria";
import { canonicalTag, AMBIGUOUS_CHOICES } from "./formats";
import { checkbox, h, labelled, select, textInput, triState, type Choice, type Save } from "./dom";

const PATTERN_HINT =
  "example.com = that host; *.example.com = the domain and all subdomains; https://site/path* = URL prefix (query and hash ignored).";
const DENIED = "Permission not granted; enable it from the popup on that site.";

const CONTEXT_LABELS: readonly { key: keyof ContextParts; label: string }[] = [
  { key: "before", label: "Text before the date" },
  { key: "columnHeader", label: "Table column header" },
  { key: "sectionHeading", label: "Nearest heading above" },
];

/** Survive re-renders: which rule cards are expanded, and the last add-rule outcome. */
const openRules = new Set<string>();
let notice = "";

/** Sets or removes one key; returns undefined when the record ends up empty, so the caller can drop it. */
function withFlag(current: Record<string, boolean> | undefined, key: string, value: boolean | undefined) {
  const next = { ...current };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return Object.keys(next).length > 0 ? next : undefined;
}

function field(label: string, control: Node, note?: Node | null): HTMLElement {
  return h("div", { class: "field" }, h("label", null, h("span", { class: "label" }, label), control), note);
}

function keywordOverride(
  label: string,
  value: string[] | undefined,
  inherited: string[],
  onChange: (v: string[] | undefined) => void,
): HTMLElement {
  const input = textInput(value?.join(", ") ?? "", (v) => onChange(parseList(v)), {
    placeholder: inherited.length > 0 ? inherited.join(", ") : "(none)",
    disabled: value === undefined,
  });
  const inherit = labelled("Inherit", checkbox(value === undefined, (checked) => onChange(checked ? undefined : [])));
  return h("div", { class: "field" }, h("span", { class: "label" }, label), h("div", { class: "row" }, input, inherit));
}

function languagesOverride(rule: SiteRule, inherited: string[], edit: (fn: (r: SiteRule) => void) => Promise<void>) {
  const error = h("p", { class: "error", hidden: true });
  const input = textInput(rule.pageLanguages?.join(", ") ?? "", (raw) => {
    const tags = parseList(raw).map((t) => ({ raw: t, tag: canonicalTag(t) }));
    const bad = tags.find((t) => t.tag === null);
    if (bad) {
      error.textContent = `“${bad.raw}” is not a valid language tag.`;
      error.hidden = false;
      return;
    }
    const unique = [...new Set(tags.flatMap((t) => (t.tag ? [t.tag] : [])))];
    void edit((r) => {
      if (unique.length > 0) r.pageLanguages = unique;
      else delete r.pageLanguages;
    });
  }, { placeholder: inherited.join(", ") });
  const help = h("p", { class: "help" }, "Comma separated. Empty = inherit. English is always on.");
  return field("Page languages", input, h("div", null, help, error));
}

function overrides(settings: Settings, rule: SiteRule, save: Save): HTMLElement {
  const { criteria } = settings;
  const registry = buildRegistry(settings.customFormats, buildNameTables(criteria.pageLanguages));
  const edit = (fn: (r: SiteRule) => void) =>
    save((s) => {
      const r = s.siteRules.find((x) => x.id === rule.id);
      if (r) fn(r);
    });

  const profileChoices: Choice[] = [["", "Default"], ...settings.tierProfiles.map((p): Choice => [p.id, p.name])];
  const ambiguousChoices: Choice[] = [["", "Inherit"], ...AMBIGUOUS_CHOICES];

  const formatRows = registry.map((format) =>
    h(
      "div",
      { class: "override" },
      h("span", null, format.label),
      triState(rule.formats?.[format.id], (v) =>
        void edit((r) => {
          const next = withFlag(r.formats, format.id, v);
          if (next) r.formats = next;
          else delete r.formats;
        }),
      ),
    ),
  );

  const contextRows = CONTEXT_LABELS.map(({ key, label }) =>
    h(
      "div",
      { class: "override" },
      h("span", null, label),
      triState(rule.context?.[key], (v) =>
        void edit((r) => {
          const next = withFlag(r.context, key, v);
          if (next) r.context = next;
          else delete r.context;
        }),
      ),
    ),
  );

  return h(
    "div",
    { class: "overrides" },
    field(
      "Tier profile",
      select(profileChoices, rule.tierProfileId ?? "", (v) =>
        void edit((r) => {
          if (v) r.tierProfileId = v;
          else delete r.tierProfileId;
        }),
      ),
    ),
    h("h4", null, "Date formats"),
    h("div", { class: "override-grid" }, ...formatRows),
    keywordOverride("Context keywords", rule.contextKeywords, criteria.contextKeywords, (v) =>
      void edit((r) => {
        if (v) r.contextKeywords = v;
        else delete r.contextKeywords;
      }),
    ),
    keywordOverride("Ignore keywords", rule.ignoreKeywords, criteria.ignoreKeywords, (v) =>
      void edit((r) => {
        if (v) r.ignoreKeywords = v;
        else delete r.ignoreKeywords;
      }),
    ),
    languagesOverride(rule, criteria.pageLanguages, edit),
    field(
      "Ambiguous numeric dates",
      select(ambiguousChoices, rule.ambiguousNumeric ?? "", (v) =>
        void edit((r) => {
          if (v) r.ambiguousNumeric = v as AmbiguousNumeric;
          else delete r.ambiguousNumeric;
        }),
      ),
    ),
    h("h4", null, "Context parts"),
    h("div", { class: "override-grid" }, ...contextRows),
  );
}

function ruleCard(settings: Settings, rule: SiteRule, save: Save): HTMLElement {
  const edit = (fn: (r: SiteRule) => void) =>
    save((s) => {
      const r = s.siteRules.find((x) => x.id === rule.id);
      if (r) fn(r);
    });

  const pattern = textInput(
    rule.pattern,
    (v) => {
      const trimmed = v.trim();
      if (trimmed) void edit((r) => (r.pattern = trimmed));
      else pattern.value = rule.pattern;
    },
    { class: "grow mono", "aria-label": "Pattern", spellcheck: "false" },
  );

  const details = h(
    "details",
    {
      open: openRules.has(rule.id),
      ontoggle: () => {
        if (details.open) openRules.add(rule.id);
        else openRules.delete(rule.id);
      },
    },
    h("summary", null, "Overrides"),
    overrides(settings, rule, save),
  );

  return h(
    "div",
    { class: rule.enabled ? "rule" : "rule off" },
    h(
      "div",
      { class: "row" },
      checkbox(rule.enabled, (v) => void edit((r) => (r.enabled = v)), { title: "Enabled", "aria-label": "Enabled" }),
      pattern,
      h(
        "button",
        {
          type: "button",
          class: "danger",
          title: "Delete rule",
          onclick: () => {
            openRules.delete(rule.id);
            void save((s) => (s.siteRules = s.siteRules.filter((r) => r.id !== rule.id)));
          },
        },
        "✕",
      ),
    ),
    toMatchPattern(rule.pattern) === null ? h("p", { class: "warning" }, "Cannot register this pattern") : null,
    details,
  );
}

function addForm(save: Save): HTMLElement {
  const input = h("input", {
    type: "text",
    class: "grow mono",
    placeholder: "example.com",
    "aria-label": "New rule pattern",
    spellcheck: "false",
    onkeydown: (e) => {
      if ((e as KeyboardEvent).key === "Enter") add();
    },
  });

  const add = () => {
    const pattern = input.value.trim();
    if (!pattern) return;
    // permissions.request needs the user gesture, so it must start before any await.
    const origin = toOrigin(pattern);
    const request = origin ? chrome.permissions.request({ origins: [origin] }) : Promise.resolve(true);
    void request
      .catch(() => false)
      .then((granted) => {
        notice = granted ? "" : DENIED;
        return save((s) => s.siteRules.push({ id: newId(), pattern, enabled: true }));
      });
  };

  return h("div", { class: "row" }, input, h("button", { type: "button", onclick: add }, "Add rule"));
}

export function renderRules(settings: Settings, save: Save): HTMLElement {
  const message = notice;
  notice = "";
  return h(
    "div",
    null,
    h("h2", null, "Site rules"),
    h("p", { class: "help" }, "The extension only touches pages that match an enabled rule. The most specific matching rule wins."),
    h("p", { class: "help" }, PATTERN_HINT),
    addForm(save),
    message ? h("p", { class: "warning" }, message) : null,
    settings.siteRules.length === 0 ? h("p", { class: "muted" }, "No rules yet. Nothing is highlighted anywhere.") : null,
    ...settings.siteRules.map((rule) => ruleCard(settings, rule, save)),
  );
}
