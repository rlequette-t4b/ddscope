# DDScope — Architecture

Architecture reference for DDScope. Describes layers, module responsibilities, dependencies, and persistence strategy.

## Quick Start

Describes the five-layer architecture of DDScope and the modules in each layer.
Load when reasoning about where a new module belongs, auditing dependencies, or understanding the persistence model.
Does not cover data model details — see DDScope_DataModel.md. Does not cover rendering or UI implementation details — see DDScope_Rendering.md and DDScope_UI.md.
Related documents: DDScope_DataModel.md, DDScope_Presentation.md, DDScope_Rendering.md, DDScope_UI.md, DDScope_Modules.md.

## Keywords
architecture, layers, modules, dependencies, persistence, functional-layer, helper-layer, ai-layer, presentation-layer, ui-layer, DDS_STORE, DDS_ACTIONS, DDS_AI, CommWise

## Table of Contents

1. [1 - Platform](#1---platform)
2. [2 - Layered Architecture](#2---layered-architecture)
3. [3 - Layer - Functional](#3---layer---functional)
4. [4 - Layer - Helper](#4---layer---helper)
5. [5 - Layer - AI](#5---layer---ai)
6. [6 - Layer - Presentation](#6---layer---presentation)
7. [7 - Data Model](#7---data-model)
8. [8 - Persistence](#8---persistence)
9. [9 - Obsolete Patterns](#9---obsolete-patterns)
10. [Index](#index)

## 1 - Platform
[up](#table-of-contents)

DDScope runs entirely within the CommWise platform as a single-page CommWise Web App. Single-user per session. No concurrent editing.

**Stack:**

| Concern | Solution |
|---|---|
| Persistent storage | Local JSON file — in-memory store + File System Access API |
| Map rendering | Cytoscape.js v3.33.1 |
| Swim-lane rendering | HTML overlay divs (not Cytoscape compounds) |
| Auto-layout | Custom BFS ranking per swim-lane |

## 2 - Layered Architecture
[up](#table-of-contents)

DDScope is organised into five layers. Each layer has a single responsibility and a constrained dependency direction — no layer may depend on a layer above it.

```
┌───────────────────────────────┐  User-facing interactions, views, panels
│           UI layer            │
├───────────────────────────────┤  Cytoscape canvas + HTML overlays
│        Rendering layer        │
├───────────────────────────────┤  map_* entity logic, layout algorithms
│      Presentation layer       │
├─────────────┬─────────────────┤  Domain helpers / AI action execution / DDS_CMD
│ Helper layer │   AI layer     │
├───────────────────────────────┤  DDS_STORE, DDS_ACTIONS, DDS_MODEL
│       Functional layer        │
└───────────────────────────────┘
```

## 3 - Layer - Functional
[up](#table-of-contents)

The foundation. Manages in-memory state (`DDS_STORE`), action execution (`DDS_ACTIONS`), cascade rules (`DDS_MODEL`), undo/redo (`DDS_TRANSACTIONS`), and file persistence. No knowledge of rendering or UI.

| Module | Responsibility |
|---|---|
| `DDS_TOOLS` | Transversal utilities — `DDS_TOOLS.log` levelled logger (debug/info/warn/error/off), localStorage-persisted level |
| `DDS_COLORS` | 8-color palette constant |
| `DDS_ICONS` | SVG icon library — keyed dictionary, `toDataUrl()` with color injection |
| `DDS_STORE` | In-memory CRUD + file persistence |
| `DDS_DURATION` | Duration arithmetic and formatting |
| `DDS_MODEL` | Cascade delete rules — authoritative runtime |
| `DDS_ACTIONS` | Action execution engine — synchronous; apply action lists on DDS_STORE/DDS_MODEL, resolve new_* references, action vocabulary |
| `DDS_TRANSACTIONS` | Snapshot-based undo/redo transaction manager — wraps DDS_STORE state capture and restore |
| `DDS_TX` | Transaction label catalogue — centralised constants for `DDS_TRANSACTIONS.begin()` and `DDS_CMD.execute()` |
| `DDS_CMD` | Unified command layer — notes domain bootstrap; replaces helpers + DDS_ACTIONS for migrated domains |
| `DDS_TX_HELPER` | UI transaction wrapper — `DDS_TX_HELPER.run(label, fn, onSuccess?)` encapsulates begin/commit/rollback; temporary, pending full DDS_CMD migration |
| `DDS_JSON` | Project import with copy modes + ID remapping |

## 4 - Layer - Helper
[up](#table-of-contents)

UI modules call helpers for all functional writes and reads (legacy domains). Helpers translate semantic calls into `DDS_ACTIONS` action lists.

| Module | Responsibility |
|---|---|
| `DDS_NODES` | Node CRUD helper |
| `DDS_PRODUCTS` | Product CRUD helper |
| `DDS_FLOWS` | Flow CRUD helper |
| `DDS_SKUS` | SKU CRUD helper |
| `DDS_BOMS` | BOM CRUD helper |
| `DDS_DEMANDS` | Demand CRUD helper |
| `DDS_ANNOTATIONS` | Annotation CRUD helper |

## 5 - Layer - AI
[up](#table-of-contents)

The AI layer handles context serialisation, prompt assembly, Claude API communication, and the assistant UI panel.

| Module | Block | Responsibility |
|---|---|---|
| `DDS_AI_CONTEXT` | SCRIPT 2200 | Serialises project state to Claude context JSON |
| `DDS_AI` | SCRIPT 2400 | System prompt assembly, session history, response parsing and validation |
| `DDS_AI_SERVICE` | SCRIPT 2300 | Thin CommWise proxy shim — routes the Claude API call through `commwiseConfigClient.secureRequest` |
| `DDS_AI_UI` | SCRIPT 2500 | AI panel, plan display, confirm/cancel, error reporting |

**Design intent:** The AI layer is designed to abstract CommWise infrastructure. `DDS_AI` and `DDS_AI_CONTEXT` contain no CommWise-specific code — they depend only on `DDS_STORE` and `DDS_ACTIONS`. The CommWise secure proxy (`commwiseConfigClient.secureRequest`) is isolated in `DDS_AI_SERVICE`, so the underlying transport can be replaced without touching prompt assembly or response parsing logic.

## 6 - Layer - Presentation
[up](#table-of-contents)

Render-dependent modules. Manage Cytoscape canvas, HTML overlays, layout algorithms, and all map-scoped UI.

| Module | Block | Responsibility |
|---|---|---|
| `DDS_MAP` (state) | SCRIPT 900 | DDS_MAP state + Cytoscape style definition |
| `DDS_MAP` (load) | SCRIPT 1000 | loadMap, fitMap, runLayout |
| `DDS_MAP` (style) | SCRIPT 1050 | Tag colors, legend overlay, node icon rendering |
| `DDS_MAP` (CTT) | SCRIPT 1055 | CTT line HTML overlay |
| `DDS_SWIMLANES` | SCRIPT 1100 | Swim-lane overlay + pan/zoom sync |
| `DDS_SWIMLANE_GROUP` | SCRIPT 1150 | Swim-lane grouping logic |
| `DDS_LAYOUT` | SCRIPT 1250 | Node placement algorithm |
| `DDS_MAP_UI` | SCRIPT 1200 | Map tabs, map management, toolbar |
| `DDS_NODE_UI` | SCRIPT 1300 | Node creation modal |
| `DDS_FLOW_UI` | SCRIPT 1400 | Flow creation handle + rerouting |
| `DDS_PANEL` | SCRIPT 1500 | Side panel controller |
| `DDS_PANEL` (demand) | SCRIPT 1505 | SKU demand sub-section in node panel |
| `DDS_ELEMENTS` | SCRIPT 2000 | Add/remove elements from map |
| `DDS_ELEMENTS_UI` | SCRIPT 2100 | Elements panel UI + events |
| `DDS_REMOVE` | SCRIPT 2050 | Remove modal (map-only or full delete) |
| `DDS_NODES_UI` | SCRIPT 1750 | Node table view |
| `DDS_FLOWS_UI` | SCRIPT 1760 | Flow table view |
| `DDS_PRODUCTS_UI` | SCRIPT 1700 | Product table view |
| `DDS_BOMS_UI` | SCRIPT 1900 | BOMs table view |
| `DDS_DEMANDS_UI` | SCRIPT 1770 | Demand table view |
| `DDS_ANNOTATIONS_UI` | SCRIPT 1780 | Annotations table view |
| `DDS_NOTES_UI` | SCRIPT TBD | Notes panel below the canvas (FEAT-002) |
| `DDS_SETTINGS_UI` | SCRIPT 2600 | Settings tab |

## 7 - Data Model
[up](#table-of-contents)

The project is held entirely in memory as a single JSON object. It contains named arrays for the functional and presentation layers.

See DDScope_DataModel.md for the full table catalogue, entity field definitions, cascade rules, file format, and runtime defaults.

## 8 - Persistence
[up](#table-of-contents)

### In-memory store - DDS_STORE

`DDS_STORE` is the raw data access layer. It exposes a synchronous CRUD API and is schema-agnostic — it does not know the list of tables. Tables are created on first access.

**Write access rules:**
- UI modules write through helper modules (legacy domains) or `DDS_CMD` (notes domain).
- Helper modules call `DDS_ACTIONS.execute()` for all functional writes.
- `DDS_CMD` wraps `DDS_TRANSACTIONS.begin/commit/rollback` and calls `DDS_STORE` directly.
- `DDS_ACTIONS` calls `DDS_STORE.insert/update/remove` (simple ops) or `DDS_MODEL.*` (cascade ops).
- AI modules (`DDS_AI`, `DDS_AI_UI`) call `DDS_ACTIONS.execute()` directly.
- Presentation layer modules manage `map_*` tables directly via `DDS_STORE` — the only exception.
- `DDS_STORE.query` is unrestricted — any module may read any table.

### File persistence

The project is persisted as a single `.json` file on the consultant's machine. No server, no database, no network dependency.

| Operation | Chrome / Edge | Other browsers |
|---|---|---|
| **Load** | `showOpenFilePicker()` — File System Access API | `<input type="file">` |
| **Save** | Write directly to the open file (`FileSystemWritableFileStream`) | Download (`<a download>`) |
| **Save As** | `showSaveFilePicker()` — new file | Download |

### Auto-reopen - Chrome and Edge only

The `FileSystemFileHandle` of the last open file is persisted in IndexedDB. On boot, DDScope checks whether the permission is already granted. If so, the file is reopened automatically with no user interaction. If the handle exists but permission has not been granted (e.g. after a browser restart), a prompt is triggered on the first user gesture.

### Dirty state

`DDS.state.dirty` is set to `true` on any `insert`, `update`, `remove`, or explicit `DDS_STORE.markDirty()` call. A bullet indicator (`•`) is appended to the project name in the navigation bar, and the **Save** button becomes active. Reset to `false` on Load, Save, Save As, new project creation, and auto-reopen.

## 9 - Obsolete Patterns
[up](#table-of-contents)

Patterns that have been superseded. Do not use in any new code.

| Pattern | Replaced by | Details |
|---|---|---|
| `skip_in_layout` on `map_flows` | `layout_offset: 0` | Old boolean field; `layout_offset` is the authoritative control |
| CommWise DataStore as persistence layer | File System Access API + `DDS_STORE` | DDScope persists to a local JSON file. DataStore is not used. |
| Sequential `insert()` loops | Batch inserts with `inserted_ids` for ID remapping | Sequential inserts across related tables fail to remap foreign keys correctly. |
| Helper + DDS_ACTIONS pattern for new domains | `DDS_CMD.execute()` | New domains use DDS_CMD directly — no helper, no DDS_ACTIONS. |

## Index

| Term | Occurrences |
|------|-------------|

## Changelog

### Version 3.5 - Convention conformance + AI layer design intent
**Date:** 2026-06-01
**Reason:** Document brought into conformance with conventions/documentation.md. AI layer design intent added to document the CommWise abstraction goal.

**Changes:**
- Added Quick Start, Keywords, Table of Contents, [up] links, Index
- Version History renamed to Changelog and moved to end of document
- Sections renumbered and renamed to convention-compliant headings (no special characters)
- Section 2 split: each layer now has its own section (3-6)
- AI layer table: DDS_AI_SERVICE added as planned shim module
- AI layer design intent paragraph added
- *b2wise — Confidential* footer removed (not part of convention)

### Version 3.4 - Data model pointer
**Date:** May 2026
**Reason:** §4 table catalogue and §5.5 file format moved to DDScope_DataModel.md; replaced by pointers.

### Version 3.3 - Obsolete Patterns added
**Date:** May 2026

### Version 3.2 - Internal links updated
**Date:** May 2026
**Reason:** Single flat docs/ folder.

### Version 3.1 - Key Implementation Details dispatched
**Date:** May 2026
**Reason:** §6 dispatched to Presentation, Rendering, and UI docs.

### Version 3.0 - Major restructure
**Date:** May 2026
**Reason:** Implementation details extracted to dedicated documents. Architecture now describes layers and dependencies only.

### Version 0.4 - Initial split
**Date:** May 2026
**Reason:** Initial split from monolithic spec.
