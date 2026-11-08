import type { Settings } from "../core/types";

export type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;
export type Child = Node | string | number | null | undefined | false;

/** Mutates the current settings, saves them, and re-renders the owning section (and its dependants). */
export type Save = (mutate: (s: Settings) => void) => Promise<void>;
export type Section = (settings: Settings, save: Save) => HTMLElement;

/** Attributes applied as DOM properties, after the children exist (a <select> value needs its options). */
const PROPS: Record<string, true> = { checked: true, disabled: true, value: true, selected: true, open: true, readOnly: true, hidden: true };

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const props: [string, string | number | boolean][] = [];
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined) continue;
    if (typeof value === "function") {
      if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    } else if (key === "class") {
      el.className = String(value);
    } else if (key === "style") {
      el.style.cssText = String(value);
    } else if (key in PROPS) {
      props.push([key, value]);
    } else if (value !== false) {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) el.append(typeof child === "number" ? String(child) : child);
  }
  for (const [key, value] of props) Reflect.set(el, key, value);
  return el;
}

export function clear(el: Element): void {
  el.replaceChildren();
}

export function textInput(value: string, onCommit: (value: string) => void, attrs: Attrs = {}): HTMLInputElement {
  const el = h("input", { type: "text", value, ...attrs, onchange: () => onCommit(el.value) });
  return el;
}

export function checkbox(checked: boolean, onChange: (checked: boolean) => void, attrs: Attrs = {}): HTMLInputElement {
  const el = h("input", { type: "checkbox", checked, ...attrs, onchange: () => onChange(el.checked) });
  return el;
}

/** Integer input that commits on change, clamps to `min`, and restores the old value on garbage. */
export function intInput(value: number, min: number, onCommit: (value: number) => void): HTMLInputElement {
  const el = h("input", {
    type: "number",
    step: 1,
    min,
    value,
    class: "num",
    onchange: () => {
      const n = Math.round(Number(el.value));
      if (el.value.trim() === "" || !Number.isFinite(n)) {
        el.value = String(value);
        return;
      }
      const clamped = Math.max(min, n);
      el.value = String(clamped);
      onCommit(clamped);
    },
  });
  return el;
}

export type Choice = readonly [value: string, label: string];

export function select(
  choices: readonly Choice[],
  value: string,
  onChange: (value: string) => void,
  attrs: Attrs = {},
): HTMLSelectElement {
  const el = h(
    "select",
    { ...attrs, value, onchange: () => onChange(el.value) },
    ...choices.map(([v, label]) => h("option", { value: v }, label)),
  );
  return el;
}

/** inherit (undefined) / on / off. */
export function triState(value: boolean | undefined, onChange: (value: boolean | undefined) => void): HTMLSelectElement {
  const toValue = (v: boolean | undefined) => (v === undefined ? "inherit" : v ? "on" : "off");
  return select(
    [
      ["inherit", "Inherit"],
      ["on", "On"],
      ["off", "Off"],
    ],
    toValue(value),
    (v) => onChange(v === "inherit" ? undefined : v === "on"),
  );
}

export function labelled(text: string, control: Node): HTMLLabelElement {
  return h("label", { class: "inline" }, control, text);
}
