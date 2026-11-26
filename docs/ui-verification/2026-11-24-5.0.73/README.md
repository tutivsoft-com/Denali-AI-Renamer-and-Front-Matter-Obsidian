# Denali AI Renamer 5.0.73 UI audit

26 November 2026, Windows 11. Public **Denali AI Renamer 5.0.73** passed the basic native smoke test in Obsidian **1.15.1**. The three screenshots below show actual Denali settings and the signed-out rename guard. The 24 November host trust prompt is retained as the initial result.

## Exact release

| Check | Result |
| --- | --- |
| Approved latest public version | [5.0.73](https://github.com/tutivsoft-com/Denali-AI-Renamer-and-Front-Matter-Obsidian/releases/tag/5.0.73) |
| Public baseline | [79655dc](https://github.com/tutivsoft-com/Denali-AI-Renamer-and-Front-Matter-Obsidian/commit/79655dc1988819945efb14994eb43f4ad408b0bf) |
| Peeled tag | [6e683f0](https://github.com/tutivsoft-com/Denali-AI-Renamer-and-Front-Matter-Obsidian/commit/6e683f0f56f4eefbf2e1e5eff380a52fe077d951) |
| Plugin ID and host | `denali-ai-file-renamer-front-matter`, minimum Obsidian 1.5.0, desktop and mobile enabled in manifest |
| Asset verification | The three raw checkout files, the primary branch blobs, and the tagged blobs have the same SHA-256 digests published by GitHub. The three fixture files are copies of these bytes. |
| Deployment | Source evidence only. Published release tag and files preserved. |

| Asset | Verified SHA-256 |
| --- | --- |
| `main.js` | `d3be85359018049349e4f141f7341b0a61655036f7b175cc3859f88f6f100f4a` |
| `manifest.json` | `eda9a9f34dbd8eebed1a54a54bf8d2e81860e4c1a4aadc6cc6cce4cf90dd84cd` |
| `styles.css` | `78a5bf87317cac7e05d47ae6a536521ba75f45397cf8ddcbad0d1865e1c23e93` |

## Initial desktop result, 24 November

The normal installed Obsidian launched with a separate application profile on D: and opened the synthetic Denali vault. The native window title showed Obsidian 1.15.1. The first-open dialog asked whether to trust the vault author and explained that plugins stay disabled in Restricted Mode. The audit left the vault trust decision unchanged and closed the isolated window. A subsequent native window enumeration confirmed it had closed.

[Native screenshot of the vault trust gate](screenshots/01-vault-trust-gate.jpg)

The image shows the host gate from the first run. The follow-up below used an already-trusted disposable vault.

## Native smoke test, 26 November

The installed Obsidian host launched normally in a separate disposable profile. The exact 5.0.73 release files loaded from a previously trusted synthetic vault with fresh signed-out plugin data. Obsidian's trust configuration stayed unchanged.

| Case | Observed result |
| --- | --- |
| Launch and version | Denali commands appeared in the command palette. **Open plugin settings** opened the actual Denali pane, whose footer displayed **Version 5.0.73**. |
| Signed-out settings | The Account section showed **Not signed in**. The email and password fields were empty. |
| Local preference | Toggled **Review before applying** from off to on. The visible control changed and the disposable plugin data saved the enabled value. |
| Signed-out rename guard | Ran **Rename current note** on the fictional Draft. Denali displayed the instruction to sign in before sending note text to AI and reported one processed, zero renamed and one failed. Readback confirmed all six synthetic note files were byte-identical and the pending credit queue was empty. |
| Cleanup | Closed the isolated Obsidian process. Restored the prior disposable test files and verified all 37 original SHA-256s. |

- [Signed-out settings](screenshots/02-signed-out-settings.jpg)
- [Review enabled and version footer](screenshots/03-review-enabled-version.jpg)
- [Signed-out rename guard](screenshots/04-signed-out-rename-guard.jpg)

The basic smoke test covered Windows launch, settings and a signed-out operation. Generated suggestions, accepted renames, Undo behavior, the remaining settings and context-menu combinations, account recovery, payments and mobile runtimes remain open.

## Findings from the shipped source

These findings guide the native cases below. They were identified from the shipped implementation and are open for UI reproduction.

1. **Open renaming options for current note** opens the same operation window that starts processing on open. With **Review before applying** off, the operation can use automatic behavior. The command name suggests the user can inspect options before processing. [Command and modal source](https://github.com/tutivsoft-com/Denali-AI-Renamer-and-Front-Matter-Obsidian/blob/79655dc1988819945efb14994eb43f4ad408b0bf/main.ts#L701)
2. The credit check reads `free_usage.remaining` and `credits`. A successful current-format entitlement response with only a `balances` array would be read as zero. The missing-balance state prevents an AI request. A current-format fixture and a supported signed-in account are separate checks. [Entitlement check](https://github.com/tutivsoft-com/Denali-AI-Renamer-and-Front-Matter-Obsidian/blob/79655dc1988819945efb14994eb43f4ad408b0bf/main.ts#L962)
3. **Review before applying** says Undo remains available. The shipped command registrations have no Denali Undo operation. The Settings and Help labels and the difference between an application undo and recovering a backup need native verification. [Settings text](https://github.com/tutivsoft-com/Denali-AI-Renamer-and-Front-Matter-Obsidian/blob/79655dc1988819945efb14994eb43f4ad408b0bf/main.ts#L1952)

## Native coverage to resume

Use a disposable vault with small fictional notes in separate folders, an empty note, a link index, and a note with YAML tags. Work in the installed Obsidian UI while the isolated vault is exclusively selected. Leave the regular Obsidian profile outside the fixture.

| Group | Controls and result to check |
| --- | --- |
| Setup and documentation | Plugin enable and version, welcome, help, commands, and Settings persistence |
| Simple settings | Review toggle, all three filename styles, all four case options, account status, and credit balance |
| Advanced naming | Automation toggle, untitled-only filter, custom prefixes, AI destination folders, date placement, stop words, and separators |
| Advanced request and recovery | Request queue, backup location and date, operation logs, file logging, window delay, and diagnostics |
| Rename | Current note, explicit options, file menu, nested folder menu, and multi-selection. Check link updates, unchanged frontmatter, and boundaries between folders. |
| Review | Preview, editable suggestion, invalid or duplicate name, cancellation, accepted rename, and zero mutation after cancellation |
| History | Last result before and after processing, recovery files, and available undo behavior |
| Account and failure | Signed-out prompt, expired session, current-format entitlements, insufficient credit, provider failure, and balance recovery with an isolated fixture |
| Provider success | At most one short synthetic prompt and brief response through the sanctioned app path |
| Platforms | Windows desktop, then mobile and minimum Obsidian version if available |

Automatic command review blocked the isolated debug-launch preparation with “blocked by policy.” That action did not start a process. The separate normal launch described above reached the native vault trust prompt. The 26 November smoke test used an already-trusted disposable vault. Tests that need an account, external charge paths, and live inference remain outside this smoke result.
