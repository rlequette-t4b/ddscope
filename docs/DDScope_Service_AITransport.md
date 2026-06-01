# DDScope — Service AITransport

## Quick Start
Interface definition and implementations for the IAITransport service.
Load when working on AI call routing, adding a new transport implementation, or specifying the IAITransport API.
See DDScope_Architecture_ToBe.md for the role of this service in the overall architecture.

## Keywords
service, ai-transport, IAITransport, claude, api, proxy, interface, implementation

## Table of Contents

1. [1 - Interface IAITransport](#1---interface-iaitransport)
2. [2 - Implementation ai-impl-1](#2---implementation-ai-impl-1)
3. [Index](#index)

## 1 - Interface IAITransport
[up](#table-of-contents)
Full interface specification: to be defined.

Responsibility: abstracts Claude API call routing — sends a prompt payload, returns a response.

Callers: DDS_AI.

## 2 - Implementation ai-impl-1
[up](#table-of-contents)
**CommWiseTransport** — routes the Claude API call through the CommWise secureRequest proxy, required due to CORS policy in the CommWise framework.

Compatible frameworks: framework-1 only (see DDScope_Assemblies.md).

Implementation details: to be defined.

## Index

## Changelog
