# Releasing

Releases are started by hand. After that, the Chrome Web Store upload is automatic.

The workflows here are thin callers of the shared ones in [casteroid/webext-release](https://github.com/casteroid/webext-release). Its README explains how the version is chosen, the one-time store setup and the troubleshooting table. This page holds what is specific to this extension.

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | push to `main`, pull requests | Checks commit messages, runs tests, builds and uploads the zip as an artifact |
| `.github/workflows/release.yml` | manual (Actions tab) | Runs `npm test`, picks the version, commits it, tags `vX.Y.Z`, creates the GitHub release with the zip, then uploads it to the Chrome Web Store |
| `.github/workflows/publish.yml` | manual with a tag | Uploads an existing release to the Chrome Web Store again |

The package is `release/due-date-highlighter-<version>.zip`, built by `npm run package`.

The workflows pin webext-release to a full commit SHA, with the tag in a comment. Dependabot opens a pull request when a new tag is out; update all three files together.

## Listing

- Chrome Web Store: item `abeojlfjcpibpelopknihgfpplmkonof`, <https://chromewebstore.google.com/detail/due-date-highlighter/abeojlfjcpibpelopknihgfpplmkonof>.
- Firefox Add-ons: not published. The release workflow passes no `firefox-package`, so it skips Firefox.

Listing copy is in [`store/listing.md`](../store/listing.md); the icon and screenshots are in `src/icons/` and `store/screenshots/`. The privacy policy is [PRIVACY.md](../PRIVACY.md).

## Store setup

Done, following the [webext-release store setup](https://github.com/casteroid/webext-release#store-setup-once-per-extension):

- Chrome, 2026-11-09: Workload Identity provider `due-date-highlighter` in project `chrome-web-store-api-258321`, and the repository variables `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`, `CWS_PUBLISH_TYPE`, `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT`.

## Every release

1. Merge or push your Conventional Commits to `main` and wait for CI to pass.
2. **Actions → Release → Run workflow** on `main`. Optionally run a dry run first to read the notes.
3. Watch the review in the Chrome dashboard. With `DEFAULT_PUBLISH` the version goes live as soon as it is approved.

To retry the store upload for an existing release (for example after fixing a variable), run **Actions → Publish** with the tag, e.g. `v0.2.0`.
