import { DEFAULT_SETTINGS, migrate, saveSettings } from "../core/storage";
import type { Settings } from "../core/types";
import { h } from "./dom";

const FILE_NAME = "due-date-highlighter-settings.json";

/** The last outcome is kept here because a successful import re-renders the whole page. */
let outcome: { message: string; isError: boolean } | null = null;

function parseSettingsFile(text: string): Settings {
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== "object" || raw === null || !("schemaVersion" in raw)) throw new Error("not a settings file");
  return migrate(raw);
}

function download(settings: Settings): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" }));
  const link = h("a", { href: url, download: FILE_NAME });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Writes straight to storage instead of going through `save`: the resulting storage event differs from the
 * in-memory settings, so options.ts re-renders every section.
 */
export function renderImportExport(settings: Settings): HTMLElement {
  const status = h("p");
  const report = (message: string, isError: boolean) => {
    outcome = { message, isError };
    show();
  };
  const show = () => {
    status.textContent = outcome?.message ?? "";
    status.className = outcome?.isError ? "error" : "muted";
    status.hidden = outcome === null;
  };

  const file = h("input", {
    type: "file",
    accept: "application/json",
    hidden: true,
    onchange: async () => {
      const [picked] = file.files ?? [];
      file.value = "";
      if (!picked) return;
      try {
        const imported = parseSettingsFile(await picked.text());
        report(`Imported ${picked.name}.`, false);
        await saveSettings(imported);
      } catch (e) {
        report(`Could not import ${picked.name}: ${e instanceof Error ? e.message : String(e)}`, true);
      }
    },
  });

  show();
  return h(
    "div",
    null,
    h("h2", null, "Import, export and reset"),
    h("p", { class: "help" }, "Settings are one JSON file. Importing replaces everything; missing values fall back to the defaults."),
    h(
      "div",
      { class: "row wrap" },
      h("button", { type: "button", onclick: () => download(settings) }, "Export settings"),
      h("button", { type: "button", onclick: () => file.click() }, "Import settings…"),
      h(
        "button",
        {
          type: "button",
          class: "danger",
          onclick: async () => {
            if (!confirm("Reset all settings to the defaults? Profiles, formats, criteria and site rules will be replaced.")) return;
            report("Settings reset.", false);
            await saveSettings(structuredClone(DEFAULT_SETTINGS));
          },
        },
        "Reset to defaults",
      ),
    ),
    file,
    status,
  );
}
