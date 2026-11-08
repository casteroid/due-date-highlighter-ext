import type { InjectResponse, Message } from "./core/messages";
import { originCovers, toMatchPattern, toOrigin } from "./core/sites";
import { loadSettings, onSettingsChanged } from "./core/storage";

const SCRIPT_ID = "ddh-content";

/**
 * Makes the one registered content script match exactly the enabled rules whose host permission is granted,
 * and releases granted origins that no enabled rule needs any more.
 */
async function reconcile(): Promise<void> {
  const settings = await loadSettings();
  const granted = (await chrome.permissions.getAll()).origins ?? [];

  const matches = new Set<string>();
  const needed = new Set<string>();
  for (const rule of settings.siteRules) {
    if (!rule.enabled) continue;
    const match = toMatchPattern(rule.pattern);
    const origin = toOrigin(rule.pattern);
    if (!match || !origin) {
      console.warn(`[ddh] pattern cannot be registered: ${rule.pattern}`);
      continue;
    }
    const covering = granted.filter((g) => originCovers(g, origin));
    if (covering.length === 0) continue;
    matches.add(match);
    for (const g of covering) needed.add(g);
  }

  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
    if (matches.size === 0) {
      if (existing.length > 0) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
    } else {
      const script: chrome.scripting.RegisteredContentScript = {
        id: SCRIPT_ID,
        js: ["content.js"],
        matches: [...matches],
        runAt: "document_idle",
        persistAcrossSessions: true,
      };
      if (existing.length > 0) await chrome.scripting.updateContentScripts([script]);
      else await chrome.scripting.registerContentScripts([script]);
    }
  } catch (e) {
    console.error("[ddh] content script registration failed", e);
  }

  // The extension has no static host permissions, so every granted origin came from a rule.
  const stale = granted.filter((o) => !needed.has(o));
  if (stale.length > 0) await chrome.permissions.remove({ origins: stale });
}

let queue: Promise<void> = Promise.resolve();

/** Serialised so storage events, permission events and messages never interleave. */
function scheduleReconcile(): Promise<void> {
  queue = queue.then(reconcile).catch((e: unknown) => console.error("[ddh] reconcile failed", e));
  return queue;
}

chrome.runtime.onInstalled.addListener(() => void scheduleReconcile());
chrome.runtime.onStartup.addListener(() => void scheduleReconcile());
// No onAdded trigger: a grant lands just before its rule is saved, and reconciling in between would release it.
chrome.permissions.onRemoved.addListener(() => void scheduleReconcile());
onSettingsChanged(() => void scheduleReconcile());

async function injectIntoTab(tabId: number): Promise<InjectResponse> {
  try {
    await scheduleReconcile();
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type !== "injectIntoTab") return false;
  void injectIntoTab(message.tabId).then(sendResponse);
  return true;
});
