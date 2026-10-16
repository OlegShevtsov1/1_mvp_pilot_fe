# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Versions come from the
`Type:` line of each squash commit (`scripts/next-version.sh`); a release moves `[Unreleased]` to
`## [X.Y.Z] - YYYY-MM-DD`. Each section names the minimum backend version it needs, which must equal
`deploy/min-be-version`.

## [Unreleased]

Minimum backend version: v0.1.0

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.1.0] - 2026-10-16

Minimum backend version: v0.1.0

### Added

- Runtime config from `/config.js`, written when the container starts: one image for every
  environment.
- Error reporting through the backend tunnel `<API_URL>/api/errors`, with an error boundary page.
- Dev deploy from `develop` and `hotfix/*`, and prod deploy of the same image with Kamal over the
  VPN, promoted without a rebuild.
- Release pipeline: versions from the `Type:` line, this changelog, draft GitHub Releases for
  annotated `v*` tags on `main`, prod deploys only from such a tag after the backend it needs,
  and a 10-minute release watch of prod health and new errors.
- `index.html` is revalidated on every load, so a new release is picked up without a hard refresh.
