import { formatYmd } from "../core/dates";
import { buildRegistry, compileCustomFormat, testCustomFormat } from "../core/customFormats";
import { baseLang, buildNameTables } from "../core/languages";
import { formatEnabledGlobally } from "../core/settings";
import { newId } from "../core/storage";
import type { AmbiguousNumeric, CustomFormat, Settings } from "../core/types";
import { checkbox, clear, h, labelled, select, textInput, type Choice, type Save } from "./dom";

export const AMBIGUOUS_CHOICES: readonly Choice[] = [
  ["auto", "Auto (month first for en-US pages, otherwise day first)"],
  ["dmy", "Day first (03/04/2026 = 3 April)"],
  ["mdy", "Month first (03/04/2026 = March 4)"],
];

const PRESET_LANGUAGES: readonly Choice[] = [
  ["pt", "Portuguese"],
  ["de", "German"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["it", "Italian"],
];

const NEW_CUSTOM_PATTERN = "(?<d>\\d{2})\\.(?<m>\\d{2})\\.(?<y>\\d{4})";

/** Tester state lives here so it survives the section re-rendering after a save. */
let testerFormatId: string | null = null;
let testerSample = "";

/** Canonical BCP-47 tag, or null when `tag` is not a valid language tag. */
export function canonicalTag(tag: string): string | null {
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? null;
  } catch {
    return null;
  }
}

function formatList(settings: Settings, save: Save): HTMLElement {
  const registry = buildRegistry(settings.customFormats, buildNameTables(settings.criteria.pageLanguages));
  return h(
    "ul",
    { class: "plain formats" },
    ...registry.map((format) =>
      h(
        "li",
        null,
        labelled(
          format.label,
          checkbox(formatEnabledGlobally(settings, format), (v) =>
            void save((s) => {
              if (v === format.defaultEnabled) delete s.formats[format.id];
              else s.formats[format.id] = v;
            }),
          ),
        ),
        format.examples.length > 0 ? h("span", { class: "examples" }, format.examples.join(", ")) : null,
        format.defaultEnabled ? null : h("span", { class: "tag" }, "off by default"),
      ),
    ),
  );
}

function languages(settings: Settings, save: Save): HTMLElement {
  const langs = settings.criteria.pageLanguages;
  const presetCodes = PRESET_LANGUAGES.map(([code]) => code);
  const extras = langs.filter((l) => {
    const base = baseLang(l);
    return base !== "en" && !presetCodes.includes(base ?? "");
  });
  const error = h("p", { class: "error", hidden: true });

  const add = () => {
    const tag = canonicalTag(input.value.trim());
    const fail = (message: string) => {
      error.textContent = message;
      error.hidden = false;
    };
    if (!tag) return fail("Not a valid language tag. Examples: nl, sv, pt-BR.");
    const base = baseLang(tag);
    if (base === "en" || langs.some((l) => baseLang(l) === base)) return fail("That language is already included.");
    void save((s) => s.criteria.pageLanguages.push(tag));
  };
  const input = h("input", {
    type: "text",
    placeholder: "e.g. nl",
    "aria-label": "Add language tag",
    onkeydown: (e) => {
      if ((e as KeyboardEvent).key === "Enter") add();
    },
  });

  return h(
    "div",
    null,
    h("h3", null, "Page languages"),
    h("p", { class: "help" }, "Month and weekday names are recognised in these languages. English is always on."),
    h(
      "div",
      { class: "row wrap" },
      labelled("English", checkbox(true, () => {}, { disabled: true })),
      ...PRESET_LANGUAGES.map(([code, name]) =>
        labelled(
          name,
          checkbox(
            langs.some((l) => baseLang(l) === code),
            (v) =>
              void save((s) => {
                const rest = s.criteria.pageLanguages.filter((l) => baseLang(l) !== code);
                s.criteria.pageLanguages = v ? [...rest, code] : rest;
              }),
          ),
        ),
      ),
    ),
    extras.length > 0
      ? h(
          "div",
          { class: "row wrap" },
          ...extras.map((tag) =>
            h(
              "span",
              { class: "chip" },
              tag,
              h(
                "button",
                {
                  type: "button",
                  title: `Remove ${tag}`,
                  onclick: () => void save((s) => (s.criteria.pageLanguages = s.criteria.pageLanguages.filter((l) => l !== tag))),
                },
                "✕",
              ),
            ),
          ),
        )
      : null,
    h("div", { class: "row" }, input, h("button", { type: "button", onclick: add }, "Add language")),
    error,
  );
}

