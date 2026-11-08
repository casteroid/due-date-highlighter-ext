import type { ContextParts, Settings } from "../core/types";
import { checkbox, h, intInput, textInput, type Save } from "./dom";

/** "a, b,, c " → ["a", "b", "c"] */
export function parseList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const CONTEXT_PARTS: readonly { key: keyof ContextParts; label: string; help: string }[] = [
  { key: "before", label: "Text before the date", help: "The characters just before the date in the same block, e.g. “Due:”." },
  { key: "columnHeader", label: "Table column header", help: "The header of the table column the date is in, e.g. “Uploaded”." },
  { key: "sectionHeading", label: "Nearest heading above (h1–h4)", help: "The closest heading above the date on the page." },
];

function field(label: string, help: string, control: Node): HTMLElement {
  return h("div", { class: "field" }, h("label", null, h("span", { class: "label" }, label), control), h("p", { class: "help" }, help));
}

export function renderCriteria(settings: Settings, save: Save): HTMLElement {
  const { criteria } = settings;
  return h(
    "div",
    null,
    h("h2", null, "Which dates count"),
    h("p", { class: "help" }, "Keywords are matched as plain text, ignoring case, in the context parts ticked below."),
    field(
      "Context keywords",
      "Comma separated. When set, a date is only highlighted if one of these appears in its context. Empty = every date counts.",
      textInput(criteria.contextKeywords.join(", "), (v) => void save((s) => (s.criteria.contextKeywords = parseList(v))), {
        placeholder: "due, deadline, uploaded",
      }),
    ),
    field(
      "Ignore keywords",
      "Comma separated. A date is skipped if any of these appears in its context, even when a context keyword also matches.",
      textInput(criteria.ignoreKeywords.join(", "), (v) => void save((s) => (s.criteria.ignoreKeywords = parseList(v))), {
        placeholder: "created, updated",
      }),
    ),
    field(
      "Characters of text before the date",
      "How much preceding text counts as context.",
      intInput(criteria.contextChars, 1, (v) => void save((s) => (s.criteria.contextChars = v))),
    ),
    field(
      "Maximum distance (days)",
      "Dates further than this from today, in either direction, are ignored.",
      intInput(criteria.maxDistanceDays, 0, (v) => void save((s) => (s.criteria.maxDistanceDays = v))),
    ),
    h("h3", null, "Context parts"),
    ...CONTEXT_PARTS.map(({ key, label, help }) =>
      h(
        "div",
        { class: "field" },
        h("label", { class: "inline" }, checkbox(criteria.context[key], (v) => void save((s) => (s.criteria.context[key] = v))), label),
        h("p", { class: "help" }, help),
      ),
    ),
  );
}
