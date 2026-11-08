# Due Date Highlighter

A Chrome (Manifest V3) extension that finds dates in web pages, works out how many days away each one is, and colours it by a priority tier you configure. It runs only on the sites and pages you turn it on for. Everything is stored in `chrome.storage.local`; there is no backend, no sync and no network access.

## Build

```sh
npm install        # Node 22.18 or newer
npm run build      # type-checks, then bundles into dist/
npm run dev        # rebuilds dist/ on every change (unminified, inline source maps)
npm test           # vitest
npm run package    # build and zip dist/ into release/due-date-highlighter-<version>.zip
```

## Contributing and releases

Commits follow Conventional Commits, which drive the version number: see [CONTRIBUTING.md](CONTRIBUTING.md). Releases to the Chrome Web Store are started by hand from the GitHub Actions tab: see [docs/releasing.md](docs/releasing.md), which also covers the first store submission. Store listing copy and screenshots live in [`store/`](store/listing.md); the privacy policy is [PRIVACY.md](PRIVACY.md).

## Load it in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`, switch on **Developer mode**, click **Load unpacked** and pick the `dist/` folder.
3. After a rebuild, click the reload icon on the extension card.

## Try it on the fixture page

```sh
npm run fixture    # serves test/ on http://localhost:8080
```

Open <http://localhost:8080/fixture.html>, click the extension icon and choose **Enable on this site**. Chrome asks for access to `localhost`; after you accept, the page highlights at once.

The fixture contains a mix of date formats, a `Created:` date (add `created` as an ignore keyword to hide it), a Portuguese section, two tables with the same date format under different headings, and a line that appears after 3 seconds. To reproduce the marking-queue setup, open **Settings → Site rules → localhost**, pick the **Waiting time** profile, set the context keywords to `uploaded`, and switch the section heading context on: only the Uploaded column of the "not yet marked" table is coloured, by age.

## Architecture

```
src/core/      pure logic, no chrome.* except storage.ts
src/content.ts content script: resolves settings for the page, runs the scanner, answers the popup
src/background.ts service worker: keeps the registered content script in line with the site rules
src/popup/     the toolbar popup
src/options/   the options page
src/icons/     toolbar and store icons (source: assets/icon.svg)
scripts/release/  version planning, commit checks and Chrome Web Store upload, run by the GitHub workflows
```

- `formats.ts`: the registry of built-in date detectors. Each detector is a regular expression with guards that forbid a letter or digit on either side, so IDs such as `72182780` never match. `find(text, ctx)` takes a context with the page language, the month and weekday name tables, the ambiguous-numeric preference and today's date. `natural` uses chrono-node's parser for the page language and keeps only relative phrases.
- `customFormats.ts`: compiles user regexes with named groups `d`, `m` and optional `y`, and explains failures for the live tester. `buildRegistry` returns built-ins plus custom formats.
- `languages.ts`: page language detection (nearest `lang` attribute, then `<html lang>`, then the Content-Language meta) and month and weekday name tables built from `Intl.DateTimeFormat` for each enabled language. Short names that are words in another language (`set`, `mar`, `out`) are accepted without a year only in their own page language. Parsing never looks at the browser's language.
- `parse.ts`: runs the enabled formats over a text node, settles `dmy`/`mdy` ambiguity, keeps the longest of overlapping matches and fills in missing years with the nearest occurrence.
- `dates.ts` and `tiers.ts`: whole-day differences in the browser's time zone (DST-safe), badge labels, and first-match tier selection.
- `context.ts` and `criteria.ts`: the text before a date in its block, its table column header (with `colspan` and ARIA grids) and the nearest heading above it; then the keyword, ignore-keyword and max-distance rules.
- `settings.ts` and `sites.ts`: site-rule pattern matching (most specific rule wins) and resolution of global settings plus the matching rule's overrides.
- `scanner.ts`: walks text nodes in idle-time chunks, wraps highlighted dates in `<span data-ddh>`, records every match (including ones from switched-off formats) for the popup, unwraps cleanly, and watches DOM mutations with a 300 ms debounce, ignoring its own.

### Permissions and registration

The manifest has `storage`, `activeTab` and `scripting`, plus `optional_host_permissions: ["<all_urls>"]`, and no static content scripts. When you add a rule (popup or options page), the extension asks for that rule's origin. The service worker owns a single registered content script, `ddh-content`; on install, on browser start-up, on every settings change and when a permission is revoked, it sets the script's `matches` to the enabled rules whose origin is granted, and releases granted origins that no enabled rule needs. The popup also injects the content script into the current tab straight away. The content script checks the exact rule itself, so a page-only rule never activates other pages that the registered match pattern happens to cover.

### How settings resolve

Global settings live in the options page: tier profiles, format toggles, custom formats, criteria (context and ignore keywords, context size, which context parts count, max distance, page languages, ambiguous-numeric preference). A site rule can override the profile, each format (on, off, inherit), the keyword lists, page languages, the ambiguous-numeric preference and each context part. For a page, the enabled rule with the longest pattern (wildcards removed) applies; every field it leaves unset falls back to the global value.

Site rule patterns:

- `example.com`: that host only (any port); `localhost:8080`: that host and port.
- `*.example.com`: the domain and all its subdomains.
- `https://github.com/myorg/*/issues*`: a URL prefix with `*` wildcards, compared against origin and path; the query string and hash are ignored.

## How to add a tier

In the options page, open the profile, click **Add tier**, then set its name, the day range (`min` and `max` are inclusive; leave one empty for "no limit"), colours, style and whether to show the days badge. Use the arrows to move it: tiers are checked top to bottom and the first enabled tier whose range contains the date's day count wins. The page warns about overlaps and gaps. Days are counted from today: today is `0`, yesterday `-1`, tomorrow `1`.

A tier has this shape (`src/core/types.ts`):

```ts
type Tier = {
  id: string;
  name: string;
  enabled: boolean;
  minDays: number | null; // inclusive, null = no lower bound
  maxDays: number | null; // inclusive, null = no upper bound
  bgColor: string;
  textColor: string;
  style: "background" | "underline" | "outline" | "badge";
  showDaysBadge: boolean;
};
```

To change the shipped defaults, edit `DEFAULT_SETTINGS` in `src/core/storage.ts`; stored settings go through `migrate()` in the same file.
