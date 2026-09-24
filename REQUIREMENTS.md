# Denali AI Renamer Requirements

## Product scope

Denali suggests names for Markdown notes and renames their paths after a user action. It does not generate or edit frontmatter, note properties, aliases, tags, or note-body text.

## Implemented requirements

- Read a Markdown note and exclude its opening YAML frontmatter block from the AI prompt.
- Request a filename suggestion from the configured OpenRouter model.
- Support a review-and-edit flow for an individual note and an automatic mode for folder batches.
- Reject unsafe suggested destinations, including absolute paths, parent traversal, invalid filename characters, and path collisions.
- Skip a rename when the accepted destination is already the current path.
- Apply path changes with Obsidian's vault API and preserve the original Markdown contents.
- Allow optional backups and diagnostic logs, controlled by plugin settings.
- Expose setup, naming, batch, and Constance credit controls through Obsidian settings and commands.
- Keep the plugin ID stable for updates to existing installations.

## Runtime and privacy constraints

- Note content is sent to OpenRouter when the user runs a rename. Only the note body is sent; the opening YAML frontmatter is omitted.
- The user-provided OpenRouter key takes precedence when configured. Otherwise the managed encrypted key connection may be used.
- Constance handles account linking, balance, checkout, and rename credit operations. The plugin does not include a shared billing secret or server callback.
- Renaming must not rewrite note body text or frontmatter. Backups and logs are optional user-controlled behavior.
- API/network failures must be surfaced without silently changing the note contents or applying an unsafe path.

## Non-goals and release checks

- Frontmatter creation, mutation, cleanup, and AI metadata enrichment are outside Denali's current scope.
- Denali does not guarantee that generated filenames are correct; users should review suggestions when using interactive mode.
- The release bundle must keep source, manifest, version map, documentation, and built runtime aligned. The public tagged release must include the reviewable TypeScript source.
- Fresh-vault smoke testing should check a single note, a folder batch, cancellation, collision handling, backup settings, and byte-for-byte note-content preservation.

<!-- one-click-workflow:start -->
## Workflow defaults (v5.0.10)

Denali renames files automatically by default, including folder batches. Per-file review is available as an opt-in Settings option.
<!-- one-click-workflow:end -->
