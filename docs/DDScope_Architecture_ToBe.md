# DDScope — Architecture ToBe

## Quick Start
Runtime architecture reference for the ToBe modular design of DDScope.
Describes Core (modules, types) and the abstract IService interfaces consumed by Core via dependency injection.
Load when reasoning about module boundaries, defining a new IService, or planning the migration.
Does not cover frameworks or service implementations — see DDScope_Assemblies.md.
Does not specify interface APIs — see the dedicated doc for each IService.

## Keywords
architecture, tobe, modular, core, IService, interface, dependency-injection, module-types, IGraphRenderer, IFileStorage, IAITransport

## Table of Contents

1. [1 - Overview](#1---overview)
2. [2 - Core Modules](#2---core-modules)
3. [3 - IGraphRenderer](#3---igraphrenderer)
4. [4 - IFileStorage](#4---ifilestorage)
5. [5 - IAITransport](#5---iaitransport)
6. [6 - src Layout](#6---src-layout)
7. [Index](#index)

## 1 - Overview
[up](#table-of-contents)
DDScope is structured around two runtime concerns.

**Core** — the framework-agnostic business logic of DDScope. Core depends only on abstract service interfaces (IService) — never on a concrete implementation. It is the portable, ownable heart of the application.

**IService** — the interface pattern for any external capability required by Core. Each IService is an abstraction: Core programs against the interface; the concrete implementation is injected at application init. Multiple implementations of an IService can exist; one is selected per assembly.

Three IService interfaces are identified at this stage: `IGraphRenderer`, `IFileStorage`, `IAITransport`.

How Core is assembled into a runnable application — the framework, the module packaging, the build pipeline — is a separate concern described in DDScope_Assemblies.md.

In the future, an App Modular Architecture convention will be created. The present document will then describe only interfaces and modules.

## 2 - Core Modules
[up](#table-of-contents)
Core is decomposed into modules. Each module has a type that determines how it is packaged by the assembly.

### Fundamental UI Choice

In all assemblies, DDScope is a single-page application. Its UI is built on native HTML/CSS/JavaScript. There is no framework-specific UI toolkit, no virtual DOM, no component framework. This is a deliberate architectural choice: it keeps Core portable and ensures that any host capable of rendering a web page can host DDScope.

Modules are ordered. The order is significant: it defines the sequence in which scripts are executed, styles are applied, and HTML fragments are injected to reconstruct the page. The assembly is responsible for respecting this order.

### Module Types

| Type | Content | Role |
|---|---|---|
| script | JavaScript only | Business logic, data, services — no markup |
| style | CSS only | Visual definition — layout, colors, typography |
| div | HTML + embedded script | UI components — structure, interaction, event wiring |

### Module Inventory

| Module | Type | Layer | Responsibility |
|---|---|---|---|
| DDS_TOOLS | script | Functional | Transversal utilities, levelled logger |
| DDS_COLORS | script | Functional | Color palette constant |
| DDS_ICONS | script | Functional | SVG icon library |
| DDS_STORE | script | Functional | In-memory CRUD + serialization |
| DDS_DURATION | script | Functional | Duration arithmetic and formatting |
| DDS_MODEL | script | Functional | Cascade delete rules |
| DDS_ACTIONS | script | Functional | Action execution engine |
| DDS_TRANSACTIONS | script | Functional | Snapshot-based undo/redo |
| DDS_TX | script | Functional | Transaction label catalogue |
| DDS_TX_HELPER | script | Functional | UI transaction wrapper |
| DDS_JSON | script | Functional | Project import with ID remapping |
| DDS_NODES | script | Helper | Node CRUD facade |
| DDS_PRODUCTS | script | Helper | Product CRUD facade |
| DDS_FLOWS | script | Helper | Flow CRUD facade |
| DDS_SKUS | script | Helper | SKU CRUD facade |
| DDS_BOMS | script | Helper | BOM CRUD facade |
| DDS_DEMANDS | script | Helper | Demand CRUD facade |
| DDS_ANNOTATIONS | script | Helper | Annotation CRUD facade |
| DDS_LANES | script | Helper | Swim-lane CRUD facade |
| DDS_AI_CONTEXT | script | AI | Project state serialization for AI context |
| DDS_AI | script | AI | Prompt assembly, response parsing, calls IAITransport |
| DDS_LAYOUT | script | Presentation | BFS node placement algorithm |
| DDS_MAP | script + div | Presentation | Map state, calls IGraphRenderer |
| DDS_SWIMLANES | script + div | Presentation | Swim-lane overlay, calls IGraphRenderer |
| DDS_AI_UI | div | AI | AI panel — plan display, confirm/cancel |
| All *_UI modules | div | Presentation | Table views, panels, modals |
| App styles | style | Presentation | Global CSS — layout, theming, component styles |

## 3 - IGraphRenderer
[up](#table-of-contents)
Abstracts supply chain map rendering and user interaction on the canvas.

Modules that call this interface: DDS_MAP, DDS_SWIMLANES.

See DDScope_Service_GraphRenderer.md for implementations and API.
Full interface specification: to be defined.

## 4 - IFileStorage
[up](#table-of-contents)
Abstracts project file persistence — load, save, save-as, dirty state.

Modules that call this interface: DDS_STORE (file operations only).

See DDScope_Service_FileStorage.md for implementations and API.
Full interface specification: to be defined.

## 5 - IAITransport
[up](#table-of-contents)
Abstracts Claude API call routing — sends a prompt payload, returns a response.

Modules that call this interface: DDS_AI.

See DDScope_Service_AITransport.md for implementations and API.
Full interface specification: to be defined.

## 6 - src Layout
[up](#table-of-contents)
The repository source tree reflects the two runtime concerns: Core and services.

```
src/
  core/                  # All Core modules
  services/
    IGraphRenderer/
      interface.js         # IGraphRenderer abstract definition
      implementation-1/    # First implementation
    IFileStorage/
      interface.js
      implementation-1/
    IAITransport/
      interface.js
      implementation-1/
```

Assembly configurations — framework selection, service implementation selection, build pipeline — are defined in DDScope_Assemblies.md.

## Index

## Changelog

### Version 2.0 - Framework concern removed
**Date:** 2026-06-01
**Reason:** Framework is a build-time concern, not a runtime concern. Moved entirely to DDScope_Assemblies.md. Architecture ToBe now describes only Core and IService interfaces.

**Changes:**
- Overview: rewritten around two runtime concerns (Core + IService); IService term introduced; framework delegated to DDScope_Assemblies.md
- Core Modules: removed IFramework references; "assembly" replaces "framework" as the packaging agent
- Section 3 - IFramework: removed
- Sections renumbered: 4→3, 5→4, 6→5, 7→6
- src Layout: frameworks/ folder removed
- Quick Start and Keywords updated
