# Release Notes

## 4.20.13 - 2026-09-22

Billing maintenance release: uses authenticated Constance checkout with a
stable idempotency key, refresh-token support, and settlement polling. The
legacy `/buy` URL is retained only as a hosted-checkout fallback.

## 4.20.6 - 2026-09-20

Metadata-only patch preparation: synchronized source, nested package, publish,
compatibility, and current release documentation. No runtime behavior changed.

## 4.20.5 - 2026-09-20

Metadata-only release: synchronized the source package, manifest, versions
history, public bundle, and release documentation.

## 4.20.4 - 2026-09-12

Metadata-only release bump: canonical, package, manifest, publish, and compatibility metadata are synchronized. No runtime behavior changed.


`Denali AI Renamer and Front-Matter` is an Obsidian desktop/mobile plugin
that uses an LLM to automatically rename notes with keyword-rich titles
and enrich their YAML front matter. It ships as a standard Obsidian
plugin (`MyHelloWorldPlugin/`, built with esbuild + TypeScript/JavaScript).

## 4.20.2 — 2026-09-11

Maintenance release: includes the complete TypeScript source in the TutivSoft release repository and preserves the verified runtime assets. The release notes also disclose the expected vault-enumeration permission for batch operations. Obsidian's automated checks completed; an immediate automated recheck request is open as of 2026-09-11.

## 4.20.1 — 2026-09-11

Usability patch: improved onboarding and advanced settings, clarified commands, strengthened rename safety, and added a complete example-driven user guide.

## 4.20.0 — 2026-08-22

Bumped the published plugin version to `4.20.0` (`MyHelloWorldPlugin/manifest.json`, `MyHelloWorldPlugin/package.json`, `MyHelloWorldPlugin/package-lock.json`, `MyHelloWorldPlugin/versions.json`, root `manifest.json`, `publish/manifest.json`). Denali now fetches its OpenRouter API key from its own encrypted GitHub manifest (Pattern B) instead of the previous key source.

## 4.19.3 / RA1 2.1.5 — 2026-08-20

Patch release: bumped the published plugin version to `4.19.3` (`MyHelloWorldPlugin/manifest.json`, `MyHelloWorldPlugin/package.json`, `MyHelloWorldPlugin/package-lock.json`, `MyHelloWorldPlugin/versions.json`, root `manifest.json`, `publish/manifest.json`) and synchronized the RA1 metadata surface (`VERSION`, `rahul_manifest.yaml`, `README.md`, `CHANGELOG.md`) to `2.1.5`. No application source or feature changes from `4.19.2`.

## Current Provider Wiring — 2026-08-18

The plugin uses OpenRouter Chat Completions with the dedicated Denali credential. The credential remains encrypted in the bundle and is decrypted only through the existing runtime decryption path; no provider behavior or backup-key flow was otherwise changed.

## 4.19.0 — 2026-08-16

Replaced the plugin's fake local license-key credit system with real
Constance (TutivSoft central billing) one-time-credit billing. Buy credits
in three tiers ($1/50 credits, $5/300 credits, $15/1000 credits) directly
from the settings tab; balances are tracked server-side and synced to the
plugin automatically. The 10 free starter credits granted on first install
are unchanged. See `CHANGELOG.md` for full details.

Update (2026-08-19): the three Paddle prices were initially provisioned at
10x the intended amounts ($10/$50/$150 instead of $1/$5/$15) and were
corrected in place to $1/$5/$15 via `PATCH /prices/{id}` on the Paddle API
(same price ids, no plugin/catalog change), re-verified against the Paddle
API.

Later the same day, the placeholder encrypted shared key baked into the
plugin was swapped for the account's real live OpenRouter key (same
encryption scheme, only the value changed). The plaintext key is recorded
in `ai provider credentials.txt` in this repo (private repo, matches the
account's existing plaintext-credentials convention).

## 4.18.0 — 2026-07-24

Standardized documentation pass: added the RA1 standard metadata set
(`architecture.md`, `ai_model.md`, `CONTRIBUTORS.md`, `HISTORY.md`,
`rahul_manifest.yaml`) and a uniform `start.sh` launcher that installs
npm dependencies and runs the esbuild dev watcher for the plugin.

## 4.15.0 — 2025-09-01

Core plugin release: automatic LLM-powered note renaming with
keyword-rich titles, and YAML front-matter metadata enrichment, built as
an installable Obsidian plugin.
