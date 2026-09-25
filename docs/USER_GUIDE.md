# Denali AI Renamer — user guide

## What Denali does

Denali suggests filenames from Markdown note bodies and renames notes automatically by default. Enable Review before applying to review and edit suggestions first. It does not generate or edit frontmatter, properties, aliases, tags, or note-body text. Existing YAML frontmatter is excluded from the AI input.

## Get started

1. Install and enable **Denali AI Renamer**.
2. Open **Settings → Community plugins → Denali AI Renamer**.
3. Use Denali's built-in capped OpenRouter key and default model; a personal key remains an optional override in Advanced settings.
4. Choose the model and naming style, then test with a disposable note.

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

Right-click a folder and choose **Denali AI: Batch rename folder**. Choose automatic or interactive mode and watch progress. Denali avoids filename collisions by adding a suffix when necessary. If auto-subfolder is enabled, Denali can create a safe relative destination folder suggested by the model; absolute paths and `..` traversal are rejected.

## Backups, logs, and credits

Enable backups before large batch operations. Denali can keep Markdown logs for troubleshooting. Each completed file rename uses one credit under the current Constance plan; check the settings page for the balance and purchase options.

If the suggested filename already matches the note's current path, Denali skips the rename without using a credit.

## Privacy and limitations

Denali sends up to the configured input limit of note body text to OpenRouter; it removes the YAML frontmatter block before the request. Note content leaves the vault, so do not process confidential notes unless your provider and account setup are appropriate. Denali changes the note's path only. It does not write to the note file contents or frontmatter.

<!-- one-click-workflow:start -->
## Workflow defaults (v5.0.13)

Denali renames files automatically by default, including folder batches. Per-file review is available as an opt-in Settings option.
<!-- one-click-workflow:end -->
