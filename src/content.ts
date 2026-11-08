import { buildRegistry } from "./core/customFormats";
import { todayKey } from "./core/dates";
import { buildNameTables, detectPageLanguage } from "./core/languages";
import type { Message, PageState } from "./core/messages";
import { Scanner, type Deadline } from "./core/scanner";
import { resolveSettings } from "./core/settings";
import { loadSettings, onSettingsChanged } from "./core/storage";
import type { Settings } from "./core/types";

declare global {
  interface Window {
    __ddh?: boolean;
  }
}

const schedule = (run: (deadline: Deadline) => void) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 500 });
  else setTimeout(() => run({ timeRemaining: () => 8 }), 0);
};

function main(): void {
  let scanner: Scanner | null = null;
  let current: Settings | null = null;
  let lastDay = todayKey(new Date());

  async function apply(settings: Settings): Promise<void> {
    current = settings;
    lastDay = todayKey(new Date());
    scanner?.disconnect();
    scanner?.unwrapAll();
    scanner = null;

    const registry = buildRegistry(settings.customFormats, buildNameTables(settings.criteria.pageLanguages));
    const resolved = resolveSettings(settings, location.href, registry);
    if (!resolved) return;

    const s = new Scanner({
      doc: document,
      registry,
      resolved,
      today: () => new Date(),
      schedule,
      onScanComplete: () => chrome.runtime.sendMessage({ type: "scanComplete" } satisfies Message).catch(() => {}),
    });
    scanner = s;
    await s.scan();
    // A newer apply() may have replaced this scanner while it was scanning.
    if (scanner === s) s.observe();
  }

  onSettingsChanged((settings) => void apply(settings));

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && current && todayKey(new Date()) !== lastDay) void apply(current);
  });

  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    switch (message.type) {
      case "getMatches": {
        const state: PageState = {
          active: scanner !== null,
          url: location.href,
          pageLang: detectPageLanguage(document),
          matches: scanner?.getMatches() ?? [],
        };
        sendResponse(state);
        return false;
      }
      case "focusMatch":
        sendResponse(scanner?.focus(message.id) ?? false);
        return false;
      case "rescan":
        if (current) void apply(current);
        sendResponse(true);
        return false;
      default:
        return false;
    }
  });

  void loadSettings().then(apply);
}

// Registered and on-demand injection can both run this file in one page.
if (!window.__ddh) {
  window.__ddh = true;
  main();
}
