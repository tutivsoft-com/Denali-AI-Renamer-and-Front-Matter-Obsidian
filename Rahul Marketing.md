Here are the requested code snippet and Markdown file.

### Code Snippet

```typescript
// Denali AI File Renamer Documentation
//
// This plugin automatically renames files and enriches their frontmatter using AI.
//
// * Customization: Easily change the AI model from the `OPENROUTER_MODELS` array. You can also edit the prompts for the AI, located in the `PROMPT_STYLES` and `DEFAULT_SETTINGS` constants.
// * Settings: Key configurations are managed in the `DenaliSettings` interface and `DEFAULT_SETTINGS` object, including API keys, file naming styles, and frontmatter properties.
// * Workflow: The program starts with `onload()`, which registers commands and events. User actions trigger the `DenaliAIOptionsModal`, which then uses the `FileRenamer` class to handle core logic: fetching AI suggestions, updating frontmatter, and renaming the file.
// * Future: All UI settings can be hidden or shown via a boolean flag in the `DenaliSettings` interface.
```

-----

### Markdown Documentation

# Denali AI File Renamer Documentation

This plugin automates file renaming and frontmatter management using AI. It's designed for customization and efficient workflow.

## Key Features

  * **AI-Powered Naming:** The plugin analyzes your note's content and suggests a new, descriptive filename based on configurable prompts.
  * **Frontmatter Automation:** It can automatically add or update frontmatter properties like `title`, `author`, `created`, `modified`, `status`, and `project` based on AI analysis.
  * **Batch Renaming:** You can apply the renaming process to an entire folder of notes.
  * **Backup & Logging:** The plugin can create backups of original files before renaming and logs all actions to a dedicated log file for easy review.

## Configuration & Customization

All plugin settings are located in the `DenaliSettings` interface and `DEFAULT_SETTINGS` constant in the main code file. You can easily modify these values to fit your needs.

  * **`openRouterApiKey`**: Your API key for the OpenRouter service.
  * **`aiModel`**: Choose from a list of available models to balance cost and performance.
  * **`aiNameStyle`**: Select a pre-defined prompt style (`balanced`, `keywordFilled`, `nicheWordsOnly`) or set your own custom one.
  * **`maxInputLength`**: A cost-saving measure to limit the amount of text sent to the AI.
  * **`fileNameCase`**: Automatically format the new filename to `kebab-case`, `camelCase`, `lowercase`, or keep the `original` AI suggestion.
  * **`addAlias`**: Preserve the old filename as a `yaml` alias in the note's frontmatter, so links don't break.
  * **`addTitle`, `addAuthor`, etc.** : Toggles for enabling/disabling the automatic addition of specific frontmatter properties.
  * **`display...` settings**: These boolean flags control whether individual settings are visible in the plugin's settings tab, allowing you to create a cleaner UI by hiding unused options.

## Core Workflow

The plugin's process is straightforward:

1.  **Event Trigger**: The `onload()` function registers events, such as when a file is created or a command is invoked.
2.  **Modal Display**: The `DenaliAIOptionsModal` is opened, either interactively or automatically, to show progress and gather user input.
3.  **AI Analysis**: The `FileRenamer` class reads the file content, sends a truncated version to the AI with a specific prompt, and receives a new name suggestion and other frontmatter properties.
4.  **File Modification**: It applies the new name, updates the frontmatter, and performs a backup if enabled. A notice confirms the successful rename.
5.  **Logging**: All steps, including successes and errors, are logged to the console and an optional log file.