import type { DateFormat } from "./formats";
import { findMatchingRule } from "./sites";
import type { AmbiguousNumeric, ContextParts, Settings, SiteRule, TierProfile } from "./types";

export type ResolvedSettings = {
  rule: SiteRule;
  profile: TierProfile;
  /** Every registry id is present. */
  formatsEnabled: Record<string, boolean>;
  contextKeywords: string[];
  ignoreKeywords: string[];
  contextChars: number;
  context: ContextParts;
  maxDistanceDays: number;
  pageLanguages: string[];
  ambiguousNumeric: AmbiguousNumeric;
};

export function formatEnabledGlobally(settings: Settings, format: DateFormat): boolean {
  return settings.formats[format.id] ?? format.defaultEnabled;
}

export function profileFor(settings: Settings, rule: SiteRule | undefined): TierProfile {
  return (
    settings.tierProfiles.find((p) => p.id === rule?.tierProfileId) ??
    settings.tierProfiles.find((p) => p.id === settings.defaultProfileId) ??
    settings.tierProfiles[0]!
  );
}

/** Global settings overlaid with the most specific matching site rule; null when no enabled rule matches. */
export function resolveSettings(settings: Settings, url: string, registry: DateFormat[]): ResolvedSettings | null {
  const rule = findMatchingRule(settings.siteRules, url);
  if (!rule) return null;
  const { criteria } = settings;
  const formatsEnabled: Record<string, boolean> = {};
  for (const f of registry) formatsEnabled[f.id] = rule.formats?.[f.id] ?? formatEnabledGlobally(settings, f);
  return {
    rule,
    profile: profileFor(settings, rule),
    formatsEnabled,
    contextKeywords: rule.contextKeywords ?? criteria.contextKeywords,
    ignoreKeywords: rule.ignoreKeywords ?? criteria.ignoreKeywords,
    contextChars: criteria.contextChars,
    context: { ...criteria.context, ...rule.context },
    maxDistanceDays: criteria.maxDistanceDays,
    pageLanguages: rule.pageLanguages ?? criteria.pageLanguages,
    ambiguousNumeric: rule.ambiguousNumeric ?? criteria.ambiguousNumeric,
  };
}
