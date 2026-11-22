# Implementation Plan: Issue #32 — AgnosticUI Support Center Studio Eval Gate & Self-Healing Demo

- **Issue:** `AgnosticUI/uirig#32` — `feat(a2ui): AgnosticUI Support Center Studio eval gate & self-healing demo`
- **Epic:** `AgnosticUI/uirig#33` (`label:epic:a2ui-eval`)
- **Depends on:** `AgnosticUI/uirig#31`
- **Branch:** `feat/issue-32-a2ui-support-center-demo`
- **Status:** In Progress (Chunks 0–2 Complete)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Operationalize `uirig` against the **A2UI Support Center Studio** as both a live CI (Continuous Integration) / runtime verification gate and the flagship reference implementation demonstrating closed-loop A2UI v1.0 self-healing.

### 2-Mode Architecture
1. **Violation Detection (Always On):** `uirig` audits the live `<a2ui-surface>` (`uirig check --selectors="a2ui-surface" --themes="light,dark" --json`) across Light/Dark themes and mobile (`375x812`) / desktop (`1440x900`) viewports, emitting deterministic `IAgenticViolation` diagnostics (`exitCode: 1` or `2`) usable standalone as a read-only CI gate or benchmark grader.
2. **Self-Healing Remediation (Opt-In):** When self-healing is explicitly enabled (`runA2uiSelfHealingLoop`), `uirig`'s `a2ui`-attributed diagnostics feed back into a deterministic A2UI v1.0 `updateComponents` delta repair loop and re-verify until `exitCode === 0` within `<= 2` turns.

### Out of Scope
- Modifying official A2UI v1.0 wire schemas, catalog schemas, or AG-UI event contracts.

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_32.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-32-a2ui-support-center-demo` from `main` and update continuity docs.
  - **Commit:** `docs(plan): initialize branch and tracking for issue #32`

- [x] **Chunk 1: Support Center `<a2ui-surface>` Scenario Fixtures & Multi-Theme/Viewport Eval Gate**
  - **Files:** `src/utils/a2ui-self-heal.ts`, `tests/integration/a2ui-support-center.test.ts`
  - **Action:**
    - Create `src/utils/a2ui-self-heal.ts` with the Support Center A2UI v1.0 component model, HTML renderer, and `buildA2uiUpdateComponentsDelta()` helper that translates `IAgenticViolation[]` into standard A2UI v1.0 `updateComponents` messages.
    - Add integration tests in `tests/integration/a2ui-support-center.test.ts` verifying Always-On Violation Detection (`exitCode: 1`) across Light/Dark themes and mobile (`375x812`) / desktop (`1440x900`) viewports.
  - **Commit:** `feat(a2ui): add Support Center Studio eval gate and updateComponents delta builder`

- [x] **Chunk 2: Closed-Loop Self-Healing Convergence Harness (`<= 2` Repair Turns)**
  - **Files:** `src/commands/check.ts`, `src/utils/a2ui-self-heal.ts`, `tests/integration/a2ui-support-center.test.ts`
  - **Action:**
    - Support compound dark skins (`enterprise-dark`, `high-contrast-dark`) in `auditViewportInParallel()` (`src/commands/check.ts`).
    - Implement `runA2uiSelfHealingLoop()` in `src/utils/a2ui-self-heal.ts` to execute up to `maxTurns` (default `2`) of audit -> `updateComponents` delta application -> re-audit until `exitCode === 0`.
    - Add E2E convergence test in `tests/integration/a2ui-support-center.test.ts` proving the Support Center ticket escalation scenario (`close_drawer_btn` missing `ariaLabel` + low-contrast dark-mode status badge) converges to `exitCode === 0` within `<= 2` turns.
  - **Commit:** `feat(a2ui): add opt-in self-healing updateComponents convergence harness and E2E test`

- [ ] **Chunk 3: Documentation Guide & Final Verification**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_32.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:**
    - Document the "Self-Healing Generative UI with `uirig`" 2-mode workflow (Always-On Detection + Opt-In Self-Healing) with the end-to-end Support Center trace example in `README.md` and `AGENTS.md`.
    - Run `npm run typecheck && npm test && npm run build`, mark all chunks `[x]` complete, and merge PR `#32`.
  - **Commit:** `docs(a2ui): add Self-Healing Generative UI with uirig guide and trace (#32)`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#32`)
- [x] **Support Center Eval Gate:** `uirig` audits `<a2ui-surface>` scenarios across Light/Dark themes and mobile (`375px`) / desktop (`1440px`) viewports (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom` AX-tree).
- [x] **2-Mode Workflow:** Demonstrates standalone read-only grading (`exitCode: 1`) alongside opt-in `updateComponents` delta repair converging to `exitCode: 0` within `<= 2` turns.
- [ ] **Docs Guide:** Documents the "Self-Healing Generative UI with `uirig`" workflow for `://agnosticui.com` and repo docs.
