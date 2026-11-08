import type { Rejection } from "./criteria";

export type MatchStatus = "highlighted" | "format-off" | "filtered" | "no-tier";

export type MatchInfo = {
  id: string;
  text: string;
  daysUntil: number;
  tierId: string | null;
  formatId: string;
  context: string;
  status: MatchStatus;
  reason?: Rejection;
};

export type PageState = { active: boolean; url: string; pageLang: string | null; matches: MatchInfo[] };

export type Message =
  | { type: "getMatches" }
  | { type: "focusMatch"; id: string }
  | { type: "rescan" }
  /** Content script → runtime, so an open popup can refresh. */
  | { type: "scanComplete" }
  /** Popup → background. */
  | { type: "injectIntoTab"; tabId: number };

export type InjectResponse = { ok: true } | { ok: false; error: string };
