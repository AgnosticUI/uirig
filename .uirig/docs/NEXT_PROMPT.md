# Session Continuity Capsule: Issue #16 (`states` — Interactive State & Click-Occlusion Math)

- **Issue:** `#16` — `Interactive State & Click-Occlusion Math (states / stress)`
- **Branch:** `feat/issue-16-states`
- **Plan:** `.uirig/docs/IMPLEMENT_ISSUE_16.md`
- **Status:** In Progress — **Chunk 0** complete; resuming at **Chunk 1**

---

## Completed Chunks

- [x] **Chunk 0:** Created branch `feat/issue-16-states` from `main` and documented edge-case-hardened plan in `.uirig/docs/IMPLEMENT_ISSUE_16.md` (`docs(plan): initialize branch and tracking for issue #16`)

---

## Key Occlusion & Focus-Visible Edge Cases Locked In

- **False-Positive Guards:** Exempt enclosing `<label>` AND sibling/floating `<label for="id">`; skip controls with own `pointer-events: none`; clip control rect to overflow-clipping ancestors (`hidden`/`clip`/`scroll`/`auto`) and `[0..innerWidth, 0..innerHeight]` viewport bounds; sample center `(50%, 50%)` + safely inset `(25%, 25%)` / `(75%, 75%)` points to avoid `border-radius: 999px` pill corners; walk composed tree (`assignedSlot` / `getRootNode().host`) so `<my-button tabindex="0">` Shadow DOM inner buttons are recognized as descendants.
- **False-Negative Guards:** Do NOT skip `opacity: 0` elements during hit-testing (catches transparent clickjacking/modal backdrops); enforce `visibility !== 'hidden'` on target controls; descend nested `.shadowRoot.elementsFromPoint(x, y)` in a `while` loop; support same-origin `<iframe>` traversal; exclude `<area>` map tags.

---

## Remaining Chunks

- [ ] **Chunk 1:** Pure Click-Occlusion & Focus-Visible Evaluators (`src/interfaces/locator.ts`, `src/core/states.ts`, `tests/unit/states.test.ts`)
- [ ] **Chunk 2:** Live Chromium CDP `CSS.forcePseudoState` & Shadow-Piercing `elementsFromPoint` Collector (`src/core/states.ts`, `tests/unit/states.test.ts`)
- [ ] **Chunk 3:** Wire `states` into `check.ts`, `agent-stream.ts`, `console-report.ts`, `index.ts`, and `mcp.ts`
- [ ] **Chunk 4:** Documentation Sync (`README.md`, `AGENTS.md`), Full Verification & Merge to `main`

---

## Next-Session Resume Prompt

```text
Continue Issue #16 from .uirig/docs/IMPLEMENT_ISSUE_16.md at Chunk 1 on branch feat/issue-16-states. Keep all code blocks complete (no placeholders) and <= 125 LOC per part.
```