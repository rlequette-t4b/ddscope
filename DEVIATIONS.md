# Intentional Deviations — DDScope

## Deviation 1: No context.md (BP#2)

**Status:** Documented & Accepted

**Deviation:** No `context.md` at project root.

**Rationale:** DDScope has a richer documentation architecture than BP#2 assumes.
`README.md` serves as the human entry point. `docs/` contains 15 structured documents
organized by domain. Together they fully cover the role of `context.md` — more completely.

**Impact:** None — generic project knowledge is accessible and well-organized.

---

## Deviation 2: Claude.md missing Keywords and Changelog (BP#13 doc)

**Status:** Documented & Accepted

**Deviation:** `Claude.md` does not have Keywords or Changelog sections.

**Rationale:** `Claude.md` is an operational instruction file for Claude Code only
(explicitly stated in the file header). It is not a reference document intended
for human navigation. Keywords and Changelog bring no value in this context.

**Impact:** None — TOC is being added separately to address navigation in the file.
