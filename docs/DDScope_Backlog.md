# DDScope — Backlog

*Living document. Items move from §1 (pre-backlog) to §2 (committed features) when sufficiently defined and prioritised. Each committed entry includes implementation notes and user-facing copy for the future user manual.*

---

## Version History

| Version | Date | Summary |
|---|---|---|
| 1.0 | May 2026 | Extracted from DDScope_Overview.md §5; FEAT-001 added |
| 1.1 | May 2026 | §1.2: notes panel idea added |
| 1.2 | May 2026 | §1.1: app schema version + About panel added |
| 1.3 | May 2026 | §1.1: DDS_CMD architecture refactor added |
| 1.4 | May 2026 | FEAT-002 (map notes), FEAT-003 (canvas toggle), FEAT-004 (copy modal) added; §1.2 notes panel idea promoted and superseded |
| 1.5 | May 2026 | FEAT-002 revised: map_note_categories removed (presence derived from notes); DDS_CMD bootstrapped on notes domain; DDS_CMD.execute signature defined |
| 1.6 | May 2026 | §1.1: nested transactions note added to DDS_CMD; §1.2: glossary and philosophy document ideas added |
| 1.7 | May 2026 | §1.2: DOM structure documentation added |
| 1.8 | May 2026 | §1.2: tag-styles on flows (undocumented gap) added; Information flows candidate updated with RFC reference |
| 1.9 | May 2026 | §1.2: Glossary — note added distinguishing session glossary (GLOSSARY.md) from future user-facing documents |

---

## 1. Pre-backlog

Items collected but not yet committed to any version. Not to-do items — inputs for future planning sessions.

**§1.1** contains items with sufficient definition to be discussed for prioritisation. **§1.2** contains fragments and early ideas that need further thinking before they can be scoped.

### 1.1 Candidates

**Architecture refactor — DDS_CMD unified command layer**

Replace the current helper layer (`DDS_NODES`, `DDS_PRODUCTS`, `DDS_FLOWS`, `DDS_SKUS`, `DDS_BOMS`, `DDS_DEMANDS`, `DDS_ANNOTATIONS`) and `DDS_ACTIONS` with a single `DDS_CMD` module whose commands map 1-to-1 with the `TX` catalogue.

*Motivation:* the current stack has 4 layers between the UI and the store (TX_HELPER → helper → DDS_ACTIONS → DDS_STORE/DDS_MODEL). Business logic is split between helpers and DDS_ACTIONS. The AI vocabulary (`DDScope_Actions.md`) is a separate artefact that must be kept in sync with the TX catalogue. Logging has no single natural entry point.

*Target architecture:*
```
UI  →  DDS_CMD.execute(TX.KEY, params, mapId, onSuccess?)  →  DDS_STORE / DDS_MODEL
AI  →  DDS_CMD.executeList([{ type, params }], onSuccess?)  →  (single wrapping TX)
```

- Each command (`TX.NODE_CREATE`, `TX.FLOW_UPDATE`, etc.) encapsulates its own business logic. The UI passes only `params` — no `fn` callback containing logic.
- `DDS_CMD.execute` wraps begin/commit/rollback automatically (replaces `DDS_TX_HELPER`). The `onSuccess` callback is preserved for Cytoscape/DOM side effects. `mapId` is passed for commands that create map-scoped entities; `null` otherwise.
- Commands do not call each other (except in the AI case below).
- `DDS_CMD.executeList` is the AI entry point: executes a list of commands sequentially inside a **single global transaction** representing the AI call site. Equivalent to the current `TX.AI_APPLY_ACTIONS` wrapping.
- `DDS_ACTIONS.getVocabularyText()` and `DDS_ACTIONS.describe()` are replaced by equivalent methods on `DDS_CMD`, derived directly from the command definitions.

*Nested transactions for AI execution:* `DDS_CMD.executeList` must support nested transactions — each individual command in the list runs its own begin/commit/rollback, nested inside the global AI transaction. This ensures that a failure in one command rolls back only that command while the global transaction remains open, and the full list can be rolled back as a unit on global failure. Design of the nesting mechanism to be specified at implementation time.

