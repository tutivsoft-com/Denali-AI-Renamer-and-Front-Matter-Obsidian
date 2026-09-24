# Denali AI Renamer Features

Denali is an Obsidian plugin for generating and applying AI-assisted filenames to Markdown notes. The current release keeps note content and YAML frontmatter unchanged.

## Implemented

- Suggest a filename from the Markdown note body. The opening YAML frontmatter block is excluded from the AI request.
- Rename automatically by default, with an optional interactive mode for editing suggestions.
- Rename the current note or batch-process Markdown notes in a selected folder.
- Optionally accept a safe relative subfolder suggestion. Absolute paths, traversal segments, and invalid path characters are rejected.
- Avoid changing the path when the suggestion is already the current path; check destination collisions and add a suffix when needed.
- Optionally create backups and diagnostic logs according to plugin settings.
- Use an OpenRouter model chosen in settings, with a user-provided key taking precedence over Denali's managed key connection when configured.
- Link to TutivSoft Constance for account-based rename credits and balance refresh.

## Content and privacy boundary

The note body is sent to OpenRouter for a filename suggestion. Frontmatter is removed from that request. Applying a suggestion changes the note path through Obsidian's vault API; Denali does not rewrite the Markdown body or frontmatter. Use a provider and account configuration suitable for the notes you choose to process.

See [README.md](README.md), [REQUIREMENTS.md](REQUIREMENTS.md), [architecture.md](architecture.md), and [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for setup, constraints, data flow, and user instructions.

<!-- one-click-workflow:start -->
## Workflow defaults (v5.0.9)

Denali renames files automatically by default, including folder batches. Per-file review is available as an opt-in Settings option.
<!-- one-click-workflow:end -->
