## Current purchase behavior

Purchase settings load the app's current offer configuration and Paddle prices from Constance. Offer quantities use the app's native billing unit from that configuration; displayed amounts and descriptions come from the current provider price. The client matches offers by exact configured price ID and enables purchase only when Constance reports `checkout_available`. Checkout sends that exact price ID through the authenticated billing route. Prices and pack quantities are not fixed in the plugin. Existing account balances and granted credits remain associated with the account.

<!-- SETTINGS-CURRENT-2026-09-30 -->
## Current local settings implementation

The local working tree uses persisted **Simple** and **Advanced** modes; new installs default to Simple. Simple shows everyday workflow and account/billing controls; Advanced adds customization and diagnostics. Review-before-apply remains off by default in current source; explicit saved preferences remain in effect.

Denali sends note-body requests directly to OpenRouter using its existing encrypted Pattern B key manifest. Constance handles account sessions, Paddle offers and checkout, balances, and credits only. Current prices and offer descriptions are loaded from Paddle through Constance; the plugin does not hardcode them.

This describes local source changes, not a published release or verified live deployment.
Simple: review preference, filename style and case, account, balance and purchases. Advanced: new-note automation, untitled filters, subfolders, date placement, separators, bounded input/output lengths, naming options and custom prompt, backups and logs. New installs keep automatic creation, folder moves, console logs and file logs off. Legacy payment-plan, rename-process, reset and delete-folder controls are not exposed.

<!-- SETTINGS-CURRENT-2026-09-30:END -->

<!-- BILLING-CURRENT-2026-09-30 -->
## Current local account and billing behavior

Use **Connect** with your email and password. A new account is registered; an existing account is authenticated. New users must follow the emailed verification link and Connect again. Incorrect passwords offer password recovery; passwords are never saved. Paid purchases and free allowances belong to the authenticated account, not a locally entered email or an editable cached balance. Reinstalling does not replenish the same account's allowance.

Constance is the billing authority. Credit units remain app-specific: characters, OCR pages, searches, conversions, repair/protection batches, or captures. Checkout return URLs and cached balances never grant credits. Payment fulfillment comes from the server’s verified Paddle webhook, and balances refresh from authenticated entitlements. Unknown usage or checkout results reuse the persisted operation ID; they must not create a new debit or alternative checkout.


See [local billing changes](BILLING_REVIEW_2026-09-30.md). This section describes the current local source; older release walkthroughs below apply to their dated artifacts. Constance must support `/api/v1/auth/connect` before these clients are released.
<!-- BILLING-CURRENT-2026-09-30:END -->

# Denali AI Renamer

Create useful Markdown filenames from note content with AI-assisted suggestions.

Local source version: 5.0.30

## Features

- Rename the current note or process selected Markdown files and folders.
- Rename automatically by default, or enable Review before applying to edit or approve suggestions.
- Watch requests, elapsed time, and completion status in the live request queue.
- Keep note content and existing YAML frontmatter unchanged.
- Use optional backups and Markdown logs to help recover or troubleshoot.

## Get started

1. Install and enable Denali AI Renamer from Obsidian Community plugins.
2. Open Settings, then Community plugins, then Denali AI Renamer.
3. Connect your Constance account for billing, then run the Denali rename command.
4. Open a disposable Markdown note and run the Denali rename command.

## Privacy

Denali sends Markdown note body text directly to OpenRouter to generate filename suggestions, using its existing encrypted Pattern B key manifest. Existing YAML frontmatter is removed from the AI input. Note text leaves the vault, so do not process confidential notes unless you accept the provider's handling. Renaming changes the file path only; Denali does not change note contents or frontmatter. Constance handles billing and credits only.

A Constance account is required for metered filename generation; connect and manage credits in plugin settings.

## Compatibility

Denali requires Obsidian 1.5.0 or later.

See the [complete user guide](docs/USER_GUIDE.md) for commands, batch renaming, settings, backups, logs, and troubleshooting.

## Account, billing, and credit feedback

Account and billing controls appear at the top of settings. Select Connect with your email and password; verify the emailed link if requested, then Connect again. The settings page shows the current balance and provides balance refresh, sign-out, and purchase controls. Metered actions show the available balance and report the amount used with the remaining balance when the action completes.

Current local source version: 5.0.30.



## AI and billing

AI requests go directly to OpenRouter. A failed request leaves the note unchanged and does not charge a credit; a user can retry. Constance handles account sessions, Paddle checkout, balance, and credit accounting. Current offer IDs, amounts, and descriptions are read from the live catalog.

<!-- RA1-CODEBASE-SNAPSHOT:START -->
## Local Codebase Snapshot

Updated: `2026-10-02`

Source scanned from: `C:\Users\Rahul\Desktop\ghrepos\tool-app-Obsidian-Denali-AI-Renamer`
Category: `Local repositories`
Current branch: `main`

### Detected Stack

- `JavaScript` (15)
- `TypeScript` (12)
- `CSS` (2)
- `Shell` (1)

### Source Map

- Code files scanned: `30`
- Markdown/docs files scanned: `42`
- Manifest/deploy files scanned: `2`
- Main source areas: `denali-ai-renamer/` (24), `publish/` (23), `/` (21), `docs/` (6)

### Main Entry Points

- `denali-ai-renamer\main.js`
- `denali-ai-renamer\main.ts`
- `publish\main.js`
- `publish\main.ts`

### Manifests And Deploy Files

- `denali-ai-renamer\package.json`
- `denali-ai-renamer\tsconfig.json`

### Documentation Files

- `AGENTS.md`
- `ai_model.md`
- `ai_model_change_20260910224059.md`
- `architecture.md`
- `BILLING_REVIEW_2026-09-30.md`
- `CHANGE_IN_MODEL_20260817102257.md`
- `CHANGELOG.md`
- `chatgpt_sol_analysis_20260920141546.md`
- `CONTRIBUTORS.md`
- `denali-ai-renamer\Rahul Marketing.md`
- `denali-ai-renamer\README.md`
- `docs\END_TO_END_OBSIDIAN_RELEASE_WORKFLOW.md`
- `docs\OBSIDIAN_RELEASE_RUNBOOK.md`
- `docs\release-evidence\5.0.17.md`
- `docs\release-evidence\obsidian-community-5.0.22.md`
- `docs\RELEASE_STATUS_2026-09-12.md`
- `docs\USER_GUIDE.md`
- `FEATURES.md`
- ... 24 more

### Detected Routes Or App Handlers

- No framework route declarations detected by the scanner.

### Detected Package Commands

- No package.json scripts detected at repo root.

### Maintenance Rule

When source files, routes, user flows, manifests, Docker/compose settings, or deployment behavior change, refresh this managed block with:

```bash
python "C:/Users/Rahul/Desktop/ghrepos/RA1/MAIN/40 Common/Scripts/refresh_local_repo_docs.py" --repo "tool-app-Obsidian-Denali-AI-Renamer"
```
<!-- RA1-CODEBASE-SNAPSHOT:END -->
