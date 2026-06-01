# DDScope — Service GraphRenderer

## Quick Start
Interface definition and implementations for the IGraphRenderer service.
Load when working on map rendering, adding a new renderer implementation, or specifying the IGraphRenderer API.
See DDScope_Architecture_ToBe.md for the role of this service in the overall architecture.

## Keywords
service, graph-renderer, IGraphRenderer, cytoscape, rendering, interface, implementation

## Table of Contents

1. [1 - Interface IGraphRenderer](#1---interface-igraphrenderer)
2. [2 - Implementation graph-impl-1](#2---implementation-graph-impl-1)
3. [Index](#index)

## 1 - Interface IGraphRenderer
[up](#table-of-contents)
Full interface specification: to be defined.

Responsibility: abstracts supply chain map rendering — nodes, flows, swim-lanes, canvas interactions.

Callers: DDS_MAP, DDS_SWIMLANES.

## 2 - Implementation graph-impl-1
[up](#table-of-contents)
**CytoscapeRenderer** — interactive canvas using Cytoscape.js v3.

Compatible frameworks: all (see DDScope_Assemblies.md).

Implementation details: to be defined.

## Index

## Changelog