*Delete unification:* all deletion variants (node, flow, lane, annotation, multi-selection, map-only removal) are unified into a single `TX.DELETE` command with options: entity type(s), ids, and a `mapOnly` flag. The current proliferation of `TX.NODE_DELETE`, `TX.FLOW_DELETE`, `TX.LANE_DELETE`, `TX.ANNOTATION_DELETE`, `TX.MULTI_DELETE`, `TX.MAP_REMOVE_*` is replaced by this single command.

*What disappears:* `DDS_NODES`, `DDS_PRODUCTS`, `DDS_FLOWS`, `DDS_SKUS`, `DDS_BOMS`, `DDS_DEMANDS`, `DDS_ANNOTATIONS`, `DDS_ACTIONS`, `DDS_TX_HELPER`, `DDScope_Actions.md`.

*What is unchanged:* `DDS_TRANSACTIONS` (undo/redo by snapshot), `TX` catalogue (extended with unified `TX.DELETE`), `DDS_STORE`, `DDS_MODEL`.

*Bootstrap:* `DDS_CMD` is introduced in FEAT-002 covering the notes domain only. Legacy helpers remain untouched and continue to handle all other domains until the full migration is done.

*Recommended timing for full migration:* before implementing the remaining `to-do` call sites in `DDScope_UndoRedo.md` §3.6–§3.15, to avoid migrating them twice.

**App schema version**
Add a `schema_version` field to the project JSON (e.g. `"1.0"`). Saved alongside `name`, `description`, `created_by` in `DDS_STORE`. Used to detect projects created with an older schema and apply migration logic on open. The CommWise app version (auto-incremented by CommWise on each revision) is a separate concept and does not substitute for this.

**About panel**
Display the DDScope business version to the user. Candidate entry points: a dedicated About button/modal, or integration into an existing CommWise About mechanism if one is available. Content: app name, business version (from `schema_version` or a separate `app_version` constant defined in the app), build date, link to release notes. To be designed once `schema_version` is defined. CommWise integration angle to be investigated at implementation time.

**Node badges on the map canvas**
Display visual indicators directly on Cytoscape nodes. Two categories:
- *Tag-triggered badges* — a badge appears when a specific tag is present on the node. Target tags: `warning` (⚠️), `info` (ℹ️), `buffer` (dedicated icon). Configurable list, potential link with `tag_colors`.
- *Demand badge* — displayed when at least one SKU on the node has a `demands` record.
Multiple badges may coexist on the same node (e.g. warning + demand). Layout: horizontal row, top-right corner. Proposed rendering: Cytoscape ghost nodes (same pattern as note ghosts) for automatic pan/zoom sync and html2canvas compatibility. Visibility scope (all maps vs per-map toggle) to be defined.

**Unicode symbols in text fields displayed on the canvas**
Node notes (displayed as ghost overlays) and annotation content accept free Unicode text, including symbols and emoji (⚠ ▲ ℹ ✓ ✗ 🔴 🟡 🟢 …). Cytoscape renders these natively via its Canvas 2D label engine. Cross-platform rendering is best-effort — no guarantee of visual consistency across OS and browser combinations.

UX complement (future): a small symbol picker in the relevant text fields offering a curated shortlist of supply-chain-relevant Unicode characters. To be specified at implementation time.

**Tag color conflict resolution**
Define a visual behaviour for nodes matching multiple `tag_colors` entries simultaneously — currently the first match wins. Candidate: display a special pattern or overlay to signal the conflict rather than silently picking the first match.

**Information flows**
Model information flows and planning processes as a separate layer alongside material flows. Design decisions and open questions documented in `DDScope_InformationFlows_RFC.md`. Requires full spec before implementation.

**Swim-lane layout offset**
Configurable margin between swim-lane boundary and the first/last node column in auto-layout. Currently hardcoded.

