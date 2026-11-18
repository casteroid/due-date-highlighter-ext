# Releasing

Releases are started by hand. After that, the Chrome Web Store and Firefox Add-ons uploads are automatic.

The workflows here are thin callers of the shared ones in [casteroid/webext-release](https://github.com/casteroid/webext-release). Its README explains how the version is chosen, the one-time store setup and the troubleshooting table. This page holds what is specific to this extension.

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | push to `main`, pull requests | Checks commit messages, runs tests, builds both packages and uploads them as an artifact |
| `.github/workflows/release.yml` | manual (Actions tab) | Runs `npm test`, picks the version, commits it, tags `vX.Y.Z`, creates the GitHub release with the zip and the xpi, then uploads the zip to the Chrome Web Store and the xpi to Firefox Add-ons |
| `.github/workflows/publish.yml` | manual with a tag | Uploads an existing release to the stores again |
| `.github/workflows/build.yml` | manual with a tag | Rebuilds the zip and/or the xpi of an existing release and keeps them as run artifacts; touches neither the release nor the stores |

The packages are `release/due-date-highlighter-<version>.chrome.zip` and `release/due-date-highlighter-<version>.firefox.xpi`, built by `npm run package`. Releases up to v0.2.0 have only the Chrome package, named `due-date-highlighter-<version>.zip`; the `*.zip` pattern matches both names.

The workflows pin webext-release to a full commit SHA, with the tag in a comment. Dependabot opens a pull request when a new tag is out; update all four files together.

## Listing

- Chrome Web Store: item `abeojlfjcpibpelopknihgfpplmkonof`, <https://chromewebstore.google.com/detail/due-date-highlighter/abeojlfjcpibpelopknihgfpplmkonof>.
- Firefox Add-ons: add-on ID `due-date-highlighter-ext@nunofaria11`. The first version was submitted by hand; later versions are uploaded by the release workflow with a `git archive` of the tag as the source code.

Listing copy is in [`store/listing.md`](../store/listing.md); the icon and screenshots are in `src/icons/` and `store/screenshots/`. The privacy policy is [PRIVACY.md](../PRIVACY.md).

## Store setup

Done, following the [webext-release store setup](https://github.com/casteroid/webext-release#store-setup-once-per-extension):

- Chrome, 2026-11-09: Workload Identity provider `due-date-highlighter` in project `chrome-web-store-api-258321`, and the repository variables `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`, `CWS_PUBLISH_TYPE`, `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT`.
- Firefox, 2026-11-18: environment `firefox-add-ons` with the secrets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`, and the repository variable `AMO_ADDON_ID`.

## Every release

1. Merge or push your Conventional Commits to `main` and wait for CI to pass.
2. **Actions → Release → Run workflow** on `main`. Optionally run a dry run first to read the notes.
3. Watch the reviews in the Chrome dashboard and the AMO Developer Hub. With `DEFAULT_PUBLISH` the Chrome version goes live as soon as it is approved.

To retry the store uploads for an existing release (for example after fixing a variable), run **Actions → Publish** with the tag, e.g. `v0.3.0`. Releases up to v0.2.0 have no xpi, so the Firefox job fails for them.

To get the packages of an existing release rebuilt from its tag, run **Actions → Build** with the tag and pick the browsers. They are the `chrome-vX.Y.Z` and `firefox-vX.Y.Z` artifacts on the run page. Tags up to v0.2.0 have no Firefox build, so Firefox fails for them.
