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

- `NPM_TOKEN`: npm automation/granular access token with publish permission

Fallback names supported by workflow, but not recommended as the primary path:

- `NODE_AUTH_TOKEN` repository secret
- `NPM_TOKEN` repository variable
- `NODE_AUTH_TOKEN` repository variable

Recommended setup:

1. In npm, create an automation token or granular access token that can publish packages.
2. In GitHub repo settings, set `Settings -> Secrets and variables -> Actions -> New repository secret`.
3. Add the token as `NPM_TOKEN`.
4. Re-run the `Release` workflow or push a new `v*` tag.

The release workflow now prints which token source it resolved, without exposing the token value.

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
