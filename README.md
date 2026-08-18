# Denali AI Renamer and Front Matter

Rename Markdown notes and generate searchable YAML frontmatter from note content using OpenRouter AI.

## Features

- Generate concise or keyword-rich filenames from note content.
- Add or update title, aliases, dates, author, status, project, topic, tags, and other frontmatter fields.
- Rename a current note or process explicitly selected Markdown files.
- Configure the AI model, prompts, naming style, and frontmatter fields.
- Create optional backups before changing files.
- Use optional one-time correction credits through TutivSoft Constance.

## Usage

1. Install and enable Denali AI Renamer and Front Matter.
2. Enter your OpenRouter API key in **Settings > Community plugins > Denali AI Renamer and Front Matter**.
3. Open a Markdown note and use the Denali command or context menu action.
4. Review the proposed filename and frontmatter before applying changes.

## Network Use and Privacy

- The plugin sends note content or selected note samples to OpenRouter at `https://openrouter.ai/api/v1/chat/completions` for the AI operation requested by the user.
- The OpenRouter API key is entered by the user and stored in local plugin settings. It is not bundled in the plugin and is not fetched from a remote backup-key service.
- Optional credit balance and purchase operations use TutivSoft Constance at `https://app.tutivsoft.com`. The plugin sends a random installation device ID, plugin ID, and credit transaction data for these operations.
- Buying credits opens the TutivSoft checkout page in the user's browser. Payment is optional when using any available local free allowance.
- The plugin may read and modify Markdown files inside the current Obsidian vault. It does not access files outside the vault.
- The plugin does not include client-side telemetry, advertising, self-updating, or dependency installation.

## Development

```bash
npm install
npm run build
```

The release assets are `main.js`, `manifest.json`, and `styles.css`.

## License

This plugin is licensed under the MIT License. See [`LICENSE`](./LICENSE).

## Source

The plugin source is in [`main.ts`](./main.ts). The production bundle is
generated from that source with esbuild. Release assets are `main.js`,
`manifest.json`, and `styles.css`.

GitHub release assets are attested by the repository workflow so their
provenance can be verified independently.

## Public Repository Checklist

This folder is the complete public repository staging folder. Copy its contents
into the public repository root, including `.github/workflows/`. Do not upload
credentials, `node_modules`, logs, or private project metadata.

For each release, upload only `main.js`, `manifest.json`, and `styles.css` as
release assets. The release tag must exactly match the `version` in
`manifest.json`.
