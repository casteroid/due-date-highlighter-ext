import type { Settings, Tier } from "./types";

const RED = { bgColor: "#fecaca", textColor: "#7f1d1d" };
const ORANGE_RED = { bgColor: "#fed7aa", textColor: "#7c2d12" };
const ORANGE = { bgColor: "#ffedd5", textColor: "#9a3412" };
const YELLOW = { bgColor: "#fef08a", textColor: "#713f12" };
const LIGHT_GREEN = { bgColor: "#d9f99d", textColor: "#365314" };

function tier(
  id: string,
  name: string,
  minDays: number | null,
  maxDays: number | null,
  colours: { bgColor: string; textColor: string },
  enabled = true,
): Tier {
  return { id, name, enabled, minDays, maxDays, ...colours, style: "background", showDaysBadge: true };
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 1,
  tierProfiles: [
    {
      id: "due",
      name: "Due dates",
      badgeStyle: "signed",
      tiers: [
        tier("due-overdue", "Overdue", null, -1, RED),
        tier("due-today", "Today", 0, 0, ORANGE_RED),
        tier("due-3d", "Next 3 days", 1, 3, ORANGE),
        tier("due-week", "This week", 4, 7, YELLOW),
        tier("due-later", "Later", 8, null, LIGHT_GREEN, false),
      ],
    },
    {
      id: "waiting",
      name: "Waiting time",
      badgeStyle: "ago",
      tiers: [
        tier("wait-15", "Waiting 15+ days", null, -15, RED),
        tier("wait-8-14", "Waiting 8–14 days", -14, -8, ORANGE),
        tier("wait-3-7", "Waiting 3–7 days", -7, -3, YELLOW),
        tier("wait-recent", "Recent", -2, 0, LIGHT_GREEN, false),
      ],
    },
  ],
  defaultProfileId: "due",
  formats: {},
  customFormats: [],
  criteria: {
    contextKeywords: [],
    ignoreKeywords: [],
    contextChars: 40,
    context: { before: true, columnHeader: true, sectionHeading: false },
    maxDistanceDays: 365,
    pageLanguages: ["en", "pt", "de", "fr", "es", "it"],
    ambiguousNumeric: "auto",
  },
  siteRules: [],
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function migrate(raw: unknown): Settings {
  if (!isObject(raw) || raw.schemaVersion === undefined) return structuredClone(DEFAULT_SETTINGS);
  switch (raw.schemaVersion) {
    case 1:
    default: {
      const defaults = structuredClone(DEFAULT_SETTINGS);
      const criteria = isObject(raw.criteria) ? raw.criteria : {};
      const context = isObject(criteria.context) ? criteria.context : {};
      return {
        ...defaults,
        ...(raw as Partial<Settings>),
        schemaVersion: 1,
        criteria: {
          ...defaults.criteria,
          ...(criteria as Partial<Settings["criteria"]>),
          context: { ...defaults.criteria.context, ...(context as Partial<Settings["criteria"]["context"]>) },
        },
      };
    }
  }
}

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get("settings");
  return migrate(stored.settings);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

export async function updateSettings(mutate: (s: Settings) => void): Promise<Settings> {
  const settings = await loadSettings();
  mutate(settings);
  await saveSettings(settings);
  return settings;
}

export function onSettingsChanged(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    const change = changes.settings;
    if (area === "local" && change) cb(migrate(change.newValue));
  });
}

export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}
