# Session Continuity: Issue #9 (`feat/issue-9-source-map-attribution`)

## Current Context
- **Repository:** `AgnosticUI/uirig`
- **Active Branch:** `feat/issue-9-source-map-attribution`
- **Active Issue:** `#9` — `Framework Source-Map & file:line Attribution` (Track B — Task 2 of Epic `#33`)
- **Tracking Plan:** `.uirig/docs/IMPLEMENT_ISSUE_9.md`

## Completed
- **Chunk 0:** Branch `feat/issue-9-source-map-attribution` created and tracking docs initialized.
- **Chunk 1:** Added `ISourceLocation` to `src/interfaces/locator.ts`, implemented Base64 VLQ Source Map v3 decoder and dev-attribute parser in `src/core/source-map.ts`, and verified with unit specs in `tests/unit/source-map.test.ts`.

## Next Step (Chunk 2)
Implement `resolveViolationSourceLocations(page, selectors, cwd)` in `src/core/source-map.ts` using live Chromium CDP (`CSS.styleSheetAdded` + `CSS.getMatchedStylesForNode`), wire `sourceFile`, `lineNumber`, and `columnNumber` into `src/commands/check.ts` and `src/utils/agent-stream.ts`, add live Chromium E2E tests in `tests/unit/source-map.test.ts`, verify, and commit Chunk 2.
