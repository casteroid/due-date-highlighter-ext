import { badgeLabel } from "../core/dates";
import { newId } from "../core/storage";
import { tierRangeWarnings } from "../core/tiers";
import type { BadgeStyle, Settings, Tier, TierProfile, TierStyle } from "../core/types";
import { checkbox, clear, h, select, textInput, type Choice, type Save } from "./dom";

const TIER_STYLES: readonly Choice[] = [
  ["background", "Background"],
  ["underline", "Underline"],
  ["outline", "Outline"],
  ["badge", "Badge"],
];

const BADGE_STYLES: readonly Choice[] = [
  ["signed", "Signed: -3d / +5d"],
  ["ago", "Ago: 3d ago / in 5d"],
];

/** Which profile tab is open; survives re-renders. */
let selectedId: string | null = null;

function newTier(): Tier {
  return {
    id: newId(),
    name: "New tier",
    enabled: true,
    minDays: null,
    maxDays: null,
    bgColor: "#e5e7eb",
    textColor: "#111827",
    style: "background",
    showDaysBadge: true,
  };
}

function newProfile(): TierProfile {
  return { id: newId(), name: "New profile", badgeStyle: "signed", tiers: [newTier()] };
}

function duplicate(profile: TierProfile): TierProfile {
  const copy = structuredClone(profile);
  copy.id = newId();
  copy.name = `${profile.name} copy`;
  for (const tier of copy.tiers) tier.id = newId();
  return copy;
}

function previewAttrs(profile: TierProfile, tier: Tier) {
  return {
    class: `ddh-${tier.style}`,
    style: `--ddh-bg:${tier.bgColor};--ddh-fg:${tier.textColor}`,
    "data-ddh-badge": tier.showDaysBadge ? badgeLabel(3, profile.badgeStyle) : null,
  };
}

/** Empty input = unbounded (null). */
function daysInput(value: number | null, placeholder: string, label: string, onCommit: (v: number | null) => void) {
  const el = h("input", {
    type: "number",
    step: 1,
    class: "num",
    placeholder,
    "aria-label": label,
    value: value ?? "",
    onchange: () => {
      const raw = el.value.trim();
      if (raw === "") return onCommit(null);
      const n = Math.trunc(Number(raw));
      if (Number.isFinite(n)) onCommit(n);
      else el.value = value === null ? "" : String(value);
    },
  });
  return el;
}

function colourInput(value: string, label: string, onLive: (v: string) => void, onCommit: (v: string) => void) {
  const el = h("input", {
    type: "color",
    value,
    title: label,
    "aria-label": label,
    oninput: () => onLive(el.value),
    onchange: () => onCommit(el.value),
  });
  return el;
}

function cell(...children: Node[]): HTMLTableCellElement {
  return h("td", null, ...children);
}

function tierRow(profile: TierProfile, tier: Tier, index: number, save: Save): HTMLTableRowElement {
  const editProfile = (fn: (p: TierProfile) => void) =>
    save((s) => {
      const p = s.tierProfiles.find((x) => x.id === profile.id);
      if (p) fn(p);
    });
  const editTier = (fn: (t: Tier) => void) =>
    editProfile((p) => {
      const t = p.tiers.find((x) => x.id === tier.id);
      if (t) fn(t);
    });
  const move = (by: -1 | 1) =>
    editProfile((p) => {
      const from = p.tiers.findIndex((x) => x.id === tier.id);
      const moved = p.tiers[from];
      if (!moved || from + by < 0 || from + by >= p.tiers.length) return;
      p.tiers.splice(from, 1);
      p.tiers.splice(from + by, 0, moved);
    });

  const chip = h("span", previewAttrs(profile, tier), "Oct 25, 2026");

  return h(
    "tr",
    { class: tier.enabled ? "" : "disabled-row" },
    cell(checkbox(tier.enabled, (v) => editTier((t) => (t.enabled = v)), { title: "Enabled", "aria-label": "Enabled" })),
    cell(textInput(tier.name, (v) => editTier((t) => (t.name = v.trim() || t.name)), { "aria-label": "Tier name" })),
    cell(daysInput(tier.minDays, "-∞", "From day", (v) => editTier((t) => (t.minDays = v)))),
    cell(daysInput(tier.maxDays, "+∞", "To day", (v) => editTier((t) => (t.maxDays = v)))),
    cell(
      colourInput(
        tier.bgColor,
        "Background colour",
        (v) => chip.style.setProperty("--ddh-bg", v),
        (v) => editTier((t) => (t.bgColor = v)),
      ),
    ),
    cell(
      colourInput(
        tier.textColor,
        "Text colour",
        (v) => chip.style.setProperty("--ddh-fg", v),
        (v) => editTier((t) => (t.textColor = v)),
      ),
    ),
    cell(select(TIER_STYLES, tier.style, (v) => editTier((t) => (t.style = v as TierStyle)), { "aria-label": "Style" })),
    cell(
      checkbox(tier.showDaysBadge, (v) => editTier((t) => (t.showDaysBadge = v)), {
        title: "Show days badge",
        "aria-label": "Show days badge",
      }),
    ),
    cell(chip),
    h(
      "td",
      { class: "actions" },
      h("button", { type: "button", title: "Move up", disabled: index === 0, onclick: () => move(-1) }, "↑"),
      h("button", { type: "button", title: "Move down", onclick: () => move(1) }, "↓"),
      h(
        "button",
        {
          type: "button",
          class: "danger",
          title: "Delete tier",
          onclick: () => editProfile((p) => (p.tiers = p.tiers.filter((x) => x.id !== tier.id))),
        },
        "✕",
      ),
    ),
  );
}

