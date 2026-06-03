- [DDScope — AI Assistant (Claude)](#ddscope--ai-assistant-claude)
  - [Request for Comments — v1.5 — Draft — May 2026](#request-for-comments--v15--draft--may-2026)
  - [Version History](#version-history)
  - [1. Purpose](#1-purpose)
  - [2. Guiding Principles](#2-guiding-principles)
  - [3. Action Vocabulary](#3-action-vocabulary)
  - [4. Project Context Format](#4-project-context-format)
  - [5. System Prompt and Claude Contract](#5-system-prompt-and-claude-contract)
    - [5.1 System prompt (reference version)](#51-system-prompt-reference-version)
    - [5.2 Last-turn context (multi-turn within a session)](#52-last-turn-context-multi-turn-within-a-session)
    - [5.3 Project-specific instructions](#53-project-specific-instructions)
  - [6. Validation and Execution Mechanism](#6-validation-and-execution-mechanism)
    - [6.1 Principle](#61-principle)
    - [6.2 Plan display](#62-plan-display)
    - [6.3 Execution](#63-execution)
    - [6.4 Partial failure](#64-partial-failure)
  - [7. Open Questions](#7-open-questions)
# DDScope — AI Assistant (Claude)
## Request for Comments — v1.7 — Draft — Jun 2026

---

## Version History

| Version | Date     | Summary                  |
|---------|----------|--------------------------|
| 0.1     | May 2026 | Initial RFC               |
| 0.2     | May 2026 | Project description in context JSON; concept glossary in system prompt |
| 0.3     | May 2026 | Section 5.1 — static injection approach documented; ACTION_VOCABULARY as JS constant |
| 0.4     | May 2026 | Type management excluded from action vocabulary; new_* ID convention clarified; prompt and action vocabulary consolidated into RFC (sections 5.1 and 5.3) |
| 0.5     | May 2026 | Last-turn context for correction support; answer field (Option C) for analytical questions |
| 0.6     | May 2026 | RFC template updated to three-field contract (reasoning, answer, actions); interaction table added |
| 0.7     | May 2026 | Context format updated for multi-map model; active_map added; map actions excluded from v1 vocabulary |
| 0.8     | May 2026 | stock_points renamed to skus; tags added on flows and skus; swim-lane position removed; plan validation resolved as all-or-nothing |
| 0.9     | May 2026 | DataStore references replaced by neutral wording |
| 1.0     | May 2026 | BOM actions added (section 3.6); project-specific instructions added (section 5.4); context format updated with boms and bom_components |
| 1.1     | May 2026 | node_types context enriched with is_product_node_default, is_default, default_swim_lane_id; product_types with is_default; product-node pattern documented in action vocabulary (section 5.3) |
| 1.2     | May 2026 | Product-node pattern rewritten as default behaviour; add_product_to_flow restricted to explicit exception; cascade listing made explicit for delete_node and delete_product; add_sku tag note added |
| 1.3     | May 2026 | Demand actions added (section 3.9); context format updated with demands |
| 1.4     | May 2026 | ACTION_VOCABULARY_TEXT source moved to DDS_ACTIONS.getVocabularyText(); execution and error reporting delegated to DDS_ACTIONS.execute() and DDS_AI_UI; DDS_AI_EXECUTOR removed |
| 1.5     | May 2026 | Action vocabulary extracted to DDScope_Actions.md; §3 and §5.3 replaced by pointers |
| 1.6     | May 2026 | Annotation actions added to §3 pointer; annotations array added to context format (§4) |
| 1.7     | Jun 2026 | Script format documented in §4b — export structure, parsing rules, replay behaviour |

---

## 1. Purpose

This document specifies the contract between DDScope and an embedded Claude assistant capable of modifying a project in natural language. It covers the project context format transmitted to Claude, the system prompt contract, and the validation mechanism before any change is applied to the project.

The complete action vocabulary — operations, fields, cross-cutting rules, and versioning — is defined in **[DDScope_Actions.md](DDScope_Actions.md)**. This document focuses on the Claude-specific communication contract: how context is serialised, how the system prompt is assembled, and how responses are validated and executed.

---

## 2. Guiding Principles

- **Bounded agency.** Claude can only emit actions from the predefined, versioned vocabulary in `DDScope_Actions.md`. It cannot invent operations or reference entities outside the transmitted context.
- **Human confirmation required.** No action is applied without explicit user validation of the proposed plan. Validation is all-or-nothing — the plan is applied in full or not at all.
- **Transparency of reasoning.** Every response from Claude includes a `reasoning` field explaining what was understood, which entities were identified, and why the proposed actions were chosen.
- **Graceful ambiguity handling.** If the instruction is ambiguous or no matching entities are found, Claude returns an empty action list and explains why in `reasoning`. It does not guess.
- **Stateless per request.** Claude has no memory between messages. The full project context is transmitted with every request.

---

## 3. Action Vocabulary

The complete action vocabulary is defined in **[DDScope_Actions.md](DDScope_Actions.md)**. It covers:

- All supported action types (nodes, flows, products, SKUs, swim-lanes, BOMs, demands, annotations)
- Required and optional fields per action
- Temporary ID convention (`new_*`) and cross-action reference resolution
- Cross-cutting rules: product-node pattern, cascade obligations, SKU pre-checks
- v1 exclusions: map actions, type management, swim-lane deletion

Any response from Claude containing an unknown action type is rejected by `DDS_ACTIONS` before any write is performed.

---

## 4. Project Context Format

The following JSON structure is serialised from the current project state and transmitted to Claude with every request. IDs are record IDs serialised as strings. Canvas geometry (x, y, width, height) is omitted.

```json
{
  "project": {
    "id": "string",
    "name": "string",
    "description": "string"
  },

  "active_map": {
    "id": "string",
    "name": "string",
    "node_ids": ["string"],
    "flow_ids": ["string"],
    "swim_lane_ids": ["string"]
  },

  "maps": [
    { "id": "string", "name": "string", "position": "integer" }
  ],

  "swim_lanes": [
    { "id": "string", "name": "string" }
  ],
  "node_types": [
    {
      "code": "string",
      "label": "string",
      "is_default": "boolean",
      "is_product_node_default": "boolean",
      "default_swim_lane_id": "string | null"
    }
  ],
  "product_types": [
    {
      "code": "string",
      "label": "string",
      "is_default": "boolean"
    }
  ],
  "nodes": [
    {
      "id": "string",
      "name": "string",
      "type_code": "string",
      "swim_lane_id": "string | null",
      "tags": ["string"],
      "notes": "string"
    }
  ],
  "products": [
    {
      "id": "string",
      "name": "string",
      "type_code": "string",
      "tags": ["string"],
      "notes": "string"
    }
  ],
  "flows": [
    {
      "id": "string",
      "source_id": "string",
      "target_id": "string",
      "product_ids": ["string"],
      "tags": ["string"],
      "lead_time_value": "number | null",
      "lead_time_unit": "string | null",
      "bidirectional": "boolean",
      "notes": "string"
    }
  ],
  "skus": [
    {
      "node_id": "string",
      "product_id": "string",
      "tags": ["string"],
      "notes": "string"
    }
  ],
  "boms": [
    {
      "id": "string",
      "node_id": "string",
      "output_product_id": "string",
      "notes": "string"
    }
  ],
  "bom_components": [
    {
      "id": "string",
      "bom_id": "string",
      "product_id": "string",
      "quantity": "number",
      "notes": "string"
    }
  ],
  "demands": [
    {
      "node_id": "string",
      "product_id": "string",
      "ctt_value": "number | null",
      "ctt_unit": "string | null",
      "demand_value": "number | null",
      "demand_period": "string | null",
      "notes": "string"
    }
  ],
  "annotations": [
    {
      "id": "string",
      "notes": "string",
      "swim_lane_id": "string | null",
      "tags": ["string"]
    }
  ]
}
```

> `node_types` transmits `is_default`, `is_product_node_default`, and `default_swim_lane_id` so Claude can resolve the correct type and swim-lane for the product-node pattern without guessing.

> `product_types` transmits `is_default` so Claude can select the correct default product type when creating a product.

> `annotations` lists all project annotations regardless of which maps they appear on. Canvas positions (`x`, `y`) are omitted — they are map-specific and not relevant to the action vocabulary.

---

## 4b. Script Format

A conversation can be exported as a Markdown file and replayed by the AI assistant panel. This section documents the format produced by `DDS_AI_UI.exportConversation()` (SCRIPT 2500) and consumed by `DDS_AI_UI._replayParse` and `DDS_AI_UI._replayParseInstructions` (SCRIPT 2506).

### File structure

```
# AI Assistant — <project name>

**Project specific instructions:**
```
<project-specific instructions text>
```

**User:**
```
<instruction text>
```

**Assistant:** <reasoning or answer>

---

**User:**
```
<instruction text>
```

**Assistant:** <reasoning or answer>

---
```

### Blocks

| Block | Marker | Delimiter | Required |
|---|---|---|---|
| Instructions | `**Project specific instructions:**` | triple-backtick fence | No — omitted if `project.ai_instructions` is empty |
| User message | `**User:**` | triple-backtick fence | Yes — one per turn |
| Assistant response | `**Assistant:**` inline | none | Informational only — not parsed on replay |

### Parsing rules

`_replayParseInstructions` extracts the text inside the first triple-backtick fence following `**Project specific instructions:**`. Returns `null` if the marker or fence is absent. The extracted text is loaded into `DDS_AI_UI._replay.instructions` and injected as project-specific instructions for every replayed turn (see §5.3).

`_replayParse` splits the file on every `**User:**` marker and extracts the text inside the triple-backtick fence that follows each one. Returns an ordered array of instruction strings. Assistant response lines are ignored.

### Replay behaviour

Messages are replayed in order, one per `_replayNext()` call or all at once via `_replayRunToEnd()`. Each replayed message goes through the normal `DDS_AI_UI.send()` flow — context is serialised fresh, the API is called, and the returned plan is auto-applied. If a turn fails, replay halts.

---

## 5. System Prompt and Claude Contract

### 5.1 System prompt (reference version)

The system prompt is a **template string defined in `DDS_AI`**. It contains a single placeholder `{{ACTION_VOCABULARY}}` where the action vocabulary is injected at call time via `DDS_ACTIONS.getVocabularyText()`.

Assembly at call time:

```javascript
const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
  '{{ACTION_VOCABULARY}}',
  DDS_ACTIONS.getVocabularyText()
);
```

`DDS_ACTIONS.getVocabularyText()` derives its output from `DDS_ACTIONS.ACTIONS`, the structured source of truth. The injected text must be consistent with the vocabulary defined in `DDScope_Actions.md`.

### 5.2 Last-turn context (multi-turn within a session)

To support correction instructions, the previous turn is injected into the messages array before the current instruction. Only the immediately preceding turn is transmitted.

```javascript
// If a previous turn exists in DDS_AI.history:
messages = [
  { role: 'user',      content: 'Previous instruction: ' + lastEntry.instruction },
  { role: 'assistant', content: JSON.stringify({ reasoning: lastEntry.reasoning, actions: lastEntry.actions }) },
  // Project-specific instructions block (if defined — see §5.3)
  { role: 'user',      content: 'Project-specific instructions:\n' + ai_instructions },
  { role: 'assistant', content: 'Understood.' },
  { role: 'user',      content: 'Project context:\n' + JSON.stringify(context) + '\n\nInstruction: ' + instruction }
];

// First turn (no history):
messages = [
  // Project-specific instructions block (if defined — see §5.3)
  { role: 'user',      content: 'Project-specific instructions:\n' + ai_instructions },
  { role: 'assistant', content: 'Understood.' },
  { role: 'user',      content: 'Project context:\n' + JSON.stringify(context) + '\n\nInstruction: ' + instruction }
];
```

The project-specific instructions block is omitted entirely when `project.ai_instructions` is empty or null.

### 5.3 Project-specific instructions

Each project can define a free-text block of instructions that contextualise Claude's behaviour for that specific project. Typical content includes naming conventions, geographic scope, preferred node types, client-specific terminology, and known constraints.

**Storage:** `project.ai_instructions` — a free-text string field in the project metadata object, persisted in the JSON file alongside `name`, `description`, and `created_by`.

**UI:** A dedicated button in the AI assistant panel header opens a modal with a textarea. Saving the modal marks the project as dirty (`DDS_STORE.markDirty()`). This modal is distinct from the project name/description modal.

**Injection:** When `project.ai_instructions` is non-empty, a fake user/assistant turn is inserted into the `messages` array immediately before the current project context message:

```javascript
{ role: 'user',      content: 'Project-specific instructions:\n' + ai_instructions }
{ role: 'assistant', content: 'Understood.' }
```

This pattern ensures Claude acknowledges and applies the instructions without embedding them in the system prompt, keeping the system prompt stable and versioned independently.

**Absent:** If `project.ai_instructions` is null, undefined, or an empty string, the block is not injected.

---

## 6. Validation and Execution Mechanism

### 6.1 Principle

No action is applied without explicit user confirmation. The flow is:

```
User instruction
      ↓
DDS_AI serialises context + calls Claude API
      ↓
Claude returns { reasoning, answer, actions }
      ↓
DDS_AI_UI displays the plan via DDS_ACTIONS.describe(actions)
      ↓
User confirms → DDS_ACTIONS.execute(actions) applies actions sequentially
User cancels  → nothing is applied
```

### 6.2 Plan display

The confirmation panel shows:

- The `reasoning` text in full.
- The `answer` text if present (for analytical questions — no actions to confirm).
- A numbered list of actions rendered as human-readable sentences via `DDS_ACTIONS.describe(actions)`. Real entity IDs are resolved from `DDS_STORE`; `new_*` references are resolved from the plan itself (name of the creating action).
- An action count summary: *"3 actions to apply"*
- Two buttons: **Apply** and **Cancel**

### 6.3 Execution

`DDS_ACTIONS.execute(actions)` applies actions sequentially in the order returned by Claude. After each write, `new_*` references are resolved for subsequent actions. If any action fails, execution halts and `DDS_AI_UI` is informed via the returned `{ applied, failed }` result.

### 6.4 Partial failure

In v1, there is no automatic rollback. Validation is all-or-nothing from the user's perspective. If execution halts mid-plan due to an error, `DDS_AI_UI` shows the list of applied and unapplied actions so the user can take manual corrective action. The recommended mitigation before any AI session is to duplicate the project (Save As).

---

## 7. Open Questions

| # | Question | Impact |
|---|---|---|
| 1 | Should the action list be embedded in the system prompt or injected dynamically per request? | System prompt design |
| 2 | What is the maximum acceptable context size? Large projects (50+ nodes, 100+ flows) may approach token limits. | Scalability |
| 3 | Should the user be able to edit the action plan before confirming? | **Resolved in v0.8:** all-or-nothing. |
| 4 | Should conversation history be maintained within a session (multi-turn)? | **Resolved in v0.5:** last turn only. |
| 5 | Swim-lane deletion: under what conditions should it be allowed via the assistant? | Action vocabulary v2 |
| 6 | Should the AI assistant gain write access to map-scoped entities in v2? | Action vocabulary v2 |
| 7 | BOM SKU pre-check: should DDScope enforce SKU existence before executing add_bom / add_bom_component, or trust Claude's reasoning? | Execution robustness |

---

*b2wise — Confidential*
