# Denali AI Renamer

Create useful Markdown filenames from note content with AI-assisted suggestions.

Version: 5.0.17

## Features

- Rename the current note or process selected Markdown files and folders.
- Rename automatically by default, or enable Review before applying to edit or approve suggestions.
- Watch requests, elapsed time, and completion status in the live request queue.
- Keep note content and existing YAML frontmatter unchanged.
- Use optional backups and Markdown logs to help recover or troubleshoot.

## Get started

1. Install and enable Denali AI Renamer from Obsidian Community plugins.
2. Open Settings, then Community plugins, then Denali AI Renamer.
3. Choose an OpenRouter model and configure the available managed or personal API key option.
4. Open a disposable Markdown note and run the Denali rename command.

## Privacy

Denali sends Markdown note body text to OpenRouter to generate filename suggestions. Existing YAML frontmatter is removed from the AI input. Note text leaves the vault, so do not process confidential notes unless your provider and account setup are appropriate. Renaming changes the file path only; Denali does not change note contents or frontmatter.

Optional account, credit, and purchase features are described in plugin settings.

## Compatibility

Denali requires Obsidian 1.5.0 or later.

See the [complete user guide](docs/USER_GUIDE.md) for commands, batch renaming, settings, backups, logs, and troubleshooting.