**Lead time display on swim-lanes**
Display cumulative or per-lane lead time as a label or overlay on swim-lane headers. Rendering approach to be defined.

**`DDS_PRESENTATION` — presentation rules module**
A module symmetric to `DDS_MODEL` for the presentation layer: the single authoritative layer for rules governing map state, independent of the web UI and Cytoscape. Would encapsulate: default node placement when added to a map, auto-layout rules (BFS ranking, column assignment, vertical placement), fit-to-canvas bounding box computation, map duplication logic (copy of `map_nodes`, `map_flows`, `map_swim_lanes`, `map_demands`), and any other rule that determines *how* elements are arranged on a map without depending on the DOM or the Cytoscape instance. Current logic is spread across `DDS_MAP`, `DDS_LAYOUT`, and `DDS_MAP_UI`.

### 1.2 Ideas

**Tag-styles on flows — undocumented gap**
The `tag_colors` mechanism colors node backgrounds based on tags. No equivalent exists for flows — all edges are rendered with a uniform style regardless of their tags. A `tag_styles` mechanism for flows would allow visual differentiation by tag (e.g. line style, color, width). This is the natural rendering complement to the information flows feature: a flow tagged `information` could render as a dashed line, distinct from a material flow. Approach undefined — to be designed in a dedicated session. See `DDScope_InformationFlows_RFC.md` §6 Q3.

**Tag-specific selection style**
A distinct visual style for selected nodes when tag-based coloring is active — to avoid confusion between selection highlight and tag color. Approach undefined.

**`DDS_MODEL` — deprecate legacy cascade modules**
Once `DDS_MODEL` is implemented, progressively migrate callers of `DDS_PRODUCTS`, `DDS_BOMS`, `DDS_DEMANDS` to `DDS_MODEL` / `DDS_STORE` direct calls, then remove the deprecated modules. Tracked in `DDScope_Modules.md` backlog.

**Glossary**
Two separate glossary documents: one functional (user-facing terminology — concepts, entities, DDMRP vocabulary as used in DDScope), one internal (architecture and implementation vocabulary — module names, layer names, key patterns). Both cross-referenced from `docs/README.md`. Scope and format to be defined before creating the files.

*Note:* `GLOSSARY.md` at project root already exists — it is a session glossary for AI assistants (structured by domain, loaded selectively per session). It is distinct from the two user-facing documents described above and does not substitute for them.

**Philosophy and selling points document**
A document capturing DDScope's design philosophy (structured, simple, flexible) and its positioning relative to existing tools. Intended audience and format (internal reference vs. client-facing) to be decided. Any new feature must be validated against the philosophy before implementation — this document would make that criterion explicit and shareable.

**DOM structure documentation**
The HTML structure of the main zone (Cytoscape canvas, side panel, notes panel) is not documented. To document in `DDScope_UI.md` after reading the CommWise source: element IDs, flex or grid layout, relationships between zones. Prerequisite for any layout refactor of the side panel or notes panel.

---

## 2. Committed features

Entry format:

```
### FEAT-NNN — Short title
Status: backlog | in-progress | done
Priority: 1 (core) | 2 (enhancement) | 3 (nice-to-have)
Area: map | panel | tables | AI | settings | infra

**Description**
**Implementation notes**
**User manual copy**
```

---

### FEAT-001 — Lane-constrained drag with Shift override

Status: backlog
Priority: 2
Area: map

**Description**

Currently, nodes and annotation ghosts can be dragged anywhere on the canvas with no awareness of swim-lane boundaries. This feature adds soft lane constraints to drag interactions:

- **Without Shift:** dragging a node or annotation is constrained to its assigned swim lane. The element slides along the lane border instead of leaving it (cursor-on-screen-edge behaviour). Nodes without an assigned lane are blocked from entering any lane.
- **With Shift:** drag is free. The swim lane currently under the cursor is highlighted with a coloured border. On drop:
  - If the element lands on a different lane → confirmation modal to reassign.
  - If the element lands outside all lanes → confirmation modal to remove from lane.
  - If the element lands on the same lane → no modal, position persisted normally.

