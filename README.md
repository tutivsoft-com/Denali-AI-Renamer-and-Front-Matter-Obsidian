# Denali AI Renamer

Generate filenames from Markdown note content, with configured naming styles and optional folder placement.

Current version: **5.0.51**.

## First use

Enable the plugin and use its settings page. Simple is the default settings mode; Advanced exposes optional configuration. Open a Markdown note and run Rename current note. Use Open renaming options for current note for the interactive workflow.

The current note supplies the AI naming input. Automatic naming is the default; optional review or interactive naming allows editing a proposed name. Case, character replacement, timestamp, backup and subfolder preferences control the local result. Saved automatic-rename preferences are retained.

## Account and processing

AI requests go directly to OpenRouter using the fixed request model `~openai/gpt-luna-latest`. The existing managed-key resolver supplies the connection; legacy personal-key/model preferences do not override it. Constance handles account and billing operations.

One credit is consumed before an eligible rename is applied. Provider failure, cancellation and a no-op do not consume a new credit; a local rename failure can occur after usage consumption. Pending events retain their identity for recovery.

Connect the existing Constance account in settings; registration can require email verification before signing in again. Billing account passwords are sent for authentication and are not persisted. Access/refresh session data and a stable installation identity are saved locally. Account free usage and purchased balance are determined by Constance; cached values and checkout return URLs do not create entitlement. Catalog displays current formatted names, prices, availability and exact price IDs. Unknown usage and checkout results retain their original identities for recovery.

## Diagnostics

Help is available in settings and through Open documentation. Open plugin settings and Copy full debug log are command-palette fallbacks. Debug logging defaults off for a new installation; failures and full Error objects/stacks still appear in the local developer console. Timed information is enabled by the debug preference. The copyable diagnostic buffer keeps at most 1,000 summarized events and excludes raw error text, stacks, note text, paths and credentials. Full console exceptions can contain whatever the failed operation placed in its error. Logs are not uploaded automatically.

## Documentation

- [User guide](docs/USER_GUIDE.md)

License terms are in LICENSE.
