# Denali AI Renamer — AI Model Evidence

Reconciled: `2026-09-23`

## Model authorship

**Repository authoring model:** Unknown.

Obsidian API usage, prompt text, source style, and the existence of AI features
do not establish which model authored a code change. Older versions of this
file inferred ChatGPT authorship from generic plugin patterns; that inference
was unsupported and is superseded by this record.

## Runtime model

Denali sends note-body text to OpenRouter to suggest filenames. Users can
select a model in settings; the source default is
`~deepseek/deepseek-v4-flash-latest`. Runtime model selection is product
configuration and is not repository authorship evidence. YAML frontmatter is
excluded from the request, and the plugin no longer generates or edits it.

## Attribution evidence

Git author identities identify the committer, not the model that generated
individual lines. No reliable model-authorship evidence was found in the
repository. Historical model-change notices remain records of the dates and
claims written at those times; they are not proof of code authorship.

Secret values must never be copied into this file.
