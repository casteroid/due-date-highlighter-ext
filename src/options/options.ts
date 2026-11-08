import { HIGHLIGHT_CSS } from "../core/highlightCss";
import { loadSettings, onSettingsChanged, saveSettings } from "../core/storage";
import type { Settings } from "../core/types";
import { renderCriteria } from "./criteria";
import { clear, h, type Save, type Section } from "./dom";
import { renderFormats } from "./formats";
import { renderImportExport } from "./importExport";
import { renderProfiles } from "./profiles";
import { renderRules } from "./rules";

type SectionName = "profiles" | "formats" | "criteria" | "rules" | "importExport";

const SECTIONS: readonly { name: SectionName; render: Section }[] = [
  { name: "profiles", render: renderProfiles },
  { name: "formats", render: renderFormats },
  { name: "criteria", render: renderCriteria },
  { name: "rules", render: renderRules },
  { name: "importExport", render: renderImportExport },
];

/** Sections that show data owned by another section (profile names, custom formats, global keywords...). */
const DEPENDENTS: Partial<Record<SectionName, SectionName[]>> = {
  profiles: ["rules"],
  formats: ["rules"],
  criteria: ["rules"],
};

const FOCUSABLE = "input, select, textarea";

let settings: Settings;
const containers = new Map<SectionName, HTMLElement>();

function focusables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/** Re-render one section; focus goes back to the same field (e.g. the one Tab moved to after a `change`). */
function renderSection(name: SectionName): void {
  const container = containers.get(name);
  const section = SECTIONS.find((s) => s.name === name);
  if (!container || !section) return;

  const active = document.activeElement;
  const focusIndex = active instanceof HTMLElement && container.contains(active) ? focusables(container).indexOf(active) : -1;

  clear(container);
  container.append(section.render(settings, saveFor(name)));

  if (focusIndex >= 0) focusables(container)[focusIndex]?.focus();
}

function saveFor(name: SectionName): Save {
  return async (mutate) => {
    mutate(settings);
    await saveSettings(settings);
    renderSection(name);
    for (const dependent of DEPENDENTS[name] ?? []) renderSection(dependent);
  };
}

function renderAll(): void {
  for (const { name } of SECTIONS) renderSection(name);
}

async function main(): Promise<void> {
  settings = await loadSettings();
  document.head.append(h("style", null, HIGHLIGHT_CSS));

  const app = document.getElementById("app");
  if (!app) return;
  for (const { name } of SECTIONS) {
    const container = h("section", { class: "card", id: name });
    containers.set(name, container);
    app.append(container);
  }
  renderAll();

  // Our own writes come back as storage events too; only a different state (popup, import, reset) re-renders.
  onSettingsChanged((incoming) => {
    if (JSON.stringify(incoming) === JSON.stringify(settings)) return;
    settings = incoming;
    renderAll();
  });
}

void main();
