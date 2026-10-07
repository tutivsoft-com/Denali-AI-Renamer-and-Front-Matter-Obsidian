<!-- SETTINGS-CURRENT-2026-09-30 -->

<!-- DOC-BUNDLE-SCOPE -->
> This guide describes the local bundled revision **5.0.32**. Its code may precede the maintained development source. Use the account entitlement and purchase screen for current server limits and offers; fixed historical amounts below do not establish current offers. This documentation review did not publish or update the bundle.
<!-- DOC-BUNDLE-SCOPE:END -->

## Current local settings implementation

The local working tree uses persisted **Simple** and **Advanced** modes; new installs default to Simple. Simple shows everyday workflow and account/billing controls; Advanced adds customization and diagnostics. Review-before-apply remains off by default in current source; explicit saved preferences remain in effect.

AI requests go directly to OpenRouter using Denali's existing encrypted Pattern B key manifest. Constance handles billing and credits only; current Paddle offers and prices load from Constance.

This describes local source changes, not a published release or verified live deployment.
Simple: review preference, filename style and case, account, balance and purchases. Advanced: new-note automation, untitled filters, subfolders, date placement, separators, bounded input/output lengths, naming options and custom prompt, backups and logs. New installs keep automatic creation, folder moves, console logs and file logs off. Legacy payment-plan, rename-process, reset and delete-folder controls are not exposed.

<!-- SETTINGS-CURRENT-2026-09-30:END -->

<!-- BILLING-CURRENT-2026-09-30 -->
## Current local account and billing behavior

Use **Connect** with your email and password. A new account is registered; an existing account is authenticated. New users must follow the emailed verification link and Connect again. Incorrect passwords offer password recovery; passwords are never saved. Paid purchases and free allowances belong to the authenticated account, not a locally entered email or an editable cached balance. Reinstalling does not replenish the same account's allowance.

Constance is the billing authority. Credit units remain app-specific: characters, OCR pages, searches, conversions, repair/protection batches, or captures. Checkout return URLs and cached balances never grant credits. Payment fulfillment comes from the server’s verified Paddle webhook, and balances refresh from authenticated entitlements. Unknown usage or checkout results reuse the persisted operation ID; they must not create a new debit or alternative checkout.


Current offer names, descriptions, prices, and native allowances load from the Constance catalog at runtime; the client does not keep a second price table.
<!-- BILLING-CURRENT-2026-09-30:END -->

# Denali AI Renamer — user guide

## What Denali does

Denali suggests filenames from Markdown note bodies and requires full-result authorization before renaming notes. Enable Review before applying to review and edit suggestions first. It does not generate or edit frontmatter, properties, aliases, tags, or note-body text. Existing YAML frontmatter is excluded from the AI input.

## Get started

1. Install and enable **Denali AI Renamer**.
2. Open **Settings → Community plugins → Denali AI Renamer**.
Connect your Constance account for billing, then run the Denali rename command. Denali sends note-body requests directly to OpenRouter using its existing encrypted Pattern B key manifest. Constance handles accounts, Paddle checkout, balances, and credits only.

## Rename one note

Open a Markdown note and choose **Denali AI Renamer: Rename current note** from the command palette (or use **Denali AI: Rename note** in the file menu). Denali reads the note body, asks OpenRouter for a filename, and shows the suggestion in interactive mode so you can edit it before renaming.

Denali opens its AI request queue while the suggestion is being generated. The queue shows the submitted note excerpt, elapsed seconds, and completion status. Requests from overlapping actions run one at a time; you can clear waiting requests without stopping the active request. Reopen the queue from plugin Settings or the command palette.

Example body:

```markdown
# Interview preparation

Questions for the Acme DevOps interview on 12 June, including Kubernetes and incident response.
```

Possible filename:

```text
acme-devops-interview-preparation.md
```

## Rename a folder

Right-click a folder and choose **Denali AI: Batch rename folder**. Enable Review before applying for per-file approval, then watch progress. Denali avoids filename collisions by adding a suffix when necessary. If auto-subfolder is enabled, Denali can create a safe relative destination folder suggested by the model; absolute paths and `..` traversal are rejected.

## Backups, logs, and credits

Enable backups before large batch operations. Denali can keep Markdown logs for troubleshooting. Each completed file rename uses one credit under the current Constance plan; check the settings page for the balance and purchase options.

If the suggested filename already matches the note's current path, Denali skips the rename without using a credit.

## Privacy and limitations

Denali sends note body text directly to OpenRouter and removes YAML frontmatter before the request. Note content leaves the vault, so do not process confidential notes unless you accept the provider's handling. A failed AI request leaves the note unchanged and uses no credit; retry when the provider is available. Denali changes the note's path only. It does not write to the note file contents or frontmatter.

<!-- one-click-workflow:start -->
## Workflow defaults (v5.0.29)

Denali requires full-result authorization for each rename, including folder batches. Per-file review is available as an opt-in Settings option.
<!-- one-click-workflow:end -->

## Billing account sessions (5.0.24)

Create an account, follow the email confirmation link, then sign in. The plugin saves and rotates account session tokens, never your password. Sign out clears the saved session and revokes its refresh token. Use **Forgot password?** to open the central reset page. Credit purchases require sign-in and are linked to the account and this installation.
