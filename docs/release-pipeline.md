# Release Pipeline

This project includes one-click CI/CD workflows:

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

## CI workflow

Triggered by push/PR.

Checks:

1. `npm install`
2. `npm test`
3. `bash scripts/smoke-test.sh`
4. `npm pack --dry-run`

## Release workflow

Triggered by:

- tag push: `v*`
- manual dispatch (`workflow_dispatch`)

Release job actions:

1. run test + smoke
2. pack npm tarball
3. publish to npm (`NPM_TOKEN`)
4. create GitHub Release with tarball asset
5. optional Gitee mirror sync

## Required GitHub Secrets

- `NPM_TOKEN`: npm publish token

## Optional GitHub Secrets (Gitee sync)

- `GITEE_SSH_PRIVATE_KEY`: SSH private key with push rights
- `GITEE_REPO_SSH`: ssh remote url, e.g. `git@gitee.com:org/repo.git`

## One-click manual release

Open GitHub Actions -> `Release` -> `Run workflow`:

- set `release_tag` (e.g. `v0.2.1`)
- keep `publish_npm=true`
- keep `create_github_release=true`
- enable `push_tag=true` for first-time tag creation
- optionally enable `sync_gitee=true`

