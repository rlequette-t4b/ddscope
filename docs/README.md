# DDScope Docs

Single source of truth for all DDScope documentation. All files are flat in this folder — no sub-folders.

---

## Documents

### Specifications

| Document | Status | Notes |
|---|---|---|
| [DDScope_Overview.md](DDScope_Overview.md) | Active | Product purpose, scope v1/v2, constraints |
| [DDScope_DataModel.md](DDScope_DataModel.md) | Active | All entities, fields, cascade rules |
| [DDScope_Architecture.md](DDScope_Architecture.md) | Active | Layered architecture, persistence pattern, obsolete patterns |
| [DDScope_Modules.md](DDScope_Modules.md) | Active | Module registry — APIs, deps, testability |
| [DDScope_Presentation.md](DDScope_Presentation.md) | Active | Presentation layer — map_* logic, layout algorithms, DI contract |
| [DDScope_Actions.md](DDScope_Actions.md) | Active | AI action vocabulary (current — pending migration to DDS_CMD) |
| [DDScope_AI_Assistant.md](DDScope_AI_Assistant.md) | Active | Embedded AI assistant RFC |
| [DDScope_Backlog.md](DDScope_Backlog.md) | Active | Feature backlog — pre-backlog candidates, committed features, user manual copy |
| [DDScope_InformationFlows_RFC.md](DDScope_InformationFlows_RFC.md) | Draft | Information flows feature — pre-spec design decisions and open questions |

### Implementation details

| Document | Status | Notes |
|---|---|---|
| [DDScope_Rendering.md](DDScope_Rendering.md) | Active | Cytoscape canvas, overlays, ghost nodes, styles, known traps |
| [DDScope_UI.md](DDScope_UI.md) | Active | UI implementation details, known traps |
| [DDScope_AI_UI.md](DDScope_AI_UI.md) | Active | AI assistant panel — header, replay player, export/import format |
| [DDScope_Commands.md](DDScope_Commands.md) | Active | DDS_CMD target architecture, TX catalogue, legacy transaction pattern, call site inventory, AI vocabulary contract |
| [DDScope_ElementsLifecycle.md](DDScope_ElementsLifecycle.md) | Active | Element lifecycle on maps |

### Test environment

| Document | Status | Notes |
|---|---|---|
| [DDScope_TestEnvironment.md](DDScope_TestEnvironment.md) | Active | Repo conventions, Vitest/Playwright setup, module pull/push workflow |
| [DDScope_SQLite_Setup.md](DDScope_SQLite_Setup.md) | Active | MCP SQLite setup — UI test tracker database, schema, queries, backup |
| [DDScope_TestUI.md](DDScope_TestUI.md) | Active | Manual UI test tracker — protocol only (data in SQLite DB) |
| [DDScope_TestUI_watcher.md](DDScope_TestUI_watcher.md) | Active | Auto-watcher pipeline — VS Code task that regenerates the HTML viewer on save |

---

## Domains

Catalogue of work domains. At the start of each session, an AI assistant infers the relevant domains from the first request, states them explicitly, and loads the listed documents after confirmation.

The objective of domains is also to help AI assistants better engineer their session context, keep it focused to avoid bloating and confusion while having all useful knowledge for the task on hand.

This list is open-ended — add a domain when a combination of documents recurs regularly.

---

### Specification (French: Spécification)
*Design, backlog, data model, conceptual architecture — no CommWise access required.*

| Document | Why |
|---|---|
| `DDScope_Overview.md` | Product scope, v1/v2 constraints |
| `DDScope_DataModel.md` | Entities, fields, cascade rules |
| `DDScope_Architecture.md` | Layers, dependencies, obsolete patterns |
| `DDScope_Backlog.md` | Active backlog, pending design decisions |

---

### Functional (French: Fonctionnel)
*DDS_STORE, DDS_CMD, DDS_ACTIONS, DDS_MODEL, transactions, helpers — pure business logic, no rendering.*

| Document | Why |
|---|---|
| `DDScope_Architecture.md` | Write rules per layer, persistence |
| `DDScope_DataModel.md` | Entities and cascades being manipulated |
| `DDScope_Modules.md` | Module APIs, dependencies, testability |
| `DDScope_Actions.md` | AI action vocabulary (current) |
| `DDScope_Commands.md` | DDS_CMD target architecture, TX catalogue, call site inventory |
| `conventions/commwise-framework.md` (KB) | If reading or writing CommWise blocks |

---

### Rendering (French: Rendu)
*Cytoscape, swim-lanes, layout, ghost nodes, canvas DOM.*

| Document | Why |
|---|---|
| `DDScope_Rendering.md` | Rendering engine, Cytoscape traps |
| `DDScope_Presentation.md` | map_* logic, layout algorithms |
| `DDScope_Modules.md` | Render-dependent modules, CommWise positions |
| `conventions/commwise-framework.md` (KB) | Session lifecycle, editing, regex traps |

---

### Interface (French: Interface)
*Panels, modals, nav bar, table views, user interactions — design and implementation only, no test scenarios.*

| Document | Why |
|---|---|
| `DDScope_UI.md` | Full UI spec, known traps (disabled buttons…) |
| `DDScope_AI_UI.md` | AI assistant panel — header, replay, export/import |
| `DDScope_ElementsLifecycle.md` | Element lifecycle on maps |
| `DDScope_Modules.md` | UI modules, CommWise positions |
| `conventions/commwise-framework.md` (KB) | Session lifecycle, editing, regex traps |