function customFormatRows(settings: Settings, save: Save): HTMLElement {
  const tables = buildNameTables(settings.criteria.pageLanguages);
  const edit = (id: string, fn: (cf: CustomFormat) => void) =>
    save((s) => {
      const cf = s.customFormats.find((x) => x.id === id);
      if (cf) fn(cf);
    });

  const rows = settings.customFormats.map((cf) => {
    const compiled = compileCustomFormat(cf, tables);
    return h(
      "div",
      { class: "custom-format" },
      h(
        "div",
        { class: "row" },
        textInput(cf.label, (v) => void edit(cf.id, (c) => (c.label = v.trim())), { placeholder: "Label", "aria-label": "Label" }),
        textInput(cf.pattern, (v) => void edit(cf.id, (c) => (c.pattern = v)), {
          class: "mono grow",
          placeholder: "(?<d>\\d{2})-(?<m>\\d{2})-(?<y>\\d{4})",
          "aria-label": "Pattern",
          spellcheck: "false",
        }),
        h(
          "button",
          {
            type: "button",
            class: "danger",
            title: "Delete custom format",
            onclick: () =>
              void save((s) => {
                const key = `custom:${cf.id}`;
                s.customFormats = s.customFormats.filter((x) => x.id !== cf.id);
                delete s.formats[key];
                for (const rule of s.siteRules) {
                  if (!rule.formats) continue;
                  delete rule.formats[key];
                  if (Object.keys(rule.formats).length === 0) delete rule.formats;
                }
              }),
          },
          "✕",
        ),
      ),
      "error" in compiled ? h("p", { class: "error" }, compiled.error) : null,
    );
  });

  return h(
    "div",
    null,
    ...rows,
    h(
      "button",
      {
        type: "button",
        onclick: () => {
          const cf: CustomFormat = { id: newId(), label: "", pattern: NEW_CUSTOM_PATTERN };
          testerFormatId = cf.id;
          void save((s) => s.customFormats.push(cf));
        },
      },
      "Add custom format",
    ),
  );
}

function matchLine(match: { text: string; date: { y: number; m: number; d: number } | null; reason?: string }): HTMLElement {
  if (match.date) {
    const date = formatYmd(match.date).replace(/^0-/, "????-");
    return h("li", { class: "ok" }, h("code", null, match.text), ` → ${date}`);
  }
  return h("li", { class: "bad" }, h("code", null, match.text), ` ✗ ${match.reason ?? "rejected"}`);
}

function tester(settings: Settings): HTMLElement | null {
  const formats = settings.customFormats;
  const first = formats[0];
  if (!first) return null;
  const tables = buildNameTables(settings.criteria.pageLanguages);
  const results = h("ul", { class: "plain results" });

  const target = () => formats.find((f) => f.id === testerFormatId) ?? first;
  const update = () => {
    clear(results);
    const outcome = testCustomFormat(target(), testerSample, tables);
    if (outcome.error) results.append(h("li", { class: "error" }, outcome.error));
    else if (testerSample && outcome.matches.length === 0) results.append(h("li", { class: "muted" }, "No matches."));
    else results.append(...outcome.matches.map(matchLine));
  };

  testerFormatId = target().id;
  const area = h("textarea", {
    rows: 3,
    value: testerSample,
    placeholder: "Paste some text to test the pattern against",
    oninput: () => {
      testerSample = area.value;
      update();
    },
  });
  const choices: Choice[] = formats.map((f) => [f.id, f.label || f.pattern]);
  update();

  return h(
    "div",
    { class: "tester" },
    h("h4", null, "Test a custom format"),
    h("div", { class: "row" }, select(choices, target().id, (v) => {
      testerFormatId = v;
      update();
    })),
    area,
    results,
  );
}

export function renderFormats(settings: Settings, save: Save): HTMLElement {
  return h(
    "div",
    null,
    h("h2", null, "Date formats"),
    h("p", { class: "help" }, "Turn formats on or off for every site. A site rule can override each one."),
    formatList(settings, save),
    h("h3", null, "Ambiguous numeric dates"),
    h("p", { class: "help" }, "How to read dates such as 03/04/2026 when both day-first and month-first formats are on."),
    select(AMBIGUOUS_CHOICES, settings.criteria.ambiguousNumeric, (v) => void save((s) => (s.criteria.ambiguousNumeric = v as AmbiguousNumeric))),
    languages(settings, save),
    h("h3", null, "Custom formats"),
    h(
      "p",
      { class: "help" },
      "A regular expression with named groups: d (day) and m (month, number or name) are required, y (year) is optional. Matches may not touch a letter or digit.",
    ),
    customFormatRows(settings, save),
    tester(settings),
  );
}
