# Implementation Plan: Issue #31 — Universal `<a2ui-surface>` Component Attribution & Eval Mode

- **Issue:** `AgnosticUI/uirig#31` — `feat(a2ui): universal <a2ui-surface> component attribution and eval mode`
- **Epic:** `AgnosticUI/uirig#33` (`label:epic:a2ui-eval`)
- **Depends on:** `AgnosticUI/uirig#19`
- **Branch:** `feat/issue-31-a2ui-surface-attribution`
- **Status:** Complete (Chunks 0–4 Complete)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Make `uirig` natively understand A2UI surfaces (`<a2ui-surface>` and `[data-a2ui-surface]` / `.surfaceId` hosts) across **any A2UI v1.0 renderer or catalog** (Lit, React, Vue, Angular, Flutter Web, or custom renderers) with **zero modifications** to official A2UI wire schemas, catalog schemas, or AG-UI event contracts.

### Out-of-Band Diagnostic Contract (`IA2uiAttribution`)
Populated on `IAgenticViolation.a2ui` when a violation occurs inside an A2UI surface boundary (`null` for non-A2UI pages):
- `surfaceId: string | null`
- `a2uiComponentId: string | null`
- `a2uiComponentType: string | null`
- `catalogId: string | null`
- `wirePath: string | null`
- `suggestedPatch: Array<{ op: 'add' | 'replace' | 'remove'; path: string; value?: unknown }> | null`

### Out of Scope
- Modifying A2UI v1.0 wire payloads (`createSurface`, `updateComponents`, `deleteSurface`) or AG-UI event streams.

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_31.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-31-a2ui-surface-attribution` after `#19` merges and update continuity docs.
  - **Commit:** `docs(plan): initialize branch and tracking for issue #31`

- [x] **Chunk 1: Composed-Tree `<a2ui-surface>` Discovery & `IA2uiAttribution` Contract**
  - **Files:** `src/interfaces/locator.ts`, `src/utils/a2ui-attribution.ts`, `tests/unit/a2ui-attribution.test.ts`
  - **Action:**
    - Define `IA2uiAttribution` in `src/interfaces/locator.ts`.
    - Implement composed-ancestor traversal (piercing `ShadowRoot` boundaries via `parentElement` and `ShadowRoot.host`) across `<a2ui-surface>` and `[data-a2ui-surface]` / `.surfaceId` hosts.
    - Add unit and live Chromium tests covering Lit-style and React-style A2UI surfaces.
  - **Commit:** `feat(a2ui): resolve composed <a2ui-surface> component attribution across Light and Shadow DOM`

- [x] **Chunk 2: Wire-Protocol `remediationAdvice` & Agentic JSON Stream Integration**
  - **Files:** `src/utils/agent-stream.ts`, `src/commands/check.ts`, `tests/unit/a2ui-attribution.test.ts`
  - **Action:**
    - Attach `a2ui: IA2uiAttribution | null` to every `IAgenticViolation` emitted in `--json` mode (`null` on non-A2UI pages).
    - Translate failures inside A2UI surfaces into catalog-neutral A2UI v1.0 `updateComponents` `remediationAdvice` scoped to `a2uiComponentId`.
  - **Commit:** `feat(a2ui): emit out-of-band a2ui diagnostic block and updateComponents remediation advice`

- [x] **Chunk 3: Multi-Theme Eval Matrix (`--themes`) & Multi-Renderer Portability Specs**
  - **Files:** `src/commands/check.ts`, `src/index.ts`, `src/commands/mcp.ts`, `src/utils/agent-stream.ts`, `tests/unit/a2ui-attribution.test.ts`
  - **Action:**
    - Support evaluating targets across Light mode, Dark mode, and custom theme skins (`--themes`) in a single audit session.
    - Add portability tests validating identical `IA2uiAttribution` output across Lit-style and React-style A2UI renderer fixtures.
  - **Commit:** `feat(a2ui): add multi-theme eval matrix and multi-renderer portability tests`

- [x] **Chunk 4: Docs Sync (`README.md`, `AGENTS.md`) & Final Verification**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_31.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Document `IAgenticViolation.a2ui` schema and `--themes` multi-theme eval mode in `README.md` and `AGENTS.md`, run `npm run typecheck && npm test && npm run build`, mark all chunks `[x]` complete, and merge PR `#31`.
  - **Commit:** `docs(a2ui): document <a2ui-surface> attribution schema and eval mode (#31)`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#31`)
- [x] **Component-ID Discovery:** Resolves `data-a2ui-id`, `data-a2ui-component`, `surface-id`, and `catalog-id` (with `el.component?.id` / `el.component?.component` and `[data-a2ui-surface]` fallback) across Light and Shadow DOM.
- [x] **Out-of-Band `a2ui` Diagnostic Block:** Populates `a2ui` on `--json` violations inside A2UI surfaces (`null` otherwise) with zero changes to A2UI v1.0 wire schemas.
- [x] **Wire-Protocol `remediationAdvice`:** Emits catalog-neutral `updateComponents` instructions scoped to `a2uiComponentId`.
- [x] **Multi-Theme Eval Matrix & Renderer Portability:** Evaluates across Light, Dark, and custom themes and passes against multiple A2UI renderer patterns.