---

### UI Testing (French: Tests UI)
*Manual UI validation, creation and update of UI test scenarios. Load this domain when working on test coverage or running through the test tracker — not during design or implementation.*

**Data source:** test scenarios and issues are stored in `tests/ddscope_tests.db` (SQLite, MCP-queryable). Load `DDScope_SQLite_Setup.md` for the schema and query patterns. Do NOT load `DDScope_TestUI.md` expecting data — it contains protocol only.

| Document | Why |
|---|---|
| `DDScope_UI.md` | UI spec — reference for expected behaviour |
| `DDScope_AI_UI.md` | AI assistant panel spec |
| `DDScope_ElementsLifecycle.md` | Element lifecycle on maps |
| `DDScope_Modules.md` | UI modules, CommWise positions |
| `conventions/commwise-framework.md` (KB) | Session lifecycle, editing, regex traps |
| `DDScope_TestUI.md` | Test protocol — conventions, status values, category definitions |
| `DDScope_SQLite_Setup.md` | Schema, query patterns, backup procedure |

---

### Embedded AI (French: IA embarquée)
*DDS_AI, DDS_AI_CONTEXT, assistant panel, CommWise proxy.*

| Document | Why |
|---|---|
| `DDScope_AI_Assistant.md` | Full assistant RFC |
| `DDScope_AI_UI.md` | AI assistant panel — header, replay player, export/import format |
| `DDScope_Actions.md` | Action vocabulary, plan format (current) |
| `DDScope_Commands.md` | Future AI vocabulary contract via DDS_CMD |
| `DDScope_Modules.md` | AI layer modules, CommWise positions |
| `conventions/commwise-framework.md` (KB) | secureRequest proxy, session lifecycle |

---

### Testing (French: Infrastructure de test)
*Test infrastructure — Vitest, Playwright, pull/push extraction, fixtures. Not for UI test scenario work.*

| Document | Why |
|---|---|
| `DDScope_TestEnvironment.md` | Full setup, pull/push workflow, Playwright backdoors, manual UI tracker reference |
| `DDScope_SQLite_Setup.md` | SQLite DB setup, schema, backup — shared with UI Testing domain |
| `DDScope_TestUI.md` | Test protocol reference |
| `DDScope_TestUI_watcher.md` | Auto-watcher setup — VS Code task configuration |
| `DDScope_Modules.md` | Module testability, extraction contracts |
| `conventions/commwise-framework.md` (KB) | Session lifecycle for push operations |

---

### CommWise
*Reading, writing, and deploying blocks — without associated application work (e.g. audit, migration).*

| Document | Why |
|---|---|
| `conventions/commwise-framework.md` (KB) | All platform conventions |
| `DDScope_Framework_CommWise.md` | DDScope app ID and correspondence file |
| `DDScope_Modules.md` | Block positions, expected titles |

---

## Where to Place Information

Apply these criteria in order when deciding where to document something.

**Criterion 1 — What is the scope?**

The domains section of this document and the table below should help you locate the right document to update. Propose new documents or refactoring only as a last resort.

| Scope | Target document |
|---|---|
| CommWise platform behaviour (any app) | `conventions/commwise-framework.md` (KB) |
| Architecture or layer rule | `DDScope_Architecture.md` |
| Module API, dependency, or testability | `DDScope_Modules.md` |
| Data model, entity, field, cascade | `DDScope_DataModel.md` |
| Presentation layer / layout algorithm | `DDScope_Presentation.md` |
| Rendering / Cytoscape / canvas | `DDScope_Rendering.md` |
| UI interaction, panel, modal | `DDScope_UI.md` |
| AI assistant UI (panel, replay, export) | `DDScope_AI_UI.md` |
| AI action vocabulary (current) | `DDScope_Actions.md` |
| Command layer, TX catalogue, call site inventory | `DDScope_Commands.md` |
| AI assistant feature (contract, context, validation) | `DDScope_AI_Assistant.md` |
| Information flows feature design | `DDScope_InformationFlows_RFC.md` |
| Test convention, fixture, pull/push workflow | `DDScope_TestEnvironment.md` |
| UI test scenario or issue (data) | `tests/ddscope_tests.db` (via MCP SQLite) |
| UI test protocol, conventions, status values | `DDScope_TestUI.md` |
| SQLite schema, queries, backup | `DDScope_SQLite_Setup.md` |
| Feature backlog or design note | `DDScope_Backlog.md` |

**Criterion 2 — Is it proactive or reactive knowledge?**
- Proactive (read before starting) → body of the relevant doc.
- Reactive (consulted when something breaks) → "Known Traps" section at the end of the relevant doc. Propose to create if it does not exist.

**Keeping this file in sync**
Any creation, rename, or deletion of a file in `docs/` must be reflected in this document before the end of the session: update the Documents table, the affected domain lists, and the "Where to Place Information" table.

**What does NOT belong in `docs/`:**
Anything specific to an AI assistant's execution environment, tool constraints, or operational patterns. Those go in the AI assistant's instruction file at the repo root.

---

*b2wise — Confidential*
