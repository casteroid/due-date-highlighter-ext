# Contributing

## Commit messages

Every commit on `main` follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). The release workflow reads them to pick the next version and to write the release notes, so the type you choose decides what users get.

```
<type>(<optional scope>)<optional !>: <subject>

<optional body>

<optional footers, e.g. BREAKING CHANGE: ...>
```

| Type | Use it for | Version bump |
|---|---|---|
| `feat` | A new user-visible capability | minor (`0.3.1` → `0.4.0`) |
| `fix` | A bug fix users can notice | patch (`0.3.1` → `0.3.2`) |
| `perf` | A user-visible speed-up | patch |
| `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `style`, `revert` | Everything else | none |
| any type with `!`, or a `BREAKING CHANGE:` footer | A change that breaks stored settings or expected behaviour | major (`0.3.1` → `1.0.0`) |

The highest bump among the commits since the last release wins. If those commits are all `docs`, `chore` and similar, there is nothing to release (you can still force a bump when you start the release).

Scopes are optional and free-form. Use the area you touched: `popup`, `options`, `scanner`, `formats`, `sites`, `background`, `release`.

Examples:

```
feat(formats): recognise "Q3 2026" quarter dates
fix(popup): keep the selected row when the list refreshes
perf(scanner): skip text nodes without digits or month names
feat(storage)!: store tier colours as CSS custom properties

BREAKING CHANGE: settings exported from 0.x cannot be imported.
```

Rules the checker enforces (`npm run lint:commits -- <range>`):

- The type is lower case and one of the types in the table.
- There is exactly one space after the colon and the subject is not empty.
- Merge commits and `Revert "..."` commits that git writes itself are allowed.

CI runs the checker on every push to `main` and on every pull request. To fix a message on your branch before pushing, use `git commit --amend` for the last commit or `git rebase -i` for older ones.

Only the release workflow writes `chore(release): vX.Y.Z` commits and changes the version in `src/manifest.json` and `package.json`. Do not bump versions by hand.

## Development

```sh
npm install
npm run dev        # watch build into dist/
npm test           # unit tests
npm run package    # type-check, build and zip into release/
```

See [README.md](README.md) for loading the extension and the architecture, and [docs/releasing.md](docs/releasing.md) for releases.