function tierTable(profile: TierProfile, save: Save): HTMLElement {
  const head = ["On", "Name", "From day", "To day", "Background", "Text", "Style", "Badge", "Preview", ""];
  const rows = profile.tiers.map((tier, i) => tierRow(profile, tier, i, save));
  // The last "down" button has nothing to swap with.
  const lastDown = rows[rows.length - 1]?.querySelector<HTMLButtonElement>("button[title='Move down']");
  if (lastDown) lastDown.disabled = true;
  return h(
    "table",
    { class: "tiers" },
    h("thead", null, h("tr", null, ...head.map((t) => h("th", null, t)))),
    h("tbody", null, ...rows),
  );
}

function profileEditor(settings: Settings, profile: TierProfile, save: Save, choose: (id: string) => void): HTMLElement {
  const editProfile = (fn: (p: TierProfile) => void) =>
    save((s) => {
      const p = s.tierProfiles.find((x) => x.id === profile.id);
      if (p) fn(p);
    });
  const isLast = settings.tierProfiles.length <= 1;

  const toolbar = h(
    "div",
    { class: "row wrap" },
    h(
      "button",
      {
        type: "button",
        onclick: () => {
          const name = prompt("Profile name", profile.name)?.trim();
          if (name) void editProfile((p) => (p.name = name));
        },
      },
      "Rename",
    ),
    h(
      "button",
      {
        type: "button",
        onclick: () => {
          const copy = duplicate(profile);
          choose(copy.id);
          void save((s) => {
            const at = s.tierProfiles.findIndex((p) => p.id === profile.id);
            s.tierProfiles.splice(at + 1, 0, copy);
          });
        },
      },
      "Duplicate",
    ),
    h(
      "button",
      {
        type: "button",
        class: "danger",
        disabled: isLast,
        title: isLast ? "At least one profile is required" : "Delete this profile",
        onclick: () => {
          if (!confirm(`Delete profile "${profile.name}"?`)) return;
          const first = settings.tierProfiles.find((p) => p.id !== profile.id);
          if (first) choose(first.id);
          void save((s) => {
            s.tierProfiles = s.tierProfiles.filter((p) => p.id !== profile.id);
            const [fallback] = s.tierProfiles;
            if (s.defaultProfileId === profile.id && fallback) s.defaultProfileId = fallback.id;
          });
        },
      },
      "Delete",
    ),
    h(
      "label",
      { class: "inline" },
      h("input", {
        type: "radio",
        name: "default-profile",
        checked: settings.defaultProfileId === profile.id,
        onchange: () => void save((s) => (s.defaultProfileId = profile.id)),
      }),
      "Default profile",
    ),
    h(
      "label",
      { class: "inline" },
      "Badge text",
      select(BADGE_STYLES, profile.badgeStyle, (v) => void editProfile((p) => (p.badgeStyle = v as BadgeStyle))),
    ),
  );

  const warnings = tierRangeWarnings(profile.tiers).map((w) => h("p", { class: "warning" }, w));

  return h(
    "div",
    null,
    toolbar,
    h("p", { class: "note" }, "Tiers are checked top to bottom; the first match wins. Days are counted from today: negative = past, empty = unbounded."),
    ...warnings,
    tierTable(profile, save),
    h(
      "button",
      { type: "button", onclick: () => void editProfile((p) => p.tiers.push(newTier())) },
      "Add tier",
    ),
  );
}

export function renderProfiles(settings: Settings, save: Save): HTMLElement {
  const root = h("div");

  const draw = () => {
    clear(root);
    const profile = settings.tierProfiles.find((p) => p.id === selectedId) ?? settings.tierProfiles[0];
    selectedId = profile?.id ?? null;

    const tabs = h(
      "div",
      { class: "tabs", role: "tablist" },
      ...settings.tierProfiles.map((p) =>
        h(
          "button",
          {
            type: "button",
            role: "tab",
            class: p.id === profile?.id ? "tab selected" : "tab",
            "aria-selected": String(p.id === profile?.id),
            onclick: () => {
              selectedId = p.id;
              draw();
            },
          },
          p.name,
          p.id === settings.defaultProfileId ? h("span", { class: "tag" }, "default") : null,
        ),
      ),
      h(
        "button",
        {
          type: "button",
          class: "tab add",
          onclick: () => {
            const created = newProfile();
            selectedId = created.id;
            void save((s) => s.tierProfiles.push(created));
          },
        },
        "+ Add profile",
      ),
    );

    root.append(
      h("h2", null, "Tier profiles"),
      h("p", { class: "help" }, "A profile maps how far a date is from today to a colour. Site rules pick which profile to use."),
      tabs,
      ...(profile ? [profileEditor(settings, profile, save, (id) => (selectedId = id))] : []),
    );
  };

  draw();
  return root;
}
