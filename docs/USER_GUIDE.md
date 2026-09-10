# Denali AI Renamer and Front Matter — user guide

## What Denali does

Denali reads Markdown note content and helps give notes useful names and searchable YAML frontmatter. It can work on one note or a whole folder.

## First setup

1. Install and enable **Denali AI Renamer and Front Matter**.
2. Open **Settings → Community plugins → Denali AI Renamer and Front Matter**.
3. Use the visible basic settings first. Open **Advanced settings** when you need to change the API key, model, naming style, backups, or metadata fields.
4. Configure the OpenRouter key and model, then test with a disposable note.

## Rename one note

Open a Markdown note and choose **Denali AI: Rename note** from the file menu or command palette. Denali suggests a filename based on the note content. In interactive mode, edit the suggestion before applying it.

### Example

Note content:

```markdown
# Interview preparation

Questions for the Acme DevOps interview on 12 June, including Kubernetes and incident response.
```

Suggested filename:

```text
acme-devops-interview-preparation.md
```

## Rename a folder

Right-click a folder and choose **Denali AI: Batch rename folder**. Choose automatic or interactive mode, review progress, and confirm the final plan. Denali avoids filename collisions by adding a suffix when necessary.

## Generate frontmatter

Use Denali’s frontmatter action on a note to create or update fields such as `title`, `aliases`, `created`, `modified`, `author`, `status`, `project`, `topic`, and `tags`.

Example result:

```yaml
---
title: Acme DevOps Interview Preparation
aliases:
  - Acme interview
status: draft
project: job-search
tags:
  - devops
  - interview
---
```

Review generated metadata before relying on it for search or automation.

## Backups, logs, and credits

Enable backups before large batch operations. Denali can keep Markdown logs for troubleshooting. AI work consumes character credits; the settings page shows the balance and purchase options. Failed or partial operations should be checked before retrying so a note is not renamed twice.

## Privacy and limitations

Note content sent to OpenRouter leaves the vault. Do not process confidential notes unless your provider and account setup are appropriate. Denali does not guarantee factual filenames or metadata, and a live Obsidian runtime is required to verify the menus and file operations.
