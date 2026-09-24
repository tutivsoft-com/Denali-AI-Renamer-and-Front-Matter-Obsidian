# Changelog

## 5.0.11 (2026-09-25)

- Synchronized the release version across release metadata and current product documentation; plugin behavior is unchanged.

## 5.0.10 (2026-09-24)

- Check free or purchased credit eligibility before sending note text to OpenRouter.

## 5.0.9 (2026-09-24)

- Denali renames files automatically by default, including folder batches. Per-file review is available as an opt-in Settings option.


## 5.0.8

- Added an optional review setting while keeping automatic renaming as the default.


## 5.0.5 - 2026-09-24

- Pointed the Antero-compatible key loader at this repository's dedicated $2 no-reset OpenRouter manifest.

## 5.0.4 - 2026-09-24

- Added accurate feature, requirements, architecture, and marketing documentation for the current no-frontmatter product scope.
- Refreshed the public source snapshot and release metadata; no runtime behavior changed.

## 5.0.3 - 2026-09-23

- Simplified Obsidian command palette labels by removing repeated plugin-name prefixes.

## 5.0.2 - 2026-09-23

- Migrate legacy subscription settings to the current credit purchase model so every rename checks entitlement.
- Keep filename collision suffixes sequential and render note names safely in the status log.

## 5.0.1 - 2026-09-23

- Reject unsafe AI subfolder paths, create valid suggested folders when needed, and avoid charging for no-op renames.

## 5.0.0 - 2026-09-23

- Removed all frontmatter generation and mutation code, controls, and AI output fields.
- Denali now sends only note body text for filename suggestions and changes the file path without modifying note contents.
- Renamed the Obsidian display name to Denali AI Renamer while retaining the plugin ID for installed-user upgrades.
- Rebuilt and synchronized the source, publish, manifest, and release documentation.

## 4.20.13 - 2026-09-22

- Fixed Constance account registration for deployments that require email
  verification and prevented linked-account email drift during checkout.
- Switched spend/free-usage event ids to cryptographically random ids so retry
  idempotency remains stable without the old `Math.random()` suffix.
- Rebuilt and synchronized the source, publish, manifest, and release metadata.

## 4.20.12 - 2026-09-21

- Incremented release metadata without rebuilding the plugin.

## 4.20.6 - 2026-09-20

- Prepared the next patch version across source, nested package, publish, and
  public metadata. No runtime behavior changed.

## 4.20.5 - 2026-09-20

- Synchronized the Denali source and publish version surfaces and prepared the
  next source-inclusive TutivSoft release.

## 4.20.4 - 2026-09-12

- Incremented and synchronized the canonical, nested package, manifest, publish, and compatibility metadata after the billing rollout. No runtime behavior changed in this metadata release.


This repo already carries a full RA1 metadata set from a prior
standardization pass — only `VERSION`, `CHANGELOG.md`, and
`RELEASE_NOTES.md` were missing. Derived from `HISTORY.md` and
`rahul_manifest.yaml` (`project_version: 4.20.1`).

## Unreleased — 2026-09-12

- Persisted rename credit-spend attempts before remote work and reused the same
  event ID when a response is lost or a request is retried.

## 4.20.2 — 2026-09-11

- Re-published the complete source-inclusive TutivSoft release package so the Obsidian Community source review can inspect the tagged release.
- Recorded the historical successful-release layout and the expected private-source connection.
- Automated Obsidian checks completed; an immediate automated recheck was
  requested and recorded as `open` on 2026-09-11.

## 4.20.1 — 2026-09-11

- Added first-use onboarding, visible advanced settings, clearer commands, safer credit timing, rename rollback protection, and complete user documentation with examples.
- Synchronized source, published source, bundle, and version metadata.

## 4.20.0 — 2026-08-22

- Bumped the published plugin metadata (`MyHelloWorldPlugin/manifest.json`, `MyHelloWorldPlugin/package.json`, `MyHelloWorldPlugin/package-lock.json`, `MyHelloWorldPlugin/versions.json`, root `manifest.json`, `publish/manifest.json`) to `4.20.0`. Denali now fetches its OpenRouter API key from its own encrypted GitHub manifest (Pattern B) instead of the previous key source; no other application behavior changed.

## 4.19.3 — 2026-08-20

- Patched the published plugin metadata (`MyHelloWorldPlugin/manifest.json`, `MyHelloWorldPlugin/package.json`, `MyHelloWorldPlugin/package-lock.json`, `versions.json`, root `manifest.json`, `publish/manifest.json`) to `4.19.3` and aligned the RA1 metadata surface (`VERSION`, `rahul_manifest.yaml`, `README.md`, `CHANGELOG.md`) to `2.1.5`. No functional source changes from `4.19.2`; the rebuilt `publish/main.js` is byte-equivalent except for the version comment trail.

## 4.19.2 — 2026-08-18

- Prepared the complete public repository package for the Obsidian Community review.
- Added source, README, license, corrected manifest metadata, and release attestations.

