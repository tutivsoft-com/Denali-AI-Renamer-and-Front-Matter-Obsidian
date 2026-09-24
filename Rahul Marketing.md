# Denali AI Renamer

Denali helps turn untitled or poorly named Markdown notes into clear, searchable filenames with AI-assisted suggestions.

## What it does

- Suggests filenames from note body content with OpenRouter models.
- Supports single-note and folder rename workflows.
- Validates AI-suggested subfolders and creates valid destinations when needed.
- Offers interactive review, configurable naming styles, and optional custom prompts.
- Checks for filename collisions and can make backups before renaming.
- Leaves the note file contents unchanged. YAML frontmatter is excluded from AI input and is never generated or edited by Denali.

## How it works

1. Start a rename from a note or folder command.
2. Denali sends the note body, without its YAML frontmatter block, to the configured OpenRouter model.
3. Review or edit the filename suggestion in interactive mode.
4. Denali renames the file through Obsidian's vault API; the content remains the same.

Configure the model, key, and naming style in the plugin settings. See `../docs/USER_GUIDE.md` for the complete guide.
