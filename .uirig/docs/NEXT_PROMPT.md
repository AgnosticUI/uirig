# Session Continuity: Issue #9 (`feat/issue-9-source-map-attribution`)

## Current Context
- **Repository:** `AgnosticUI/uirig`
- **Active Branch:** `feat/issue-9-source-map-attribution`
- **Active Issue:** `#9` — `Framework Source-Map & file:line Attribution` (Track B — Task 2 of Epic `#33`)
- **Tracking Plan:** `.uirig/docs/IMPLEMENT_ISSUE_9.md`

## Roadmap Progress (`epic:a2ui-eval` `#33`)
- [x] **Track A — Task 1 (`#19`):** Computed Accessibility Tree Snapshot (`ax_empty_name`, `ax_hidden_focus`)
- [x] **Track A — Task 4 (`#31`):** Universal `<a2ui-surface>` Component Attribution & Eval Mode
- [x] **Track A — Task 5 (`#32`):** AgnosticUI Support Center Studio Eval Gate & Self-Healing Demo
- [ ] **Track B — Task 2 (`#9`):** Framework Source-Map & `file:line` Attribution (In Progress — Chunk 0 Complete)
- [ ] **Track B — Task 3 (`#13`):** Deterministic Auto-Fix Patch Generation (`--fix` / `unifiedDiff`) (`.uirig/docs/IMPLEMENT_ISSUE_13.md`)

## Immediate Next Step (Chunk 1)
1. Add `ISourceLocation` to `src/interfaces/locator.ts`.
2. Create `src/core/source-map.ts` with a zero-dependency Base64 VLQ Source Map v3 decoder and dev-attribute parser.
3. Add unit specs in `tests/unit/source-map.test.ts`, run verification, and commit Chunk 1.
