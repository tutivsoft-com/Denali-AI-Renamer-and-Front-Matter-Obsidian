# Denali AI Renamer

Version: 5.0.39. Validated for publication; release pending.

## Purchases

Purchase settings load the app's current offer configuration and Paddle prices from Constance. Offer quantities use the app's native billing unit from that configuration; displayed amounts and descriptions come from the current provider price. The client matches offers by exact configured price ID and enables purchase only when Constance reports `checkout_available`. Checkout sends that exact price ID through the authenticated billing route. Prices and pack quantities are not fixed in the plugin. Existing account balances and granted credits remain associated with the account.

## Settings

Denali provides persisted **Simple** and **Advanced** settings modes; new installs default to Simple. Simple shows everyday workflow and account/billing controls; Advanced adds customization and diagnostics. Review before applying is optional.

Denali sends note-body requests directly to OpenRouter using its existing encrypted Pattern B key manifest. Constance handles account sessions, Paddle offers and checkout, balances, and credits only. Current prices and offer descriptions are loaded from Paddle through Constance; the plugin does not hardcode them.

Simple settings cover review preference, filename style and account controls. Advanced settings include batch and naming options, subfolders, backups and diagnostics. New installs keep automatic creation, folder moves, and file logs off.

## Account and billing

Use **Connect** with your email and password. A new account is registered; an existing account is authenticated. New users must follow the emailed verification link and Connect again. Incorrect passwords offer password recovery; passwords are never saved. Paid purchases and free allowances belong to the authenticated account, not a locally entered email or an editable cached balance. Reinstalling does not replenish the same account's allowance.

Constance is the billing authority. Constance manages Denali account sessions, checkout, balances, and credits. Current offers, prices, and descriptions are read from its catalog. Completed renames use the applicable account credit; failed requests do not.

Create useful Markdown filenames from note content with AI-assisted suggestions.

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

## AI and billing

AI requests go directly to OpenRouter. A failed request leaves the note unchanged and does not charge a credit; a user can retry. Constance handles account sessions, Paddle checkout, balance, and credit accounting. Current offer IDs, amounts, and descriptions are read from the live catalog.

## Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the matching published release and place them in `.obsidian/plugins/denali-ai-file-renamer-front-matter/`, then enable the plugin in Obsidian.


### Getting started with your account

Open a Markdown note, then run the Denali rename command to generate a filename. Create an account or sign in in the plugin settings, verify your email if requested, then connect. Free AI usage requires a registered, connected account to help prevent abuse. The default lifetime allowance is 10 AI credits per account as our thank-you for trying the app; settings check the current policy and account balance. You can add credits at affordable prices once you are ready; the current offers and prices load in settings. Setup guidance stays visible until connected, and the welcome appears only once.

## Account lifetime allowance

10 credits lifetime per account. Rename credits for completed operations. Existing allowance consumption survives upgrades and reinstalls; lifetime allowances do not refill daily. Free units are used first and purchased units cover the remainder of the same operation. Native writes retain reserve, write, verify and finalize safeguards. Uncertain results retain the original event for recovery. The app retains its existing review and result-authorization workflow.

The allowance belongs to the account and does not reset daily or after reinstalling. Free units are consumed first; purchased units cover the remainder. Current prices and available offers load from Constance in settings.

AI requests use the fixed OpenRouter model `~openai/gpt-luna-latest`. Legacy saved model preferences do not change the request model.

AI requests use the fixed OpenRouter model `~openai/gpt-luna-latest`. Legacy saved model preferences do not change the request model.
