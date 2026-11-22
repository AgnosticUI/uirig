# Session Continuity: Issue #19 (`feat/issue-19-ax-tree`)

## Current Context
- **Repository:** `AgnosticUI/uirig`
- **Active Branch:** `feat/issue-19-ax-tree`
- **Active Issue:** `#19` — `Computed Accessibility Tree Snapshot (dom / contrast)` (Track A — Task 1 of Epic `#33`)
- **Tracking Plan:** `.uirig/docs/IMPLEMENT_ISSUE_19.md`

## Completed
- **Chunk 0:** Created branch `feat/issue-19-ax-tree` from `main` and initialized `.uirig/docs/IMPLEMENT_ISSUE_19.md` and `.uirig/docs/NEXT_PROMPT.md`.

## Next Step (Chunk 1)
1. Extend `IDomIntegrityViolation['rule']` in `src/interfaces/locator.ts` with `'ax_empty_name' | 'ax_hidden_focus'`.
2. Create `src/core/ax-tree.ts` with pure AX-tree rule evaluators (`evaluateAxNodeForEmptyName` and `evaluateAxNodeForHiddenFocus`).
3. Add 1-to-1 unit specs in `tests/unit/ax-tree.test.ts`, run `npm run typecheck && npx vitest run tests/unit/ax-tree.test.ts && npm run build`, and commit Chunk 1.
