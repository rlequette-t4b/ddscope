# Supply Chain Flow Extraction Guide

## Quick Start
This guide is intended to be used as a reference by an AI assistant performing supply chain analysis tasks. It defines the concepts and vocabulary of material flows in an end-to-end supply chain — from raw material sources to end customers — in the context of a DDMRP project scoping exercise.

Load this guide when tasked with extracting supply chain elements from any unstructured source (image, text, audio, video, document). It provides the conceptual framework to identify and characterise nodes, flows, products, and network structure, and to recognise DDMRP-relevant attributes such as lead times, demand patterns, and decoupling point candidates. The expected output is a structured description of the supply chain, sufficient to build a flow map.

Does not cover information flows, financial flows, or DDMRP buffer sizing methods.

## Keywords
extraction, supply-chain, material-flows, nodes, flows, products, swim-lanes, lead-time, ddmrp, decoupling-point, scoping

## Table of Contents

1. [How to extract](#how-to-extract)
2. [How to describe](#how-to-describe)
3. [Index](#index)

## How to extract
[up](#table-of-contents)
A supply chain is a network of nodes connected by material flows. Extract the following entities from the source.

Make your best effort to identify the industry sector of the supply chain (examples: chemicals, automotive, food & beverage, retail, pharmaceuticals, electronics). This context helps interpret node types, product categories, and supply chain vocabulary used in the source.

Also suggest a title for the description file in the format: `# <Company> Supply Chain — <scope> — <YYYY-MM-DD>`. Use the company name, geographic or organisational scope, and date of the source if available.

Each entity is described with a list of attributes. Unless marked **optional**, all attributes are mandatory. Follow these rules precisely — they govern how the extracted content is formatted in the output description.

When extracting text from the source, apply the following rules:
- Extract as plain text — ignore any formatting (bold, italic, underline, colour)
- If you encounter images or icons that can be mapped to a Unicode character (stop sign, lightning bolt, arrow, etc.), replace them with the corresponding Unicode symbol
- If the text is multiline, replace newlines with spaces unless the attribute explicitly states to preserve them — in that case use `\n`

Positional information from the source (graphical layout, or language cues such as "on the left", "at the top") may be used during extraction to assign nodes to swim-lanes or confirm flow directions. Do not carry positional information into the output description — it serves extraction only.

When the source is a language description (text or audio), distinguish between two modes: the source may describe the supply chain directly ("there are two customers") or describe a visual representation of it ("there is a box labelled customer"). Both are valid — extract the supply chain entities in either case, not the description of the image.

For any information in the source that cannot be mapped to a known entity or attribute, make your best effort to capture it as a plain text description and mark it as `unidentified` in the output.

### Swim-lanes

Swim-lanes are borrowed from Business Process notation, by analogy with swimming competition lanes. They partition the supply chain into named zones — typically by actor, organisation, geography, or process (e.g. Source, Make, Deliver from the SCOR model). Graphically, each swim-lane is a rectangular box with a header containing its name.

Lanes can be grouped into a super-block. Within a group, lanes are placed side by side from left to right, with no gap between them — they divide the super-block into contiguous vertical bands of equal height. The left-to-right order within a group is significant and must be preserved.

**Lane attributes:**

| Attribute | Description |
|---|---|
| Name | Name of the lane as it appears in the source |
| Color | Optional — background or header color if present in the source |

**Group attributes:**

| Attribute | Description |
|---|---|
| Lanes | Ordered list of lane names, left to right |

### Node types

A node type is a reusable category of supply chain node. Extract node types before nodes — each node references a type. Make your best effort to identify types that carry supply chain meaning (examples: Customer, Supplier, Warehouse, Distribution Centre, Manufacturing, Production Line). Respect the vocabulary used in the source and avoid multiplying types unnecessarily — two nodes that play the same supply chain role should share a type.

**Node type attributes:**

| Attribute | Description |
|---|---|
| Name | Type name — use source vocabulary when it has supply chain meaning |
| Icon | Optional — icon or shape associated with this type in the source (factory, person, warehouse, rectangle, oval, etc.) — map to a Unicode symbol if possible |
| Color | Optional — color associated with this type in the source |
| Is product type | Optional — boolean, at most one type may have this set to true. Identifies the type used to represent products explicitly as nodes in the network. All nodes of this type share the same graphical charter (icon and color) and each must have a corresponding product of the same name in the products list. |

### Nodes

A node is a physical or logical location in the supply chain where material is held, transformed, or transferred. Extract one node per distinct location identified in the source.

Two nodes may share the same name — this is valid and expected for nodes of a product type, representing the same product at different locations.

When a type has `Is product type = true`, nodes of that type represent a product explicitly positioned in the network. Multiple nodes of this type may share the same name — they represent the same product at different locations. Each such node implies the existence of a product of the same name in the products list.

**Node attributes:**

| Attribute | Description |
|---|---|
| Name | Name as it appears in the source |
| Type | Reference to a node type |
| Swim-lane | Optional — lane where this node is located. A node belongs to at most one swim-lane. If the assignment is ambiguous, choose the most plausible one. |
| Notes | Optional — any additional information that cannot be mapped to another attribute |

### Flows

A flow is a directed movement of material between two nodes. Identify flows by looking for arrows, verbs of movement (ships, delivers, transfers, replenishes), or described relationships between nodes. Both endpoints must reference nodes already identified in the source.

**Flow attributes:**

| Attribute | Description |
|---|---|
| Source | Reference to a node — origin of the material flow |
| Target | Reference to a node — destination of the material flow |
| Lead time | Optional — transit time between source and target, value and unit (days, weeks). If a range is given, capture both bounds. |
| Products | Optional — list of product references carried by this flow. If not identifiable from the source, leave empty. |
| Bidirectional | Optional — true if the flow goes both ways. Default is unidirectional. |
| Notes | Optional — any additional information that cannot be mapped to another attribute |

### Products

A product is what moves through the supply chain network. A product may correspond conceptually to a product family or category (e.g. Bottles, Boxes, Finished Goods, Raw Materials) rather than a specific item. Make your best effort to identify products that carry supply chain meaning and avoid multiplying them unnecessarily — two items that play the same role in the network should share a product.

Extract one product per distinct item identified in the source. When a product type node exists, each distinct node name of that type implies a product of the same name — extract it even if the product is not described elsewhere in the source.

Extract product types before products — each product references a type.

**Product type attributes:**

| Attribute | Description |
|---|---|
| Name | Type name — use source vocabulary when it has supply chain meaning (examples: finished good, semi-finished, raw material, component, packaging) |

**Product attributes:**

| Attribute | Description |
|---|---|
| Name | Name as it appears in the source |
| Type | Reference to a product type |
| Notes | Optional — any additional information that cannot be mapped to another attribute |

### Annotations

An annotation is a visual element on the flow map that is not attached to a specific entity — typically a label, a bracket, or an explanatory text. Extract annotations that carry information not captured elsewhere.

**Annotation attributes:**

| Attribute | Description |
|---|---|
| Text | Content of the annotation |
| Swim-lane | Optional — swim-lane this annotation is associated with |

### Notes

A note is a piece of general information that cannot be represented graphically. Notes are grouped by category. Each note has at most one category.

**Note attributes:**

| Attribute | Description |
|---|---|
| Text | Content of the note |
| Category | Optional — category grouping this note (examples: assumptions, open questions, constraints) |

## How to describe
[up](#table-of-contents)
The description is a textual description of the supply chain that can be understood by a human and used by an AI to build a model in a modeling tool.

#### Output format

The output is a Markdown file. It contains balisable areas delimited by markers — these are used by AI or other tools to extract the structured description. The rest of the file is free and can be annotated by human readers without affecting the structured content.

The file uses the following markers:

- A title line starting with `# ` — identifies the supply chain. Suggested format: `# <Company> Supply Chain — <scope> — <YYYY-MM-DD>`
- A `**Project specific instructions:**` block — contains general context about the supply chain, enclosed in a triple-backtick fence
- A series of `**User:**` blocks — each contains a structured description of one group of entities, enclosed in a triple-backtick fence
- An `END OF CONFIGURATION` marker — separates the configuration (swim-lanes, lane groups, product types, node types) from the project-specific description (nodes, flows, annotations, notes). The configuration part is reusable across projects.

Everything outside these markers is free text and may be used for human annotations, context, or comments. In particular, place unidentified or ambiguous elements from the extraction below the title, outside any marker, so that a human reviewer can resolve them before replaying the script. Example:

```
# Acme Corp Supply Chain — France & Benelux — 2026-06-03

## Extraction notes

- Two nodes named "Semi-FG" identified — likely distinct warehouses, names to be confirmed.
- No lead times found in the source.
- Flow between HUB and DC (3) direction uncertain.

**Project specific instructions:**
...
```

Example structure:

```
# Acme Corp Supply Chain — France & Benelux — 2026-06-03

**Project specific instructions:**
` ``` `
<general context>
` ``` `

**User:**
` ``` `
<swim-lanes>
` ``` `

**User:**
` ``` `
<lane groups>
` ``` `

**User:**
` ``` `
<product types and node types>
` ``` `

END OF CONFIGURATION

**User:**
` ``` `
<nodes, flows, annotations>
` ``` `
```

#### Content of the Project specific instructions block

The industry sector, if identified:

```
The industry sector is <sector>.
```

#### Content of the User blocks

Entities are described in the following order:

1. Swim-lanes
2. Lane groups
3. Product types
4. Node types

END OF CONFIGURATION

5. Products, nodes, flows, annotations — grouped by logical connection (see grouping rule below)
6. Note categories
7. Notes

**Grouping rule:** Within step 5, group entities that have a natural supply chain connection into the same `**User:**` block. The goal is to minimise the number of blocks without making any single block too large or mixing unrelated topics.

Examples of natural groupings:
- Several customers of the same type: Customers A, B, C
- A raw material and its supplier
- Two warehouses with a flow between them
- A production line, its input product, and its output product

**Conciseness rules:** Omit information that can be inferred from context, without introducing ambiguity:
- Omit the type of an entity if it can be deduced from context (e.g. no need to state "warehouse" if it is obvious from the name or surrounding entities)
- Omit the swim-lane of a node if it matches the default swim-lane of its type. The default swim-lane of a type is the swim-lane containing the highest number of nodes of that type — it must be stated when describing the type.
- Refer to previously described entities by name without re-describing them — all prior descriptions are context. Use the most compact unambiguous reference.

Always mention the type explicitly when the name alone is ambiguous:
```
Create a warehouse named "Paris".
Create a manufacturing site named "Site Nord".
Create a distribution centre named "Hub Central".
Create a supplier named "Dupont".
```

Type can be omitted when it is unambiguous from context:
```
Create customers Internal and External.
Create a raw material RM1 flowing to MIX/BLEND.
```

#### Formulation examples by entity

**Swim-lanes**
```
Create a swim-lane <name>.
Create swim-lanes <lane1>, <lane2>, <lane3>.
```

**Lane groups**
```
Group lanes <lane1>, <lane2>, <lane3> from left to right.
```

**Product types**
```
Create a product type <name>.
Create a product type <name> represented as <icon/shape> in <color>.
```

**Node types**
```
Create a node type <name> represented as <icon/shape> in <color>, default swim-lane <lane>.
Create a product node type <name> represented as <icon/shape> in <color>.
```

**Products, nodes, flows, annotations**
```
Create a customer <name>.
Create customers <A>, <B>, <C>.
Create a supplier <name> with a flow to <node>, lead time <value> <unit>.
Create a warehouse <name> and a warehouse <name> with a bidirectional flow between them.
Create a <product type> <name> at <node>, flowing to <node2>, lead time <value> <unit>.
Add annotation "<text>" to swim-lane <lane>.
Add annotation "<text>".
```

**Note categories**
```
Create note categories: <cat1>, <cat2>.
```

**Notes**
```
Add note "<text>" in category <cat>.
Add note "<text>".
```

## Index

## Changelog
### Version 1.1 - Actor renamed to Node
**Date:** 2026-06-03
**Reason:** Align terminology with DDScope — Actor replaced by Node throughout.

### Version 1.0 - Creation
**Date:** 2026-06-03
**Reason:** Initial guide — extraction of supply chain flow elements from unstructured sources in the context of a DDMRP scoping exercise.
