# Releasing

`fm-bench` uses semver tags (`v*.*.*`). Pushing a tag runs the **Release** workflow: lint/test/package check, npm publish (with provenance), and a GitHub release whose body is taken from the matching section in **`CHANGELOG.md`** (plus a compare link).

## Prerequisites

- Repository secret **`NPM_TOKEN`**: npm automation token with publish access to `fm-bench`.
- **`main`** is green on CI.

If `NPM_TOKEN` is missing or expired, the Release workflow warns, skips the npm publish step, and still creates the GitHub release. The release notes then state that npm publish was skipped. Re-run the Release workflow with the tag once the token is fixed — an already-published version is skipped automatically.

## Before tagging

```sh
npm run check     # lint + tests + npm pack integrity
npm run publish:dry-run
```

Then bump `CHANGELOG.md` with a `## X.Y.Z` section; the release notes come from that section.

## Option A — GitHub Actions (recommended)

1. Open **Actions → Version → Run workflow**.
2. Choose `patch`, `minor`, `major`, or an exact semver.
3. The job runs `npm version`, pushes the commit and tag to `main`.
4. The tag push triggers **Release** automatically.

## Option B — Local

```sh
npm ci && npm run check
npm version minor   # or patch / major
git push origin main --follow-tags
```

## Re-run Release without republishing

If npm already has the version but the GitHub release failed (or vice versa), use **Actions → Release → Run workflow** and enter the existing tag (for example `v0.6.3`). The workflow skips npm publish when that version is already on the registry. If the GitHub release already exists, it **updates the release notes** from `CHANGELOG.md`.

Refresh notes locally without re-publishing:

```sh
node scripts/changelog-release-notes.mjs 0.6.3 > notes.md
gh release edit v0.6.3 --notes-file notes.md --repo devinoldenburg/fm-bench
```

## Verifying a release

```sh
git tag --list 'v0.7.0'
gh release view v0.7.0 --repo devinoldenburg/fm-bench
npm view fm-bench version            # registry version

mkdir -p fm-bench-check && cd fm-bench-check
npm install fm-bench@0.7.0
./node_modules/.bin/fm-bench --version
./node_modules/.bin/fm-bench --help > /dev/null
./node_modules/.bin/fm-bench doctor
```

## Dry run

```sh
npm run publish:dry-run
npm run check:pack
```

CI runs the dry run on every push to `main` and on pull requests.
