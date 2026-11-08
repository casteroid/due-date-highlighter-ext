# Chrome Web Store listing

Copy these into the Developer Dashboard on the first submission. Keep them in sync with the dashboard when the extension changes.

## Store listing tab

**Name** (from the manifest): Due Date Highlighter

**Summary** (from the manifest `description`, max 132 characters): Highlights dates on the pages you choose, coloured by how close they are.

**Category:** Productivity → Tools

**Language:** English

**Store icon:** `src/icons/icon-128.png`

**Screenshots** (1280x800): `store/screenshots/1-due-dates.png`, `2-marking-queue.png`, `3-options.png`

**Detailed description:**

```
Due Date Highlighter finds dates on the web pages you choose and colours each one by how close it is: overdue in red, due today in orange, this week in yellow. It works on task lists, ticket trackers, admin tables and anywhere else deadlines hide in plain text.

What it does
• Highlights dates in many formats: 2026-10-25, Oct 25, 2026, 25 October 2026, 25/10/2026, Sun, 25 Oct 2026, Oct 25, and month names in Portuguese, German, French, Spanish and Italian. Optional: US month-first dates, two-digit years, and relative phrases like "tomorrow" or "next Friday".
• Colours come from tiers you control: day ranges, colours, style (background, underline, outline or badge) and a "+3d" or "3d ago" badge.
• Two ready-made profiles: "Due dates" for upcoming deadlines and "Waiting time" for queues where you care how long something has been waiting. Pick a profile per site.
• The popup lists every date on the page in order. Click one to scroll to it, filter by tier, and switch individual formats on or off for that site.
• Context rules: only highlight dates near words like "due" or "deadline", under a table column such as "Uploaded", or under a given heading. Skip dates near "created" or "posted".
• Custom formats with a live tester for anything unusual.

Where it runs
The extension does nothing until you turn it on for a site or a single page from the popup. It then asks Chrome for access to that site only, and releases the access when you turn it off.

Privacy
Page text is read in your browser and never leaves it. Settings stay on your device. No accounts, no analytics, no network requests.
```

**Homepage URL:** https://github.com/casteroid/due-date-highlighter-ext

**Support URL:** https://github.com/casteroid/due-date-highlighter-ext/issues

## Privacy practices tab

**Single purpose:**

```
Highlights dates in the text of web pages the user enables, coloured by how many days away they are, and lists them in a popup.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's tier profiles, date formats, keywords and site rules locally with chrome.storage.local. |
| `activeTab` | Lets the popup read the current tab's address when the user clicks the toolbar button, so it can offer "Enable on this site" before the extension has any host access. |
| `scripting` | Registers the content script for the sites the user enabled (scripting.registerContentScripts) and injects it into the current tab right after the user enables a site, so dates highlight without a reload. |
| Host permission (optional `<all_urls>`) | Optional and never granted at install. When the user enables a site or page, the extension requests access to that one origin only, so the content script can read the page text to find dates. Access is released when the rule is removed or disabled. |

**Remote code:** No, I am not using remote code. (All code ships in the package; there is no `eval` and no remotely hosted script.)

**Data usage:** Tick **Website content** only. The store requires disclosing data an extension handles even when it never leaves the device ([User Data FAQ, question 3](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)), and the extension reads page text to find dates. Nothing else applies: no personal, health, financial, authentication, location or communication data, no browsing history (site rules are patterns the user types or picks, not a record of visits), and no user activity tracking. Tick all three certifications (no selling or transferring of user data, no use unrelated to the single purpose, no use for creditworthiness or lending).

**Privacy policy URL:** https://github.com/casteroid/due-date-highlighter-ext/blob/main/PRIVACY.md

## Distribution tab

**Visibility:** Public (or Unlisted while testing). If you change visibility in the dashboard later, publish once by hand before the API can publish again.

**Regions:** All regions.
