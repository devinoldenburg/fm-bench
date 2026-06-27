# Releasing

`fm-bench` uses semver tags (`v*.*.*`). Pushing a tag runs the **Release** workflow: test, lint, npm publish (with provenance), and GitHub release notes.

## Prerequisites

- Repository secret **`NPM_TOKEN`**: npm automation token with publish access to `fm-bench`.
- **`main`** is green on CI.

## Option A — GitHub Actions (recommended)

1. Open **Actions → Version → Run workflow**.
2. Choose `patch`, `minor`, `major`, or an exact semver.
3. The job runs `npm version`, pushes the commit and tag to `main`.
4. The tag push triggers **Release** automatically.

## Option B — Local

```sh
npm ci && npm test && npm run lint
npm version patch   # or minor / major
git push --follow-tags
```

## Re-run Release without republishing

If npm already has the version but GitHub release failed (or vice versa), use **Actions → Release → Run workflow** and enter the existing tag (for example `v0.5.3`). The workflow skips npm publish when that version is already on the registry and skips creating a duplicate GitHub release.

## Dry run

```sh
npm run publish:dry-run
```

CI runs the same dry-run on every push to `main` and on pull requests.