Both nodes and annotation ghosts follow the same logic (annotations have a `swim_lane_id`).

Undo/redo: lane reassignment uses `TX.NODE_ASSIGN_LANE` (already wired). Position is persisted as usual via `TX.MAP_MOVE_NODE` / `TX.MAP_MOVE_ANNOTATION`.

**Implementation notes**

Planned in two sessions:

*Session A — Clamping (without Shift)*
- `DDS_MAP.initCy` — `drag` handler: real-time clamping via `node.position()`.
- New helpers in `DDS_MAP`:
  - `_getLaneBounds(mapId)` — canvas rects for all lanes on the active map (invalidated on lane resize).
  - `_clampToLane(pos, rect)` — clamps a canvas position inside a lane rect.
  - `_clampOutsideLanes(pos, boundsArray)` — repels a free node away from all lane rects.
- Affected blocks: SCRIPT 1000.
- CSS: no change needed for clamping alone.

*Session B — Shift-drag highlight + confirmation modal*
- `DDS_MAP.initCy` — `drag` handler (Shift branch): hit-test + highlight.
- `DDS_MAP.initCy` — `dragfree` handlers (node + annotation ghost): Shift branch opens modal.
- New helpers in `DDS_MAP`:
  - `_hitTestLane(pos, mapId)` — returns the `swim_lane_id` under a canvas position, or `null`.
  - `_highlightLane(swimLaneId | null)` — adds/removes `.dds-lane-drag-target` class on overlay divs.
  - `_openLaneChangeModal(entityId, type, newLaneId, newPos, cyEl)` — lightweight confirm/cancel modal injected dynamically (not reusing `DDS_REMOVE` overlay).
- CSS: `.dds-swimlane.dds-lane-drag-target { border: 2px solid var(--dds-color-accent); }`.
- Affected blocks: SCRIPT 1000, one STYLE block.

*Known constraints*
- Lane bounds are in canvas coordinates. Must account for Cytoscape pan/zoom when converting from screen coordinates during drag.
- Annotation ghosts use canvas coordinates directly (same as nodes) — no additional conversion needed.
- Code factorisation between node drag and annotation drag is deferred (noted as future refactor in DDScope_UndoRedo.md §3.7).

**User manual copy**

> **Moving nodes and annotations within a swim lane**
>
> When you drag a node or annotation on the map, it stays within its assigned swim lane — it slides along the lane border instead of leaving it (cursor-on-screen-edge behaviour). Nodes without an assigned lane are blocked from entering any lane.
>
> **Reassigning to a different lane**
>
> To move an element to a different swim lane, hold **Shift** while dragging. The swim lane under your cursor will be highlighted. Release the element on the target lane and confirm the reassignment in the dialogue that appears.
>
> To remove an element from its lane entirely, hold **Shift** and drop it in the open area outside all lanes. Confirm in the dialogue to unassign it.
>
> *Tip: lane reassignment is undoable — press Ctrl+Z if you change your mind.*

---

### FEAT-002 — Map notes panel

Status: backlog
Priority: 1
Area: map | settings

**Description**

A structured notes panel displayed below the map canvas, replacing the unstructured bullet-point practice currently done in PowerPoint alongside supply chain maps. Notes are organised into free-form categories and visible on all maps — the panel always shows the full project note set.

*Data model — functional layer (project-level):*

- **`note_categories`** — free-text label, position (order). Managed in the Settings tab. A default `"General"` category is created at project creation.
- **`notes`** — text content, `category_id`, position (order within category).

There is no `map_note_categories` table. Notes are project-level entities — all notes are visible on every map. Collapsed/visible state of categories in the panel is managed in the rendering layer only and is not persisted.

*Write architecture — DDS_CMD bootstrap:*

Notes are the first domain implemented via `DDS_CMD`, the future unified command layer. No `DDS_NOTES` helper is created. `DDS_NOTES_UI` and `DDS_SETTINGS_UI` call `DDS_CMD.execute` directly:

```javascript
// Signature
DDS_CMD.execute(txKey, params, mapId, onSuccess?)

// Examples
DDS_CMD.execute(TX.NOTE_CATEGORY_CREATE, { label: 'Contraintes' }, null)
DDS_CMD.execute(TX.NOTE_CREATE, { category_id: 3, content: 'Environ 350 fournisseurs', position: 0 }, null)
DDS_CMD.execute(TX.NOTE_UPDATE, { id: 7, content: 'Environ 400 fournisseurs' }, null)
DDS_CMD.execute(TX.NOTE_DELETE, { id: 7 }, null)
DDS_CMD.execute(TX.NOTE_CATEGORY_DELETE, { id: 3 }, null)  // cascades to notes
```

`DDS_CMD.execute` wraps `DDS_TRANSACTIONS.begin/commit/rollback` automatically. `mapId` is `null` for all notes commands (no map dimension). Returns `{ ok: boolean, id?: integer }`.

Legacy helpers (`DDS_NODES`, etc.) and `DDS_ACTIONS` are untouched.

*Cascade rules:*
- `TX.NOTE_CATEGORY_DELETE` → deletes all `notes` where `category_id` matches, then the `note_categories` record — within the same transaction.

*Undo/redo:* fully undoable — `DDS_CMD.execute` wraps each operation in a transaction snapshot.

**Implementation notes**

*New modules:*
- `DDS_CMD` (SCRIPT TBD) — command registry and executor. Initially contains only the notes TX catalogue entries. Architecture documented in §1.1 candidate "DDS_CMD unified command layer".
- `DDS_NOTES_UI` (SCRIPT TBD) — notes panel below the canvas.

*Affected modules:*
- `DDS_SETTINGS_UI` — category management section: add, rename, delete, reorder. Calls `DDS_CMD`.
- `DDS_JSON` — include `note_categories` and `notes` in serialisation and copy logic (see FEAT-004). No `map_note_categories`.
- `TX` catalogue — add `NOTE_CATEGORY_CREATE`, `NOTE_CATEGORY_UPDATE`, `NOTE_CATEGORY_DELETE`, `NOTE_CREATE`, `NOTE_UPDATE`, `NOTE_DELETE`, `NOTE_REORDER`.

*UI detail — notes panel:*
- Panel sits below the Cytoscape canvas (or fills full height when `canvas_visible` is `false` — see FEAT-003).
- One collapsible section per category (collapsed state in memory only, not persisted).
- Under each expanded category: bullet list of notes. Each note: text input | up arrow | down arrow | delete button.
- "+" button at the bottom of each category to add a note.
- Panel header: "Notes" label.

**User manual copy**

> **Notes panel**
>
> The notes panel, displayed below the map, captures workshop observations, constraints, and key figures alongside the supply chain map — the same structured practice as in b2wise PowerPoint deliverables, but organised and navigable.
>
> Notes are grouped into categories. Each category can be expanded or collapsed independently.
>
> **Managing categories**
>
> Categories are defined in the Settings tab and shared across all maps in the project. Add, rename, reorder, or delete categories there. Deleting a category removes all its notes permanently.
>
> **Adding and editing notes**
>
> Click **+** at the bottom of a category to add a bullet point. Click any note to edit its text. Use the arrow buttons to reorder notes within a category.

---

### FEAT-003 — Canvas visibility toggle per map

Status: backlog
Priority: 2
Area: map

**Description**

Each map can hide its Cytoscape canvas entirely, leaving only the notes panel visible at full height. This transforms the map into a structured bullet-point slide — same data, different presentation mode.

A `canvas_visible` boolean field is added to `maps` (default `true`). A toolbar button toggles it on the active map.

When `canvas_visible` is `false`:
- The Cytoscape canvas and swim-lane overlays are hidden.
- The notes panel expands to fill the full available height.
- The toolbar still shows map-level controls (including the canvas toggle itself).
- All map data (nodes, flows, lanes) is preserved — the map is not altered, only its display mode changes.

