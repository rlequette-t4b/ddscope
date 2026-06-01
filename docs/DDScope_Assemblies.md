# DDScope — Assemblies

## Quick Start
Describes how DDScope Core is assembled into a runnable application: the framework convention, service implementations, compatibility matrix, and named assemblies.
Load when selecting an assembly to build, adding a new framework or service implementation, or synchronising the source repo with a framework.
Does not describe Core or IService interfaces — see conventions/modular-architecture.md (KB).

## Keywords
assemblies, framework, framework-convention, blocks, synchronisation, service-implementations, compatibility-matrix, build, commwise

## Table of Contents

1. [1 - Framework Convention](#1---framework-convention)
2. [2 - Frameworks](#2---frameworks)
3. [3 - Service Implementations](#3---service-implementations)
4. [4 - Compatibility Matrix](#4---compatibility-matrix)
5. [5 - Assemblies](#5---assemblies)
6. [Index](#index)

## 1 - Framework Convention
[up](#table-of-contents)
A framework is the host shell that packages and serves DDScope as a single-page application. From DDScope's perspective, a framework is a **module store**: a database of ordered, typed modules that together constitute the page.

### What a framework provides

A framework exposes an interface to manage modules — read, write, list, and identify them. This is the only capability DDScope requires from a framework at build time. Any runtime service provided by the framework (AI proxy, auth, etc.) is abstracted as an IService and listed in the compatibility matrix — it is not a framework responsibility.

### Module block model

Each module is stored as a **block** in the framework. A block has:
- A **type** — matching the Core module type: `script`, `style`, `div`
- An **identifier** — framework-specific; used to address the block for read/write operations
- An **ordered position** — the sequence in which blocks are loaded to reconstruct the page

### Source synchronisation

The canonical source of truth is the repository (`src/`). The framework holds the deployed state. At build time, the source and the framework are synchronised: blocks are read, compared, and updated as needed.

Each framework document describes how to perform this synchronisation using the available tooling. A correspondence file (e.g. `src/README.md`) maps each source module to its framework block identifier, enabling Claude or a build tool to determine what needs updating.

## 2 - Frameworks
[up](#table-of-contents)

| ID | Description | Doc |
|---|---|---|
| framework-1 | CommWise — b2wise platform | DDScope_Framework_CommWise.md (params) — conventions/commwise-framework.md (KB) |

## 3 - Service Implementations
[up](#table-of-contents)
Each IService has one or more concrete implementations. Each implementation is constrained to one or more frameworks.

### IGraphRenderer

| ID | Description | Doc |
|---|---|---|
| graph-impl-1 | CytoscapeRenderer — interactive canvas, Cytoscape.js v3 | DDScope_Service_GraphRenderer.md |

### IFileStorage

| ID | Description | Doc |
|---|---|---|
| storage-impl-1 | FileSystemAccessStorage — File System Access API, Chrome/Edge | DDScope_Service_FileStorage.md |

### IAITransport

| ID | Description | Doc |
|---|---|---|
| ai-impl-1 | CommWiseTransport — CommWise secureRequest proxy | DDScope_Service_AITransport.md |

## 4 - Compatibility Matrix
[up](#table-of-contents)
Defines which service implementations are valid for each framework.

| Implementation | framework-1 |
|---|---|
| graph-impl-1 (CytoscapeRenderer) | yes |
| storage-impl-1 (FileSystemAccessStorage) | yes |
| ai-impl-1 (CommWiseTransport) | yes |

## 5 - Assemblies
[up](#table-of-contents)
A named assembly is a buildable configuration: one framework + one implementation per required IService.

| Assembly | Framework | IGraphRenderer | IFileStorage | IAITransport |
|---|---|---|---|---|
| commwise-full | framework-1 | graph-impl-1 | storage-impl-1 | ai-impl-1 |

To add an assembly: add a row, verify each implementation against the compatibility matrix in section 4.

## Index

## Changelog

### Version 2.0 - Framework convention added
**Date:** 2026-06-01
**Reason:** Framework concern moved here from DDScope_Architecture_ToBe.md. Framework defined as a module store, not a runtime concern. Source synchronisation convention added.

**Changes:**
- Added section 1 - Framework Convention: module block model, source synchronisation, correspondence file
- Section 1 - Frameworks renamed to 2 - Frameworks; IFramework reference removed
- Sections renumbered
- Quick Start and Keywords updated
