# DDScope — Claude Code Instructions

> This file contains only instructions specific to Claude Code as an agent.
> Any other AI or developer working on this project should rely on `README.md`, `docs/`, and `PROJECT.md`.


---

## Table of Contents

- [DDScope — Claude Code Instructions](#ddscope--claude-code-instructions)
  - [Table of Contents](#table-of-contents)
  - [Session Protocol](#session-protocol)
    - [During the session](#during-the-session)
    - [General rules](#general-rules)
  - [Claude Code Operational Patterns](#claude-code-operational-patterns)
    - [File writes — use the filesystem MCP, not bash\_tool](#file-writes--use-the-filesystem-mcp-not-bash_tool)
    - [Always verify writes](#always-verify-writes)
    - [Read the file immediately before editing](#read-the-file-immediately-before-editing)
    - [tool\_search before first use of any deferred tool](#tool_search-before-first-use-of-any-deferred-tool)
    - [src/ tracking — update after every local change](#src-tracking--update-after-every-local-change)
    - [Check src/README.md before any CommWise block write](#check-srcreadmemd-before-any-commwise-block-write)
    - [UI test tracking](#ui-test-tracking)
    - [Debug and fix — keep responses concise](#debug-and-fix--keep-responses-concise)

---

## Session Protocol


### During the session

If the conversation drifts toward a domain not in the initial scope, signal it explicitly:
> "On aborde maintenant le domaine **Functional** qui n'était pas dans le périmètre initial. On continue dans cette session ou on ouvre une nouvelle ?"

Wait for confirmation before loading new domain documents or proceeding.

### General rules

- Never add UI elements or features not explicitly requested. Propose first.
- **One step at a time — no exceptions.** Before any work: decompose the task into focused steps and present them. Wait for confirmation. Then execute one focused step at a time, describing each before executing it and waiting for confirmation. This applies to the initial plan and to every decision made during execution — including steps that seem obvious or minor. A step not in the confirmed plan is a new step: stop, describe, wait.

---

## Claude Code Operational Patterns

How Claude Code must operate in this specific environment. Not relevant to any other agent or developer.

### File writes — use the filesystem MCP, not bash_tool

WHY: `bash_tool` runs inside a Linux container with no access to the Windows filesystem.
`str_replace` (create_file tool) also fails on Windows paths.

**Only `filesystem:write_file` (MCP tool) can write to the repo.**

For partial edits: read the full file with `filesystem:read_text_file`, apply the change in memory, rewrite with `filesystem:write_file`.

### Always verify writes

WHY: The filesystem MCP can fail silently — never assume a write succeeded without verification.

After every `filesystem:write_file` call, immediately call `filesystem:list_directory` on the parent folder (or `filesystem:read_text_file` on the file) to confirm the file exists and is non-empty.

### Read the file immediately before editing

WHY: A version read earlier in the session may no longer reflect the file on disk — another
tool or operation may have modified it. Reading immediately before writing guarantees the edit
is applied to the current state.

Always `filesystem:read_text_file` immediately before any write — never rely on a version read earlier in the session.

### tool_search before first use of any deferred tool

WHY: Deferred tools are not loaded by default. Parameter names and schemas are not available
until the tool is loaded — guessing them causes silent failures or incorrect calls.

All MCP tools (filesystem, CommWise, Slack, etc.) must be loaded via `tool_search` before their first call in a session. Do not guess parameter names — load the schema first.

### src/ tracking — update after every local change

WHY: The tracking table in `src/README.md` is the only reliable indicator of what is in sync with CommWise.

After creating or modifying any file in `src/`, immediately update the tracking table in `src/README.md`:
- New file created locally → status `NEW`, date = today, no revision.
- Existing file modified locally → status `YES` (dirty), date = today.
- After a successful push to CommWise → status `NO`, update app version and revision ID.

This rule applies even when the change is minor.

### Check src/README.md before any CommWise block write

WHY: If the local version diverges from CommWise, writing to CommWise would overwrite unsynced work.

Before writing to any CommWise block that has a corresponding file in `src/`, check the tracking table in `src/README.md`. If the module is marked `YES` (dirty) or `NEW`, the local version diverges from CommWise — clarify with the developer before writing to CommWise.

**render-dependent modules have no file in src/ — go directly to CommWise.**
Modules with `testability: render-dependent` (e.g. `DDS_NOTES_UI`, `DDS_MAP`, `DDS_PANEL`, `DDS_MAP_UI`, `DDS_SWIMLANES`, `DDS_FLOW_UI`, `DDS_NODE_UI`, `DDS_AI_UI`, etc.) are never extracted to `src/`. Do not look for them there. To read or modify them, use `commwise_get_block` directly.

### UI test tracking

When telling the developer to test something that relates to a scenario in `docs/DDScope_TestUI.md`, always reference the scenario index (C.S format) and its short description. Example: *"À tester : **2.3** Categories in Note Panel, **2.9** Collapse and expand the whole panel."*

After every MCP SQLite write to `tests/ddscope_tests.db`, immediately regenerate the HTML viewer:

```
commands:execute_command  command="node"  args=["C:\\Users\\RemiLequette\\Development\\projects\\ddscope\\tests\\generate_viewer.js"]
```

If the write included a schema change (CREATE TABLE, ALTER TABLE, CREATE VIEW, DROP TABLE, DROP VIEW) — immediately update `tests/schema.sql` to reflect the current schema. This is mandatory and must not be deferred.

### Debug and fix — keep responses concise

When diagnosing and fixing bugs, minimise chat volume:
- State the cause in one sentence.
- State the fix in one sentence.
- Execute without further commentary.
- No intermediate summaries, no re-quoting of source code, no step-by-step narration after the plan is confirmed.

---

*b2wise — Confidential*