**Implementation notes**

- `maps.canvas_visible` field (boolean, default `true`) — added to data model and JSON serialisation.
- `DDS_MAP_UI` — toolbar toggle button. On click: update `maps[activeMapId].canvas_visible` via `DDS_STORE.update`, call `DDS_MAP.applyCanvasVisibility()`.
- `DDS_MAP.applyCanvasVisibility(mapId)` — shows/hides `#cy` container and swim-lane overlay div; notifies `DDS_NOTES_UI` to resize.
- Called on map load and on toggle.
- No undo/redo — presentation state, same pattern as `legend_visible`.

**User manual copy**

> **Switching to notes-only view**
>
> Click the canvas toggle button in the map toolbar to hide the supply chain diagram and display only the notes panel at full height. The map and all its data are preserved — this is a display mode, not a deletion.
>
> Click the button again to restore the diagram view.
>
> *Tip: use this mode to present workshop findings as structured bullet points without switching tools.*

---

### FEAT-004 — Flexible project copy modal

Status: backlog
Priority: 2
Area: infra

**Description**

Replaces the current three named copy modes (`Full project`, `Swim-lanes & types`, `Types only`) with a checkbox-based modal that gives the consultant direct control over what is copied.

*Copy options (checkboxes):*

| Option | Label | Always checked | Notes |
|---|---|---|---|
| **Types** | Node types, product types, tag colors | Yes — non-modifiable | Always copied |
| **Categories** | Note categories | Optional | Checked by default |
| **Lanes** | Swim lanes + geometry | Optional | Checked by default |
| **All content** | All entities + notes + map content | Optional | Forces Categories and Lanes when checked |

*Behaviour:*
- **Types** is always checked and disabled — it cannot be unchecked.
- When **All content** is checked → **Categories** and **Lanes** are forced checked and disabled.
- When **All content** is unchecked → **Categories** and **Lanes** become independent again.
- All four options are checked by default when the modal opens.

*Maps:* always copied (name, position, direction, `legend_visible`, `canvas_visible`) regardless of options selected.

*Copy matrix per option combination:*

| Copied | Types | Categories only | Lanes only | All content |
|---|---|---|---|---|
| `node_types`, `product_types`, `tag_colors` | ✅ | ✅ | ✅ | ✅ |
| `note_categories` | — | ✅ | — | ✅ |
| `notes` | — | — | — | ✅ |
| `swim_lanes` | — | — | ✅ | ✅ |
| `map_swim_lanes` (geometry) | — | — | ✅ | ✅ |
| `nodes`, `flows`, `products`, `skus`, `boms`, `demands`, `annotations` | — | — | — | ✅ |
| `map_nodes`, `map_flows`, `map_demands`, `map_annotations` | — | — | — | ✅ |

All IDs are remapped in memory — the new project is fully independent of the source.

**Implementation notes**

- `DDS_JSON` — refactor copy logic to accept a `copyOptions` object `{ types, categories, lanes, allContent }` instead of the current mode string. Each option drives a conditional copy block.
- `DDS_MAP_UI` or `DDS_JSON_UI` (whichever owns the New Project modal) — replace the mode selector with the four checkboxes and the dependency logic described above.
- Existing fixture/sample files and tests that rely on the three named modes must be updated.

**User manual copy**

> **Creating a project from an existing one**
>
> When creating a new project, choose what to carry over from an existing project:
>
> - **Types** (always included) — node types, product types, and tag colors.
> - **Categories** — note categories (without their notes).
> - **Lanes** — swim-lane definitions and their canvas geometry.
> - **All content** — everything: nodes, flows, products, SKUs, BOMs, demands, annotations, and notes. Selecting this option automatically includes Categories and Lanes.
>
> All maps from the source project are always copied (names and structure). The new project is fully independent — changing it does not affect the original.

---

*b2wise — Confidential*
