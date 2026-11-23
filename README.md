# Denali AI Renamer

Rename Markdown notes from their content with the existing automatic or optional review workflow.

## Use

Install or update Denali AI Renamer through Obsidian Community plugins, enable it, and connect your account in the plugin settings. Run **Rename current note** from the command palette for the open Markdown note. To rename several notes, select them in the file explorer and choose **Denali: Rename selected notes** from the context menu. Enable **Review before applying** to preview and edit each proposed filename before it changes. Existing preferences and local recovery records are retained.

## Account and billing

Connect your Constance account in plugin settings. If you create an account, confirm the email link and then connect again. Authentication, current offers, free allowance, purchased balance and payment confirmation use the Constance v2 service at https://app.tutivsoft.com.

Current paid names, descriptions, prices, currencies and included units come from the payment provider through Constance. Refresh the displayed offers before buying. If current pricing cannot be verified, buying is unavailable. Only canonical payment fulfillment grants credits. A completed purchase stays saved until the refreshed balance is saved and acknowledged. Pending requests retain their original identity after a retry or restart. Account and Buy credits use separate theme-aware sections with standard Obsidian controls. Balance summaries stay with Account. Purchase progress and elapsed time appear directly below the offers. Automatic checks begin after three seconds, then every five seconds for up to five minutes. Check payment and Cancel current purchase are the only purchase-status actions. Completion requires canonical fulfillment, a saved refreshed balance and acknowledgement of the original purchase. A browser return or timer does not grant credits.

New purchases use Paddle and USD. Existing historical purchases retain their original provider. No payment credentials are bundled in the plugin.

## Privacy and recovery

Account requests send authentication and billing information to Constance. Passwords are not saved. Session credentials and recovery state are kept in local plugin settings. Billing requests do not include note contents. When you request a filename suggestion, Denali sends text from the Markdown note to OpenRouter, up to the configured input limit. Matomo receives basic usage events without note contents. The local diagnostic buffer is separate from automatic startup and plugin error reports sent to Datadog. Reports include the plugin version, platform, error details and recent action names. Credentials are redacted; details from a failed operation can include file paths or content.

Uncertain older billing records are retained and are never replayed as new v2 charges. Connect the original account and contact support if an earlier operation needs recovery.

## Version 5.0.73

Fix rename links, filename validation, filtering, casing, and file logs.

Requires Obsidian 1.5.0 or later. [GitHub release 5.0.73](https://github.com/tutivsoft-com/Denali-AI-Renamer-and-Front-Matter-Obsidian/releases/tag/5.0.73).

## Support

Choose **Open Help** in the plugin settings or run **Open documentation** from the command palette. Run **Copy diagnostic log** to collect details about a rename problem. For billing help, use the account portal and keep the original purchase or operation ID. Keep passwords and session tokens private.
