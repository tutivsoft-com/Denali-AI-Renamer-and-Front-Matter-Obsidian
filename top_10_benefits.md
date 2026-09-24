# Top 10 Benefits of Denali AI Renamer and Front Matter

1. **Intelligent Content-Based Note Renaming**
   - **Benefit:** Generates descriptive, clean note titles based on actual note contents, eliminating "Untitled" files.
   - **Example:** Renames a raw meeting transcript `Untitled 14.md` to `2026-09-Q3-Marketing-Strategy-Review.md`.

2. **Automated YAML Frontmatter Generation**
   - **Benefit:** Creates structured, standardized metadata headers for your notes automatically.
   - **Example:** Injects clean YAML keys (`title`, `date`, `tags`, `summary`, `status`) at the top of an unstructured note.

3. **Existing Metadata Preservation & Merge**
   - **Benefit:** Updates or adds missing frontmatter properties without erasing your custom existing keys.
   - **Example:** Keeps your custom `project: Apollo` and `priority: high` fields while generating missing `tags` and `summary`.

4. **Automated Link & Backlink Integrity**
   - **Benefit:** Renaming notes through Obsidian APIs updates all incoming wikilinks across the vault.
   - **Example:** Renaming `Rough Ideas.md` automatically updates `[[Rough Ideas]]` to the new name in 25 other notes.

5. **Batch Folder Processing**
   - **Benefit:** Organize, rename, and tag entire directories of messy imports simultaneously.
   - **Example:** Select an imported `Web Clippings` folder and standardize every note in a single run.

6. **Pre-Apply Review & Diff Inspector**
   - **Benefit:** Inspect proposed filename changes and generated YAML diffs before any file is touched.
   - **Example:** Review a table of old names vs new proposed names and uncheck any you want to leave as-is.

7. **Custom Prompt & Classification Tuning**
   - **Benefit:** Tailor AI instructions to match your personal taxonomy or Zettelkasten conventions.
   - **Example:** Configure Denali to always include date prefixes (e.g., `YYYY-MM-DD-title`) and enforce specific tag formats.

8. **OpenRouter Model Choice**
   - **Benefit:** Choose optimal LLM backends for speed or semantic classification depth.
   - **Example:** Use a fast model to process hundreds of notes rapidly and economically.

9. **Safety Safeguards & Restore Capabilities**
   - **Benefit:** Revert recent batch naming operations if you change your mind.
   - **Example:** Run *Denali: Restore recent changes* to bring back previous filenames if needed.

10. **Local Settings Privacy**
    - **Benefit:** Vault contents are only processed upon explicit command, with no background tracking.
    - **Example:** Notes are only sent to the designated AI API when you click the action.

<!-- one-click-workflow:start -->
## Workflow defaults (v5.0.9)

Denali renames files automatically by default, including folder batches. Per-file review is available as an opt-in Settings option.
<!-- one-click-workflow:end -->
