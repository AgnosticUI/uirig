# Session Continuity: `epic:a2ui-eval` (`#33`) -> Next Issue `#19`

## Current Context
- **Repository:** `AgnosticUI/uirig`
- **Active Branch:** `main` (clean; ready to cut `feat/issue-19-ax-tree`)
- **Active Epic:** `#33` — `Epic: Deterministic Eval & Self-Healing Architecture (uirig x A2UI)` (`label:epic:a2ui-eval`)
- **Completed:** Issue `#10` (`--auto-tokens`) merged into `main`; all 6 `epic:a2ui-eval` issues (`#33`, `#19`, `#31`, `#32`, `#9`, `#13`) tagged and planned in `.uirig/docs/IMPLEMENT_ISSUE_*.md`.

## Roadmap Order (`epic:a2ui-eval`)
1. **Track A — Task 1 (`#19`):** Computed Accessibility Tree Snapshot (`ax_empty_name`, `ax_hidden_focus`) — `.uirig/docs/IMPLEMENT_ISSUE_19.md`
2. **Track A — Task 4 (`#31`):** Universal `<a2ui-surface>` Component Attribution & Eval Mode — `.uirig/docs/IMPLEMENT_ISSUE_31.md`
3. **Track A — Task 5 (`#32`):** AgnosticUI Support Center Studio Eval Gate & Self-Healing Demo — `.uirig/docs/IMPLEMENT_ISSUE_32.md`
4. **Track B — Task 2 (`#9`):** Framework Source-Map & `file:line` Attribution — `.uirig/docs/IMPLEMENT_ISSUE_9.md`
5. **Track B — Task 3 (`#13`):** Deterministic Auto-Fix Patch Generation (`--fix` / `unifiedDiff`) — `.uirig/docs/IMPLEMENT_ISSUE_13.md`

## Immediate Next Step
1. Commit the planning docs (`IMPLEMENT_ISSUE_{33,19,31,32,9,13}.md` and `NEXT_PROMPT.md`).
2. Cut branch `feat/issue-19-ax-tree` from `main` and begin **Issue `#19` — Chunk 1** (AX-tree rule evaluators and `IDomIntegrityViolation` rules `ax_empty_name` and `ax_hidden_focus`).
