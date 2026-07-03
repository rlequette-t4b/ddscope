# CommWise Sync Tracker

Correspondence table between `src/` modules and their CommWise block addresses.
Tracks synchronisation state for PULL and PUSH operations.

For PULL/PUSH procedures, see `commwise/commwise-framework.md` — section 6.
For DDScope app ID and AI proxy, see `docs/DDScope_Framework_CommWise.md`.

---

## Dirty status

| Value | Meaning |
|---|---|
| `NO` | Source file and CommWise block are in sync |
| `YES` | Local changes not yet pushed to CommWise |
| `NEW` | Created locally — no CommWise block exists yet |

---

## Tracking Table

After every PULL or PUSH, update the relevant row immediately.

| File | CommWise block | Testability | Dirty | Last operation | Date | App version | Revision |
|---|---|---|---|---|---|---|---|
| `core/DDS_TOOLS.js` | SCRIPT 40 | pure | NO | PULL | 2026-05-23 | v100 | #23909 |
| `core/DDS_COLORS.js` | SCRIPT 105 | pure | NO | PULL | 2026-05-23 | v100 | #23900 |
| `core/DDS_STORE.js` | SCRIPT 150 | store-dependent | NO | PULL | 2026-05-24 | v100 | #23962 |
| `core/DDS_DURATION.js` | SCRIPT 1650 | pure | NO | PULL | 2026-05-23 | v101 | #23899 |
| `core/DDS_MODEL.js` | SCRIPT 1550 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `core/DDS_ACTIONS.js` | SCRIPT 1850 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `core/DDS_TRANSACTIONS.js` | SCRIPT 1860 | store-dependent | NO | PUSH | 2026-05-24 | v100 | #23913 |
| `core/DDS_TX.js` | SCRIPT 1865 | pure | NO | PUSH | 2026-07-01 | — | #28133 | (Phase 5 §3.3: added MAP_SHOW_DEMAND / MAP_HIDE_DEMAND keys, annotated NODE_ASSIGN_LANE / SKU_ADD / SKU_REMOVE as unused) |
| `core/DDS_CMD.js` | SCRIPT 1875 | store-dependent | NO | PUSH | 2026-07-01 | — | #28133 | (Phase 5 §3.3: added NODE_UPDATE, FLOW_UPDATE, FLOW_ADD_PRODUCT, FLOW_REMOVE_PRODUCT, SKU_UPDATE, DEMAND_CREATE, MAP_SHOW_DEMAND, MAP_HIDE_DEMAND commands) |
| `domain/DDS_PRODUCTS.js` | SCRIPT 1610 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `domain/DDS_BOMS.js` | SCRIPT 1800 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `domain/DDS_DEMANDS.js` | SCRIPT 1660 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `core/DDS_SETTINGS.js` | SCRIPT 50 | store-dependent | NO | PULL | 2026-07-02 | — | — |
| `core/DDS_ICONS.js` | SCRIPT 110 | pure | NO | PULL | 2026-07-02 | — | — |
| `core/DDS_JSON.js` | SCRIPT 600 | store-dependent | NO | PULL | 2026-07-02 | — | — |
| `core/DDS_TX_HELPER.js` | SCRIPT 1870 | store-dependent | NO | PULL | 2026-07-02 | — | — |
| `domain/DDS_ANNOTATIONS.js` | SCRIPT 1670 | store-dependent | NO | PULL | 2026-07-02 | — | — |
| `domain/DDS_PROJECTS.js` | SCRIPT 500 | store-dependent | NO | PULL | 2026-07-02 | — | — |
| `ai/DDS_AI_CONTEXT.js` | SCRIPT 2200 | store-dependent | NO | PULL | 2026-07-02 | — | — |
| `ai/DDS_AI.js` | SCRIPT 2400 | out-of-scope | NO | PULL | 2026-07-02 | — | — |
| `ai/DDS_AI_UI.js` | SCRIPT 2500 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ai/DDS_AI_UI_DEBUG.js` | SCRIPT 2505 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ai/DDS_AI_UI_REPLAY.js` | SCRIPT 2506 | pure | NO | PULL | 2026-07-02 | — | — |
| `ai/DDS_AI_UI_FONT.js` | SCRIPT 905 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS.js` | SCRIPT 400 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_MAP_state.js` | SCRIPT 900 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_MAP_load.js` | SCRIPT 1000 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_MAP_tagstyles.js` | SCRIPT 1050 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_MAP_ctt.js` | SCRIPT 1055 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_SWIMLANES.js` | SCRIPT 1100 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_SWIMLANE_GROUP.js` | SCRIPT 1150 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_LAYOUT.js` | SCRIPT 1250 | store-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_FLOW_UI.js` | SCRIPT 1400 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_PANEL.js` | SCRIPT 1500 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_PANEL_demand.js` | SCRIPT 1505 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_ELEMENTS.js` | SCRIPT 2000 | store-dependent | NO | PULL | 2026-07-02 | — | — |
| `presentation/DDS_REMOVE.js` | SCRIPT 2050 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_INIT.js` | SCRIPT 800 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_UI_NAV.js` | SCRIPT 700 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_NODE_UI.js` | SCRIPT 1300 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_ANNOTATIONS_UI.js` | SCRIPT 1780 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_PRODUCTS_UI.js` | SCRIPT 1700 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_MAP_UI.js` | SCRIPT 1200 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_NODES_UI.js` | SCRIPT 1750 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_DEMANDS_UI.js` | SCRIPT 1770 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_FLOWS_UI.js` | SCRIPT 1760 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_BOMS_UI.js` | SCRIPT 1900 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_ELEMENTS_UI.js` | SCRIPT 2100 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_ACTIONS_LOG.js` | SCRIPT 2515 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_NOTES_UI.js` | SCRIPT 1785 | render-dependent | NO | PULL | 2026-07-02 | — | — |
| `ui/DDS_CONFIGURATION_UI.js` | SCRIPT 2600 | render-dependent | YES | RENAME | 2026-07-03 | — | — | Renamed from `ui/DDS_SETTINGS_UI.js` (T-034) — CommWise block still holds the old identifiers, not yet pushed. |

---

## Fragments (DIV blocks) — `fragments/`

HTML fragments, assembled in CommWise position order. Not JS modules — no testability class.

| File | CommWise block | Dirty | Last operation | Date | Notes |
|---|---|---|---|---|---|
| `fragments/modal-debug-settings.html` | DIV 110 | NO | PULL | 2026-07-02 | Outer shell uses CommWise `b2w-settings-modal-*` classes (platform chrome); inner content is DDScope-owned (`dds-settings-*`). Kept as one fragment — JS targets both together. |
| `fragments/app-shell.html` | DIV 200 | NO | PULL | 2026-07-02 | Main app shell: nav, workspace (AI panel + main + side panel), all view containers, all in-page modals except product/BOM/elements/settings-CRUD. Chunked fetch, 2 chunks. |
| `fragments/modal-product.html` | DIV 400 | NO | PULL | 2026-07-02 | |
| `fragments/modal-bom.html` | DIV 500 | NO | PULL | 2026-07-02 | |
| `fragments/panel-elements.html` | DIV 600 | NO | PULL | 2026-07-02 | |
| `fragments/modal-configuration-crud.html` | DIV 800 | YES | RENAME | 2026-07-03 | Renamed from `fragments/modal-settings-crud.html` (T-034) — shared CRUD modal for swim-lanes / node types / product types / tag styles / note categories. CommWise block not yet pushed. |

---

## Styles (STYLE blocks) — `styles/`

CSS files. Not JS modules — no testability class.

| File | CommWise block | Dirty | Last operation | Date | Notes |
|---|---|---|---|---|---|
| `styles/variables-reset.css` | STYLE 200 | NO | PULL | 2026-07-02 | DDScope design tokens (`--dds-*`) + base resets. |
| `styles/layout-nav-cards.css` | STYLE 300 | NO | PULL | 2026-07-02 | |
| `styles/buttons-modal-forms.css` | STYLE 400 | NO | PULL | 2026-07-02 | |
| `styles/map-view.css` | STYLE 500 | NO | PULL | 2026-07-02 | |
| `styles/side-panel.css` | STYLE 600 | NO | PULL | 2026-07-02 | |
| `styles/demand-section.css` | STYLE 650 | NO | PULL | 2026-07-02 | |
| `styles/ctt-overlay.css` | STYLE 660 | NO | PULL | 2026-07-02 | |
| `styles/tables.css` | STYLE 700 | NO | PULL | 2026-07-02 | |
| `styles/elements-panel.css` | STYLE 800 | NO | PULL | 2026-07-02 | |
| `styles/ai-panel.css` | STYLE 900 | NO | PULL | 2026-07-02 | |
| `styles/ai-debug-panel.css` | STYLE 905 | NO | PULL | 2026-07-02 | |
| `styles/actions-log-panel.css` | STYLE 910 | NO | PULL | 2026-07-02 | |
| `styles/settings-content.css` | STYLE 950 | NO | PULL | 2026-07-02 | Styles the DDScope content inside the debug settings modal (DIV 110 / STYLE 110's `b2w-*` shell is CommWise-provided and NOT mirrored here). |
| `styles/configuration-tab.css` | STYLE 1000 | YES | RENAME | 2026-07-03 | Renamed from `styles/settings-tab.css` (T-034) — CommWise block not yet pushed. |
| `styles/notes-panel.css` | STYLE 1020 | NO | PULL | 2026-07-02 | |

---

## Skipped blocks (not extracted — reasoning)

These CommWise blocks are **not** part of the portable DDScope source tree. They are either
CommWise platform infrastructure, CDN loaders, empty stubs, or temporary debug code.

### SCRIPT (7 skipped)
| Block | Title | Reason |
|---|---|---|
| SCRIPT 100 | CommWise API Client | Platform-provided secure proxy client — not DDScope code. |
| SCRIPT 200 | APP_CONTEXT | Platform-provided user/app/customer context — not DDScope code. |
| SCRIPT 300 | Activity Tracker | Explicitly CommWise infrastructure (interaction logging to platform DataStore). |
| SCRIPT 350 | CDN — Cytoscape + Dagre | CDN loader, not owned code. |
| SCRIPT 1600 | [STUB] superseded | Intentionally empty — logic consolidated into DDS_MODEL / DDS_PRODUCTS. |
| SCRIPT 1784 | CDN — SortableJS | CDN loader, not owned code. |
| SCRIPT 2510 | DEBUG: AI resize handle diagnostic | Temporary debug marker, "Remove after fix". |

### DIV (2 skipped)
| Block | Title | Reason |
|---|---|---|
| DIV 100 | App Header | Standard CommWise header, not customized. |
| DIV 300 | [STUB — moved to DIV 200] | Intentionally empty. |

### STYLE (6 skipped)
| Block | Title | Reason |
|---|---|---|
| STYLE 100 | App Header | Standard CommWise header styling. |
| STYLE 110 | Settings Modal (placeholder) | Styles only the CommWise-provided `b2w-settings-modal-*` shell chrome (backdrop/header/footer); no DDScope-specific classes. The DDScope content inside (`dds-settings-*`) is styled separately by STYLE 950, which **is** extracted. |
| STYLE 810 | Color Tokens — Immutable (T810) | CommWise/DDMRP shared design-system tokens (`--b2w-*` prefixed), reused across CommWise apps — platform infra, not DDScope-authored. |
| STYLE 820 | Color Tokens — Mutable (T820) | Same as above — rebrandable `--b2w-*` tokens, platform infra. |
| STYLE 830 | Typography & Spacing (T830) | Same as above — shared `--b2w-*` typography/spacing scale, platform infra. |
| STYLE 840 | Platform Overrides (T840) | Explicitly platform-level (WordPress/theme neutralization), marked "Include in ALL apps". |
