# Denali AI Renamer user guide

Current version: **5.0.52**.

## Start

1. Enable the plugin in Obsidian Community plugins.
2. Open its settings and configure the destination or operation as appropriate. Simple is the default; Advanced is optional.
3. Connect the account when the chosen operation needs account authorization.
4. Open a Markdown note and run Rename current note. Use Open renaming options for current note for the interactive workflow.

The current note supplies the AI naming input. Automatic naming is the default; optional review or interactive naming allows editing a proposed name. Case, character replacement, timestamp, backup and subfolder preferences control the local result. Saved automatic-rename preferences are retained.

## Account and usage

Connect the existing Constance account in settings; registration can require email verification before signing in again. Billing account passwords are sent for authentication and are not persisted. Access/refresh session data and a stable installation identity are saved locally. Account free usage and purchased balance are determined by Constance; cached values and checkout return URLs do not create entitlement. Catalog displays current formatted names, prices, availability and exact price IDs. Unknown usage and checkout results retain their original identities for recovery.

One credit is consumed before an eligible rename is applied. Provider failure, cancellation and a no-op do not consume a new credit; a local rename failure can occur after usage consumption. Pending events retain their identity for recovery.

## Troubleshooting

Help is available in settings and through Open documentation. Open plugin settings and Copy diagnostic log are command-palette fallbacks. Debug logging defaults off for a new installation; failures and full Error objects/stacks still appear in the local developer console. Timed information is enabled by the debug preference. The copyable diagnostic buffer keeps at most 1,000 summarized events and excludes raw error text, stacks, note text, paths and credentials. Full console exceptions can contain whatever the failed operation placed in its error. Logs are not uploaded automatically.

Use the console's plugin-name prefix and version to identify the failing stage. A catchable failure stops its affected action; retry after resolving the underlying problem. Historical build/install results apply to their recorded versions.

## Removal

Removing a plugin does not undo earlier file edits or recover an encryption password. Preserve any originals, backups, queues and recovery data you need before removing it. Account purchases remain associated with the account.

See plugin settings for implemented commands, settings defaults and privacy controls.
