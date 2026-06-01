# DDScope — Service FileStorage

## Quick Start
Interface definition and implementations for the IFileStorage service.
Load when working on file persistence, adding a new storage implementation, or specifying the IFileStorage API.
See DDScope_Architecture_ToBe.md for the role of this service in the overall architecture.

## Keywords
service, file-storage, IFileStorage, file-system-access-api, persistence, interface, implementation

## Table of Contents

1. [1 - Interface IFileStorage](#1---interface-ifilestorage)
2. [2 - Implementation storage-impl-1](#2---implementation-storage-impl-1)
3. [Index](#index)

## 1 - Interface IFileStorage
[up](#table-of-contents)
Full interface specification: to be defined.

Responsibility: abstracts project file persistence — load, save, save-as, dirty state tracking.

Callers: DDS_STORE (file operations only).

## 2 - Implementation storage-impl-1
[up](#table-of-contents)
**FileSystemAccessStorage** — File System Access API, Chrome/Edge.

Compatible frameworks: framework-1 (see DDScope_Assemblies.md).

Implementation details: to be defined.

## Index

## Changelog
