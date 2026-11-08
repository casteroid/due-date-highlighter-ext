export type TierStyle = "background" | "underline" | "outline" | "badge";
export type BadgeStyle = "signed" | "ago";

export type Tier = {
  id: string;
  name: string;
  enabled: boolean;
  /** Inclusive; null = -infinity. */
  minDays: number | null;
  /** Inclusive; null = +infinity. */
  maxDays: number | null;
  bgColor: string;
  textColor: string;
  style: TierStyle;
  showDaysBadge: boolean;
};

export type TierProfile = {
  id: string;
  name: string;
  badgeStyle: BadgeStyle;
  tiers: Tier[];
};

export type AmbiguousNumeric = "auto" | "dmy" | "mdy";

export type ContextParts = { before: boolean; columnHeader: boolean; sectionHeading: boolean };

export type SiteRule = {
  id: string;
  pattern: string;
  enabled: boolean;
  tierProfileId?: string;
  formats?: Record<string, boolean>;
  contextKeywords?: string[];
  ignoreKeywords?: string[];
  pageLanguages?: string[];
  ambiguousNumeric?: AmbiguousNumeric;
  context?: Partial<ContextParts>;
};

/** The format id used everywhere is `custom:${id}`. */
export type CustomFormat = { id: string; label: string; pattern: string };

export type Criteria = {
  contextKeywords: string[];
  ignoreKeywords: string[];
  contextChars: number;
  context: ContextParts;
  maxDistanceDays: number;
  pageLanguages: string[];
  ambiguousNumeric: AmbiguousNumeric;
};

export type Settings = {
  schemaVersion: 1;
  tierProfiles: TierProfile[];
  defaultProfileId: string;
  /** Format id → enabled; a missing id falls back to DateFormat.defaultEnabled. */
  formats: Record<string, boolean>;
  customFormats: CustomFormat[];
  criteria: Criteria;
  siteRules: SiteRule[];
};
