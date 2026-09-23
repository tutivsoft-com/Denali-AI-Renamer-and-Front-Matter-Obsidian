# Denali AI Renamer

Generate and review AI-assisted filenames for Markdown notes. Denali does not generate, add, or update frontmatter.

Version: `5.0.4` · [Complete user guide](./docs/USER_GUIDE.md)

## Current AI Provider

Denali uses OpenRouter Chat Completions at `https://openrouter.ai/api/v1/chat/completions` with OpenRouter model IDs. A user-supplied API key in Advanced settings takes precedence; when blank, Denali may use its managed encrypted key connection. The AI receives the note body without the YAML frontmatter block. Renaming changes the file path only; note content and frontmatter remain unchanged.

## Billing and usage

Denali uses an authenticated TutivSoft Constance billing account for its
one-time credit packs (`app_id: denali-ai-file-renamer-front-matter`). Account
registration may require email verification; enter the emailed token in the
plugin settings before buying or spending credits. Checkout uses Constance's
`/buy` redirect with the app-specific Paddle price id and stable installation
id, while entitlement polling and idempotent credit/free-usage spends use the
authenticated `/api/v1/billing/...` endpoints. This backend-less plugin does
not hold a shared HMAC secret or receive server callbacks; the bearer-linked
installation is the current supported client flow.

## Project documentation (plugin 5.0.4)

- [FEATURES.md](./FEATURES.md) — implemented product features and the content boundary.
- [REQUIREMENTS.md](./REQUIREMENTS.md) — current product requirements and release checks.
- [architecture.md](./architecture.md) — Architectural overview and data flow.
- [MARKETING.md](./MARKETING.md) — verified product copy and claim boundaries.
- [ai_model.md](./ai_model.md) — AI model evidence and detection metadata.
- [HISTORY.md](./HISTORY.md) — Version history timeline.
- [CONTRIBUTORS.md](./CONTRIBUTORS.md) — Contributor attribution.

## Public Plugin Publishing

This checkout is the private/source repository. The canonical public GitHub
repository is [`tutivsoft-com/Denali-AI-Renamer-and-Front-Matter-Obsidian`](https://github.com/tutivsoft-com/Denali-AI-Renamer-and-Front-Matter-Obsidian),
and its release contents are staged in the source repository’s `publish/` directory. Copy the contents of
`publish/` into the public repository root. Never copy credentials, logs,
`node_modules`, or private project metadata.

The public repository root must contain:

- `README.md`
- `LICENSE`
- `manifest.json`
- `main.ts`
- `main.js`
- `styles.css`
- `.github/workflows/release-attestations.yml`

For a GitHub release, upload only `main.js`, `manifest.json`, and `styles.css`
as release assets. The release tag must exactly match the version in
`manifest.json`. Run the plugin build before copying the final `publish/`
folder, and verify the manifest `authorUrl` is a reachable profile or website.
