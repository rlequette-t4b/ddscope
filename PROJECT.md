# DDScope — Project

Central reference for DDScope. Readable by any AI assistant, developer, or contributor.

## Quick Start

DDScope is a CommWise web application supporting DDMRP scoping workshops.
Load at session start — provides project context, AI Agent Setup, and Idea Inboxes.
Does not replace `docs/` for technical specifications.

## Keywords
ddscope, ddmrp, commwise, b2wise, supply-chain, scoping, workshop, ai-agent

## Table of Contents

1. [Purpose](#purpose)
2. [Structure](#structure)
3. [AI Agent Setup](#ai-agent-setup)
4. [Idea Inboxes](#idea-inboxes)
5. [Glossary](#glossary)
6. [Index](#index)

## Purpose

DDScope is a CommWise web application built by b2wise. It supports DDMRP scoping workshops — consultants use it to build supply chain maps capturing current-state structure before buffer design begins.

The AI assistant works alongside the lead developer to design, implement, and maintain the application.

## Structure

```
docs/       # All documentation — flat, no sub-folders
src/        # Extracted functional modules (mirror of CommWise SCRIPT blocks)
tests/      # Vitest unit tests + Playwright e2e specs
fixtures/   # JSON project files for automated tests
samples/    # Realistic DDScope projects for demos and manual testing
shims/      # Minimal stubs for CommWise/browser globals (Node.js compat)
```

Key files at root: `README.md`, `GLOSSARY.md`, `TODO.md`, `DEVIATIONS.md`

## AI Agent Setup

AI Assistant: Claude

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

## Glossary

See `GLOSSARY.md` at project root.

## Index

| Term | Occurrences |
|------|-------------|

## Changelog

### Version 2.0 - Conformance rewrite
**Date:** 2026-06-01
**Reason:** Brought PROJECT.md into conformance with conventions/documentation.md and conventions/project-structure.md.

**Changes:**
- Added: Quick Start, Keywords, Table of Contents, Structure, AI Agent Setup, Index, Changelog
- Renamed: ## Role → ## Purpose
- Removed: ## Audit (KB now in project instructions), ## Interactive Sessions (chatbot setting), ## Repo Autonomy Rule
- Preserved: ## Idea Inboxes, ## Glossary
