# Release Notes

## 5.0.13 - 2026-09-25

- Added a live filename request queue with text excerpts, elapsed time, completion status, and a control to clear waiting requests.

## Previous release — 5.0.4

- Added current product documentation covering implemented features, requirements, architecture, and verified product claims. No runtime behavior changed.

# Release 5.0.3

- Simplified Obsidian command palette labels by removing repeated plugin-name prefixes.

# Denali AI Renamer — Release Notes

## 5.0.2 - 2026-09-23

- Migrate legacy subscription settings to the current credit purchase model so every rename checks entitlement.
- Keep filename collision suffixes sequential and render note names safely in the status log.

## 5.0.1 - 2026-09-23

- Reject unsafe AI subfolder paths, create valid suggested folders when needed, and avoid charging for no-op renames.

## 5.0.0 - 2026-09-23

Denali now focuses on AI-assisted Markdown filenames. YAML frontmatter is removed from AI input, and the plugin no longer generates, adds, edits, or removes metadata. Interactive mode lets users review and edit the filename before the file is renamed. The Obsidian plugin ID stays the same for installed-user upgrades.

## 4.20.13 - 2026-09-22

Updated Constance account registration for email verification and switched billing event IDs to cryptographically secure random values.

<!-- one-click-workflow:start -->
## Workflow defaults (v5.0.13)

Denali renames files automatically by default, including folder batches. Per-file review is available as an opt-in Settings option.
<!-- one-click-workflow:end -->
