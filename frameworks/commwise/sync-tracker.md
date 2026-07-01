# CommWise Sync Tracker

Correspondence table between `src/` modules and their CommWise block addresses.
Tracks synchronisation state for PULL and PUSH operations.

For PULL/PUSH procedures, see `conventions/commwise-framework.md` (KB) — section 6.
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
| `domain/DDS_NODES.js` | SCRIPT 1560 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `domain/DDS_PRODUCTS.js` | SCRIPT 1610 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `domain/DDS_FLOWS.js` | SCRIPT 1620 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `domain/DDS_SKUS.js` | SCRIPT 1630 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `domain/DDS_BOMS.js` | SCRIPT 1800 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `domain/DDS_DEMANDS.js` | SCRIPT 1660 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
| `domain/DDS_LANES.js` | SCRIPT 1640 | store-dependent | NO | PULL | 2026-05-23 | v101 | #23899 |