## Current Provider Wiring — 2026-08-18

- Denali's bundled `DEFAULT_SETTINGS.openRouterApiKey` is the dedicated Denali OpenRouter credential, stored as AES-256-CBC ciphertext and decrypted by the existing runtime logic.
- AI requests use OpenRouter Chat Completions with OpenRouter model IDs; the default remains `openai/gpt-5-mini`.

## 4.19.0 — 2026-08-16 (per `MyHelloWorldPlugin/manifest.json`, `HISTORY.md`)

Replaced the plugin's fake local license-key billing system with real
Constance (TutivSoft central billing, `app.tutivsoft.com`) one-time-credit
billing, mirroring the pattern already built and shipped for the sibling
app, Antero AI Auto Spell Correct. See
`CONSTANCE_BILLING_MIGRATION_ANALYSIS.md` and `BROWSER_CREDIT_SPEND_PLAN.md`
in the Constance repo (`saas-python-Constance-Python-Paddle-TWO`) for the
full design.

- **Removed entirely**: the bundled `license_keys.json` (100 pre-generated
  encrypted Pro/Ultimate serials), the plaintext/encrypted serial list
  files (`pro serials.txt`, `ultimate serials.txt`, and their `_result_*`
  encrypted counterparts), `loadLicenseKeysFromFile()`, `validateLicenseKey()`,
  the `proLicenseKeys`/`ultimateLicenseKeys`/`userLicenseKey`/`usedLicenseKeys`
  settings fields, and the license-key input/apply-button UI in the settings
  tab. This was a fake local-only serial system — any user could read
  `license_keys.json` directly from the installed plugin folder.
- **Added**: a real Constance catalog integration
  (`app_id: denali-ai-file-renamer-front-matter`) using Constance's unsigned
  public browser-relay endpoints (`POST /api/v1/public/browser/entitlements`,
  `POST /api/v1/public/browser/credits/spend`, `GET /buy`) — the same
  unauthenticated pattern used by Antero, since a locally-installed
  `main.js` bundle can't hold a real HMAC shared secret any more safely
  than a browser extension can.
- Three real one-time credit tiers: $1 → 50 credits, $5 → 300 credits,
  $15 → 1000 credits (Paddle product/price IDs are now real live ids in the
  Constance catalog, `App_Environment=live`, `App_Active=Yes` — provisioned
  2026-08-19; verified end-to-end via `GET /buy` returning a Paddle
  transaction redirect).
- New settings-tab UI: a billing email field, three "Buy" buttons that
  open Constance's hosted checkout in a new tab, and a "Refresh Balance"
  button that re-syncs the purchased-credit balance.
- A new stable per-install device id (`constanceDeviceId`, generated via
  `crypto.getRandomValues`, created once and reused forever) doubles as
  `external_customer_id`/`machine_id` for every Constance call.
- Credit spend order: the existing free/local starter pool
  (`availableCredits`, unchanged — 10 credits granted once on first load,
  purely local, never touches Constance) is spent first; once exhausted,
  the remainder is spent from `purchasedCredits` (a local mirror of the
  real Constance `CreditBalance`) via the real spend endpoint. A confirmed
  insufficient-credit response (`402`) blocks the operation immediately
  with a clear Notice; a non-insufficient failure (network error) fails
  open and is corrected on the next balance sync, so an already-shown
  result is never clawed back.
- Plugin version bumped `4.18.0` → `4.19.0` (`MyHelloWorldPlugin/manifest.json`,
  `package.json`, `versions.json`).
- **Update (2026-08-16, later same day)**: the placeholder encrypted value in
  `DEFAULT_SETTINGS.openRouterApiKey` was replaced with the account's real
  live shared OpenRouter key (AES-256-CBC, same `deriveKey`/`decryptApiKey`
  scheme as before — only the ciphertext changed). Plaintext key recorded in
  `ai provider credentials.txt` in this repo, per the account owner's
  standing convention of keeping real credentials visible in his own
  private repos (this repo's GitHub visibility is `private`).

## 2.1.5
- Current canonical version per `rahul_manifest.yaml`. Note `HISTORY.md`
  records the plugin's own release as `4.18.0` (2026-07-24) — a
  pre-existing versioning-scheme mismatch between the RA1 metadata pass
  version and the Obsidian plugin's own version number, left as-is rather
  than reconciled, since neither `HISTORY.md` nor `rahul_manifest.yaml`
  are files this pass is allowed to modify.

## 4.18.0 — 2026-07-24 (per `HISTORY.md`)
- Standardized RA1 metadata set added, architecture documented, uniform
  `start.sh` entry point created (`npm install` + `npm run dev` inside
  `MyHelloWorldPlugin/`, an esbuild-based Obsidian plugin build).

## 4.15.0 — 2025-09-01
- Obsidian plugin release: automated LLM-powered note title renaming and
  YAML front-matter metadata enrichment.
