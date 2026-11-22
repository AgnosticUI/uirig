# Implementation Plan: Issue #32 — AgnosticUI Support Center Studio Eval Gate & Self-Healing Demo

- **Issue:** `AgnosticUI/uirig#32` — `feat(a2ui): AgnosticUI Support Center Studio eval gate & self-healing demo`
- **Epic:** `AgnosticUI/uirig#33` (`label:epic:a2ui-eval`)
- **Depends on:** `AgnosticUI/uirig#31`
- **Branch:** `feat/issue-32-a2ui-support-center-demo`
- **Status:** Planned
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Operationalize `uirig` against the **A2UI Support Center Studio** (`a2ui-support-center-demo.netlify.app` / local AgnosticUI A2UI Support Center fixture) as both a live CI/runtime verification gate and the flagship reference implementation demonstrating closed-loop A2UI v1.0 self-healing.

### 2-Mode Architecture
1. **Violation Detection (Always On):** `uirig` audits the live `<a2ui-surface>` (`uirig check --selectors="a2ui-surface" --json`) across Light/Dark themes and mobile (`375x812`) / desktop (`1440x900`) viewports, emitting deterministic `IAgenticViolation` diagnostics (`exitCode: 1` or `2`) usable standalone as a read-only CI gate or benchmark grader.
2. **Self-Healing Remediation (Opt-In):** When self-healing is explicitly enabled (`--self-heal` / `autoHeal: true` in the agent harness loop), `uirig`'s `a2ui`-attributed diagnostics feed back into the LLM repair loop to emit minimal, standard A2UI v1.0 `updateComponents` deltas and re-verify until `exitCode === 0` within `<= 2` turns.

### Out of Scope
- Modifying official A2UI v1.0 wire schemas, catalog schemas, or AG-UI event contracts.

---

## 2. Micro-Chunk Execution Breakdown

- [ ] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_32.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-32-a2ui-support-center-demo` after `#31` merges and update continuity docs.
  - **Commit:** `docs(plan): initialize branch and tracking for issue #32`

- [ ] **Chunk 1: Support Center `<a2ui-surface>` Scenario Fixtures & Eval Matrix Runner**
  - **Files:** `tests/integration/a2ui-support-center.test.ts` (or `playground/` A2UI Support Center fixture)
  - **Action:**
    - Create deterministic `<a2ui-surface id="support-ticket">` test fixtures representing realistic Support Center scenarios (icon-only close button missing `ariaLabel`, low-contrast dark-mode status badge, mobile `375px` text overflow).
    - Verify `uirig` catches each defect across Light/Dark themes and `375x812` / `1440x900` viewports with exact `a2uiComponentId` and `wirePath` attribution.
  - **Commit:** `test(a2ui): add Support Center Studio eval gate fixtures and multi-viewport matrix tests`

- [ ] **Chunk 2: Closed-Loop Self-Healing Convergence Harness (`<= 2` Repair Turns)**
  - **Files:** `src/utils/a2ui-self-heal.ts` (or harness helper), `tests/integration/a2ui-support-center.test.ts`
  - **Action:**
    - Implement an opt-in self-healing loop helper/reference harness that applies `updateComponents` delta patches generated from `uirig`'s `IAgenticViolation` output and re-runs `executeCheckCommand` until `exitCode === 0`.
    - Assert deterministic convergence within `<= 2` repair turns on the Support Center ticket escalation scenario (`close_drawer_btn` receiving `ariaLabel: "Close ticket details"`).
  - **Commit:** `feat(a2ui): add opt-in self-healing updateComponents convergence harness and E2E test`

- [ ] **Chunk 3: Documentation Guide & Final Verification**
  - **Files:** `README.md`, `AGENTS.md`, `docs/` (and AgnosticUI docs guide reference for `://agnosticui.com`), `.uirig/docs/IMPLEMENT_ISSUE_32.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:**
    - Document the "Self-Healing Generative UI with `uirig`" 2-mode workflow (Always-On Detection + Opt-In Self-Healing) with the end-to-end Support Center trace example.
    - Run `npm run typecheck && npm test && npm run build`, mark all chunks `[x]` complete, and merge PR `#32`.
  - **Commit:** `docs(a2ui): add Self-Healing Generative UI with uirig guide and trace (#32)`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#32`)
- [ ] **Support Center Eval Gate:** `uirig` audits `<a2ui-surface>` scenarios across Light/Dark themes and mobile (`375px`) / desktop (`1440px`) viewports (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom` AX-tree).
- [ ] **2-Mode Workflow:** Demonstrates standalone read-only grading (`exitCode: 1`) alongside opt-in `updateComponents` delta repair converging to `exitCode: 0` within `<= 2` turns.
- [ ] **Docs Guide:** Documents the "Self-Healing Generative UI with `uirig`" workflow for `://agnosticui.com` and repo docs.
