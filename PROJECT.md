# DDScope — Project

> Central reference for DDScope. Readable by any AI assistant, developer, or contributor.
> For Claude Code operational setup, see `CLAUDE.md`.

## Role

DDScope is a CommWise web application built by b2wise. It supports DDMRP scoping workshops — consultants use it to build supply chain maps capturing current-state structure before buffer design begins.

The AI assistant works alongside the lead developer to design, implement, and maintain the application.

## Interactive Sessions

Conversation language: French.

## Repo Autonomy Rule

The repo must be fully usable without Claude Code — by a human developer or any other AI agent (e.g. an AI working directly via CommWise). Any knowledge needed to understand or contribute to the project belongs in `README.md` or `docs/`.

`CLAUDE.md` is the right place only for what is specific to Claude Code as an agent: its execution environment, its tool constraints, its operational patterns.

When memorizing something, apply this test: *could another AI working via CommWise need this?* If yes → `docs/` (see placement rules in `docs/README.md`). If it is specific to how Claude Code operates as an agent → `CLAUDE.md`.

## Idea Inboxes

### Slack (#ddscope-sync)

`#ddscope-sync` (channel ID: `C0B5RSURETF`) serves as an asynchronous idea inbox (notes posted from phone or outside sessions).

On request at the start of a session: read the channel, present unprocessed messages, and discuss what to do with each. Once handled, add a ✅ reaction to mark it as processed. No deletion, no mandatory import target.

**Reading the channel — reaction check (mandatory):**

`slack_read_channel` does not return reactions. To identify already-processed messages, call `slack_get_reactions` on each message individually after reading the channel. Messages with a ✅ reaction are already processed and must be skipped. Only present messages without a ✅ reaction.

### Notion (Canal DDScope)

Database URL: `https://www.notion.so/8845001f0d0c83efa0098157aef9677c`  
Columns of interest: `Details` (content), `Statut` (status).  
Status values: `À faire` | `En cours` | `Retour IA` | `Traité`.

On request at the start of a session: read the database, present unprocessed entries (all entries where `Statut ≠ Traité`), and discuss what to do with each. Once handled, update `Statut` to `Traité`.

## Audit

To audit this project's conformance to Claude.ai best practices:

1. Read: `C:\Users\RemiLequette\Development\projects\claude-knowledge\guides\audit-process.md` — audit methodology
2. Verify against: `C:\Users\RemiLequette\Development\projects\claude-knowledge\guides\Claude.ai-best-practices.md` — source of truth
3. Review documented deviations: `DEVIATIONS.md`

## Glossary

See `GLOSSARY.md` at project root.
