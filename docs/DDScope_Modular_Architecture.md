# DDScope — Modular Architecture

## Quick Start
DDScope-specific extension of `conventions/modular-architecture.md` (KB).
Describes the migration strategy away from CommWise as a development environment: CommWise as deployment target, local development framework, coupling detection, and migration path.
Load when reasoning about CommWise decoupling, planning the local framework, or identifying CommWise coupling points.
Does not replace `DDScope_Architecture.md` for the current layer architecture.

## Keywords
modular-architecture, tobe, strategy, commwise, local-framework, deployment-target, coupling, sync, portability, debug

## Table of Contents

1. [1 - Problem Statement](#1---problem-statement)
2. [2 - Target Architecture](#2---target-architecture)
3. [3 - Local Development Framework](#3---local-development-framework)
4. [4 - CommWise as Coupling Detector](#4---commwise-as-coupling-detector)
5. [5 - Scope of the Local Framework](#5---scope-of-the-local-framework)
6. [6 - Migration Path](#6---migration-path)
7. [7 - Generalization](#7---generalization)
8. [8 - Decoupling Log](#8---decoupling-log)
9. [Index](#index)

## 1 - Problem Statement
[up](#table-of-contents)

### The sync problem

`src/` is the declared source of truth for DDScope. CommWise holds the running version. These two must stay in sync.

The current sync mechanism is manual — it relies on the AI assistant following PULL/PUSH conventions. This is structurally unreliable for two reasons:

- **No memory between sessions.** The AI assistant does not remember what was modified in the previous session. A fix applied directly in CommWise during a debug session can be silently lost.
- **Attention, not just memory.** Even with conventions documented and visible, the AI assistant can be absorbed by a task and omit a PUSH or PULL. This is not fixable by better documentation alone.

### Why it cannot be solved with tooling

CommWise is only accessible via the MCP tool — there is no REST API, no programmatic hook, no wrapper layer available. It is therefore impossible to intercept CommWise writes and automatically persist them to `src/`. The sync gap is a structural consequence of the platform constraints.

### CommWise-specific bugs remain

Even with a local framework, some bugs will only appear in CommWise — CSS conflicts caused by CommWise global styles, `!important` overrides, iframe constraints. These environment-specific bugs cannot be reproduced locally and will still required debugging directly in CommWise.

The local framework does not eliminate CommWise bugs. It eliminates **logic bugs** from CommWise and makes environment-specific bugs immediately identifiable as such.

## 2 - Target Architecture
[up](#table-of-contents)

**CommWise becomes a deployment target, not a development environment.**

```
src/  ←  single source of truth
  ↓  (publish step)
CommWise  ←  running version only
```

All development and debugging happens in `src/` via the local framework. CommWise receives only validated, published versions. Direct modifications to CommWise blocks are prohibited — they break the source of truth guarantee by construction.

When a bug only reproduces in CommWise (environment-specific), the fix is:
1. Diagnosed in CommWise
2. Implemented in `src/`
3. Pushed to CommWise as a publish step

Never the reverse.

## 3 - Local Development Framework
[up](#table-of-contents)

A local HTML runner that loads DDScope modules in the correct order, outside of CommWise.

**Responsibilities:**
- Load all `src/` modules in dependency order (mirrors CommWise block position order)
- Provide stubs for CommWise-specific globals (`commwiseConfigClient`, `APP_CONTEXT`, etc.)
- Provide a minimal host UI (nav, canvas container) sufficient to run and debug DDScope
- Enable fast iteration without a PUSH/reload cycle

**What it is not:**
- A production build system
- A full CommWise emulator
- A replacement for Playwright e2e tests (those still run against CommWise or a full browser context)

## 4 - CommWise as Coupling Detector
[up](#table-of-contents)

Building the local framework will surface CommWise coupling points systematically.

Every module that fails to load or run in the local framework is a coupling point — a direct or indirect dependency on CommWise internals. Each failure is an explicit, localized signal:

- **Fails to load** → depends on a CommWise global not yet stubbed
- **Fails to run** → calls a CommWise API directly inside business logic
- **Renders incorrectly** → CSS coupled to CommWise global styles

This makes the local framework a **measurement tool** for CommWise dependency, not just a development environment. The list of coupling points drives the decoupling backlog.

## 5 - Scope of the Local Framework
[up](#table-of-contents)

Not all modules need to run locally. The scope follows the layer architecture:

| Layer | Local framework target | Rationale |
|---|---|---|
| Functional | ✅ Full coverage | Pure logic, no rendering — must run locally |
| Helper | ✅ Full coverage | Pure logic, no rendering — must run locally |
| AI | ✅ Partial (DDS_AI_CONTEXT, DDS_AI) | Transport stubbed via IAITransport shim |
| Presentation | ⚠️ Best effort | Cytoscape and DOM dependent — some coupling expected |
| UI | ⚠️ Best effort | DOM dependent — environment bugs may remain |

## 6 - Migration Path
[up](#table-of-contents)

### What already exists

- `src/` structure with `core/` and `domain/` modules extracted
- `shims/` with minimal stubs for CommWise/browser globals (Node.js compat)
- Vitest unit tests running outside CommWise for pure and store-dependent modules
- `frameworks/commwise/sync-tracker.md` tracking current sync state

### What is missing

- HTML runner loading modules in order outside CommWise
- Stubs for CommWise globals needed at runtime (not just Node.js compat)
- A publish script automating the PUSH of all `src/` modules to CommWise

### Order of construction

1. HTML runner for functional + helper layers (no rendering)
2. Stubs for CommWise globals required by those layers
3. Coupling point inventory — document every failure
4. Extend to presentation layer progressively
5. Publish script (`tools/publish.js`) replacing manual PUSH operations

## 7 - Generalization
[up](#table-of-contents)

This strategy is not DDScope-specific. Any CommWise project faces the same structural constraints:

- CommWise is not wrappable
- Sync between local source and CommWise cannot be automated
- Direct CommWise modifications are a sync liability

The local framework pattern — CommWise as deployment target, `src/` as source of truth, coupling detection via local runner — is reusable across all CommWise projects.

When this pattern is mature in DDScope, it should be extracted to the Knowledge Base as a reusable convention.

## 8 - Decoupling Log
[up](#table-of-contents)

Tracking of decoupling steps — decisions, findings, and outcomes recorded session by session.

### Step 1 - Source inventory

**Goal:** Ensure all CommWise blocks that contain DDScope logic are tracked in the repository — nothing escapes the source of truth.

**Finding — sync-tracker scope too narrow:** The sync-tracker only covers SCRIPT blocks. DIV and STYLE blocks are completely absent. 64 SCRIPT + 9 DIV + 22 STYLE blocks exist in CommWise; only 16 SCRIPT blocks are tracked.

**Finding — Module Registry incomplete:** The Module Registry (`DDScope_Modules.md`) covers only JavaScript modules (SCRIPT). DIV and STYLE blocks have no registry, no declared ownership, no tracking.

**Finding — code outside modules:** Several SCRIPT blocks are not declared as modules: SCRIPT 50 (DDS_SETTINGS), SCRIPT 400 (DDS state), SCRIPT 500 (DDS_PROJECTS), SCRIPT 700 (DDS_UI_NAV), SCRIPT 800 (DDS_INIT), SCRIPT 850 (DDS_TEST), SCRIPT 905 (AI font size), SCRIPT 1785 (DDS_NOTES_UI), SCRIPT 2505 (DDS_AI_UI_DEBUG), SCRIPT 2506 (DDS_AI_UI._replayParse), SCRIPT 2510 (DEBUG resize), SCRIPT 2515 (DDS_ACTIONS_LOG).

**Decision — repository layout:** DIV and STYLE blocks are not modules. A module is a JavaScript unit with a testable API. DIV blocks are HTML fragments (page structure, assembled in position order). STYLE blocks are CSS. They are first-class artifacts but live outside `src/`. Repository layout adopted:

```
src/          # JavaScript modules only — testable (Vitest)
fragments/    # HTML fragments — page structure, assembled in position order
styles/       # CSS files — visual definition
frameworks/   # Framework deployment artifacts (sync tracker, etc.)
```

This decision is captured in `conventions/modular-architecture.md` (KB) v6.0 — section 8 - Repository Layout.

**Classification — SCRIPT blocks:**

| Block | Classification |
|---|---|
| SCRIPT 50 | DDScope module — DDS_SETTINGS, to declare |
| SCRIPT 100 | CommWise infrastructure — not in repo |
| SCRIPT 200 | CommWise infrastructure — not in repo |
| SCRIPT 300 | CommWise infrastructure — not in repo |
| SCRIPT 350 | CDN loader — see note below |
| SCRIPT 400 | DDScope module — DDS, render-dependent, to declare |
| SCRIPT 500 | DDScope module — DDS_PROJECTS, render-dependent, to declare |
| SCRIPT 700 | DDScope module — DDS_UI_NAV, render-dependent, to declare |
| SCRIPT 800 | DDScope module — DDS_INIT, bootstrap/entry point, to declare |
| SCRIPT 850 | DDScope module — DDS_TEST, test infrastructure, to declare |
| SCRIPT 905 | DDScope — part of DDS_AI_UI, split for CommWise only |
| SCRIPT 1600 | Stub — empty, ignore |
| SCRIPT 1784 | CDN loader — see note below |
| SCRIPT 1785 | DDScope module — DDS_NOTES_UI, render-dependent, to declare |
| SCRIPT 1875 | DDScope module — DDS_CMD, in sync-tracker but not in Module Registry |
| SCRIPT 2505 | DDScope — part of DDS_AI_UI, split for CommWise only |
| SCRIPT 2506 | DDScope — part of DDS_AI_UI, split for CommWise only |
| SCRIPT 2510 | Temporary debug — to delete from CommWise |
| SCRIPT 2515 | DDScope module — DDS_ACTIONS_LOG, render-dependent, to declare |

**Note — CDN loaders (SCRIPT 350, SCRIPT 1784):** CDN loaders are not code to own — they are versioned external dependencies. Each CDN-loaded library is a candidate for an IService wrapper (Cytoscape.js is already wrapped by IGraphRenderer/CytoscapeRenderer; SortableJS is not yet wrapped). During the migration, CDN loaders must be replaced by package installs with explicit version tracking in the assembly. This is a dedicated migration task.

**Classification — DIV blocks:**

| Block | Classification |
|---|---|
| DIV 100 | CommWise infrastructure — standard b2wise header (classes: b2w-*) |
| DIV 110 | DDScope fragment — settings debug modal |
| DIV 200 | DDScope fragment — app shell (entire page structure) |
| DIV 300 | Stub — empty, ignore |
| DIV 400 | DDScope fragment — product modal |
| DIV 500 | DDScope fragment — BOM modal |
| DIV 600 | DDScope fragment — elements panel + context menu |
| DIV 800 | DDScope fragment — settings modal |

All DDScope fragments belong to page `dds-main`.

**Classification — STYLE blocks:**

| Block | Classification |
|---|---|
| STYLE 100 | CommWise infrastructure — standard header CSS (classes: b2w-*, vars: --b2w-*) |
| STYLE 110 | CommWise infrastructure — standard settings modal CSS |
| STYLE 200 | DDScope stylesheet — variables + reset |
| STYLE 300 | DDScope stylesheet — layout + nav |
| STYLE 400 | DDScope stylesheet — buttons + modals + forms |
| STYLE 500 | DDScope stylesheet — map view |
| STYLE 600 | DDScope stylesheet — side panel |
| STYLE 650 | DDScope stylesheet — demand sub-section |
| STYLE 660 | DDScope stylesheet — CTT line overlay |
| STYLE 700 | DDScope stylesheet — products table |
| STYLE 800 | DDScope stylesheet — elements panel |
| STYLE 810 | CommWise infrastructure — DDMRP color tokens immutable (vars: --b2w-*) |
| STYLE 820 | CommWise infrastructure — rebrandable color tokens (vars: --b2w-*) |
| STYLE 830 | CommWise infrastructure — typography + spacing (vars: --b2w-*) |
| STYLE 840 | CommWise infrastructure — platform overrides |
| STYLE 900 | DDScope stylesheet — AI panel |
| STYLE 905 | DDScope stylesheet — AI debug panel |
| STYLE 910 | DDScope stylesheet — actions log panel |
| STYLE 950 | DDScope stylesheet — settings section |
| STYLE 1000 | DDScope stylesheet — settings tab |
| STYLE 1020 | DDScope stylesheet — notes panel |

All DDScope styles belong to stylesheet `dds-main`.

**Classification basis:** content-based — CommWise infrastructure identified by exclusive use of `b2w-*` classes and `--b2w-*` CSS variables; DDScope code identified by `dds-*` classes and `--dds-*` variables.

**Status:** Full inventory complete (SCRIPT + DIV + STYLE). Next: create DDScope_Views.md (page and stylesheet registry).

## Index

| Term | Occurrences |
|---|---|

## Changelog

### Version 2.2 - Step 1 inventory completed
**Date:** 2026-06-01
**Reason:** Source inventory session — classification of all CommWise blocks, architecture decisions on fragments/stylesheets, repository layout adopted.

**Changes:**
- Step 1: full classification of SCRIPT, DIV, STYLE blocks added
- Step 1: repository layout decision documented (src/, fragments/, styles/, frameworks/)
- Step 1: CDN loader migration note added
- Step 1: status updated — next action is DDScope_Views.md creation
- Convention reference updated: v5.0 → v6.0, section 6 → section 8

### Version 2.1 - Decoupling Log section added
**Date:** 2026-06-01
**Reason:** File will serve to document the decoupling process step by step. Step 1 noted: source inventory.

**Changes:**
- Section 8 - Decoupling Log added
- TOC updated

### Version 2.0 - Renamed from DDScope_Architecture_ToBe.md
**Date:** 2026-06-01
**Reason:** Renamed to follow the same pattern as DDScope_Framework_CommWise.md — DDScope-specific extension of a KB convention. References conventions/modular-architecture.md (KB) as the parent convention.

**Changes:**
- Title: "DDScope — Architecture ToBe" → "DDScope — Modular Architecture"
- Quick Start: rewritten to reference conventions/modular-architecture.md (KB)
- Keywords: "tobe" kept, "modular-architecture" added

### Version 1.0 - Creation
**Date:** 2026-06-01
**Reason:** Stub replaced with full strategic content. Captures the architectural decision to treat CommWise as a deployment target only, the rationale (sync unreliability, no wrappable API), the local development framework concept, and the generalization intent.

**Contents:**
- Section 1: Problem Statement — sync problem, why tooling cannot solve it, CommWise-specific bugs remain
- Section 2: Target Architecture — CommWise as deployment target
- Section 3: Local Development Framework — responsibilities and boundaries
- Section 4: CommWise as Coupling Detector — framework as measurement tool
- Section 5: Scope — layer-by-layer coverage targets
- Section 6: Migration Path — what exists, what is missing, construction order
- Section 7: Generalization — reusability across CommWise projects
