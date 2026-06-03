# TODO

Active backlog for DDScope — improvement ideas and tasks identified during sessions.

## Quick Start

Active backlog for DDScope.
Add items during sessions with explicit user approval.
Done items are moved to TODO-archive.md.

## Keywords
todo, backlog, ddscope

## Table of Contents

1. [High priority](#high-priority)
2. [Normal](#normal)
3. [Low priority](#low-priority)
4. [Index](#index)

## High priority
[up](#table-of-contents)

- [ ] When AI assistant creates a product, also create a product node on the map by default — add instruction to the AI assistant prompt
- [ ] Save as template: button to save styles and swimlanes only; unify styles/swimlanes handling on load from file; remove "JSON" wording from UI
- [ ] Node type icon transparency attribute should default to true on creation

## Normal
[up](#table-of-contents)
- [ ] Renumber DDScope_AI_Assistant.md sections after inserting §4b (Script Format) — currently 4b, 5, 6, 7; should be 4, 5, 6, 7 or similar clean sequence
- [ ] Decouple `DDS_AI` — extract CommWise proxy call into a thin `DDS_AI_SERVICE` shim (SCRIPT 2300); see DDScope_Architecture.md §5 - Layer - AI
- [ ] Architecture session — make DDScope modular and assemblable with different frameworks (abstract CommWise, File System API, rendering layer)
- [ ] Send full session history to Claude instead of last turn only — update `DDS_AI.call()` and DDScope_AI_Assistant.md §5.2
- [ ] Create an instruction file for DDScope conversational bots (AI assistant prompt improvement)
- [ ] Documentation conformance audit — bring all docs/ and root .md files into conformance with conventions/documentation.md (quasi-universal non-conformance identified in session 2026-06-01)
- [ ] Populate GLOSSARY.md — add terms for all three domains: DDMRP, Application, CommWise
- [ ] Supply chain flow extraction guide — add DDMRP-relevant attributes section (demand patterns, decoupling point candidates, customer tolerance time, long lead time segments)
- [ ] AI assistant — exploit `END OF CONFIGURATION` marker in script replay: allow replay to start after this marker, skipping swim-lanes, lane groups, product types, and node types (configuration already loaded)

## Low priority
[up](#table-of-contents)

- [ ] When editing a node type, show a live preview of the node's visual appearance
- [ ] Copy / cut / paste nodes on the map

## Index

| Term | Occurrences |
|------|-------------|

## Changelog

### Version 1.9 - Copy/cut/paste added
**Date:** 2026-06-03
**Changes:**
- Added [Low]: Copy / cut / paste nodes on the map


### Version 1.8 - Icon transparency default added
**Date:** 2026-06-03
**Changes:**
- Added [High]: Node type icon transparency defaults to true on creation


### Version 1.7 - Node type preview added
**Date:** 2026-06-03
**Changes:**
- Added [Low]: Live preview of node appearance when editing a type


### Version 1.6 - Save as template added
**Date:** 2026-06-03
**Changes:**
- Added [High]: Save as template — styles/swimlanes only, unified load, remove JSON wording


### Version 1.5 - AI product node creation added
**Date:** 2026-06-03
**Changes:**
- Added [High]: When AI assistant creates a product, also create a product node on the map by default


### Version 1.4 - Glossary content item added
**Date:** 2026-06-01
**Changes:**
- Added: Populate GLOSSARY.md — terms for DDMRP, Application, CommWise domains

### Version 1.3 - Documentation conformance audit item added
**Date:** 2026-06-01
**Changes:**
- Added: Documentation conformance audit for all .md files

### Version 1.2 - Conversational bot instruction file added
**Date:** 2026-06-01
**Changes:**
- Added: Create instruction file for DDScope conversational bots

### Version 1.1 - Full history item added
**Date:** 2026-06-01
**Changes:**
- Added: Send full session history to Claude

### Version 1.0 - Creation
**Date:** 2026-06-01
**Reason:** Initial backlog created during AI assistant improvement session.

**Changes:**
- Two items added: DDS_AI_SERVICE shim, architecture modularity session
