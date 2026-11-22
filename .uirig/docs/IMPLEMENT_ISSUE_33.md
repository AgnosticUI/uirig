# Master Implementation Plan: Issue #33 — Deterministic Eval & Self-Healing Architecture (`uirig` × `AgnosticUI A2UI`)

- **Epic Issue:** `AgnosticUI/uirig#33` — `Epic: Deterministic Eval & Self-Healing Architecture (uirig x A2UI)`
- **Filter Label:** `epic:a2ui-eval` (`is:issue state:open label:epic:a2ui-eval`)
- **Status:** Planned (Ready to Execute Track A -> Task 1 `#19`)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Architectural Goal & Zero-Wire-Change Guarantee

Bridge `uirig`'s Chromium verification primitives with the **A2UI v1.0 wire protocol** so runtime browser telemetry becomes deterministic, component-attributed feedback for **any A2UI renderer or catalog** (Lit, React, Vue, Angular, Flutter Web, or custom renderers), with **AgnosticUI** serving as the flagship reference implementation.

- **Zero Protocol Modifications:** Requires **zero changes** to official A2UI v1.0 wire schemas, catalog schemas, or AG-UI event contracts. All attribution fields (`a2ui`, `sourceFile`, `lineNumber`, `unifiedDiff`) live strictly on `uirig`'s out-of-band CLI/MCP diagnostic output (`IAgenticViolation`).

---

## 2. Execution Tracks & Linked Issues

### Track A: Universal A2UI Eval Fast-Path (Execute First)
- [ ] **Task 1 (`#19`): Computed Accessibility Tree Snapshot (`ax_empty_name`, `ax_hidden_focus`)**
  - **Plan:** `.uirig/docs/IMPLEMENT_ISSUE_19.md`
  - **Outcome:** Native Chromium CDP `Accessibility.getFullAXTree` inspection catching empty accessible names on interactive roles and `tabIndex >= 0` focus traps inside `aria-hidden="true"` / `inert` ancestors across Light and Shadow DOM.
- [ ] **Task 4 (`#31`): Universal `<a2ui-surface>` Component Attribution & Eval Mode**
  - **Plan:** `.uirig/docs/IMPLEMENT_ISSUE_31.md`
  - **Depends on:** `#19`
  - **Outcome:** Walks composed ancestors inside `<a2ui-surface>` (`data-a2ui-id` / `data-a2ui-component` / `el.component`), populates out-of-band `a2ui` metadata (`surfaceId`, `a2uiComponentId`, `a2uiComponentType`, `catalogId`, `wirePath`, `suggestedPatch`), emits A2UI `updateComponents` `remediationAdvice`, and supports multi-theme eval matrices.
- [ ] **Task 5 (`#32`): AgnosticUI Support Center Studio Eval Gate & Self-Healing Demo**
  - **Plan:** `.uirig/docs/IMPLEMENT_ISSUE_32.md`
  - **Depends on:** `#31`
  - **Outcome:** Operationalizes `uirig` against the A2UI Support Center Studio across Light/Dark themes and mobile (`375px`) / desktop (`1440px`) viewports, demonstrating both Always-On Violation Detection (`exitCode: 1`) and Opt-In Self-Healing (`updateComponents` delta converging to `exitCode: 0` in <= 2 turns).

### Track B: Source-Code Auto-Fix Path
- [ ] **Task 2 (`#9`): Framework Source-Map & `file:line` Attribution**
  - **Plan:** `.uirig/docs/IMPLEMENT_ISSUE_9.md`
  - **Outcome:** Resolves runtime CSS/DOM/component violations back to `sourceFile`, `lineNumber`, and `columnNumber` via CDP source maps and Vite/Lit/Stencil/React dev metadata hooks, falling back cleanly to `null` in production builds.
- [ ] **Task 3 (`#13`): Deterministic Auto-Fix Patch Generation (`--fix` / `unifiedDiff`)**
  - **Plan:** `.uirig/docs/IMPLEMENT_ISSUE_13.md`
  - **Depends on:** `#9`
  - **Outcome:** Generates RFC 6902 `jsonPatch` / `unifiedDiff` strings for unambiguous 1-to-1 token and DOM hygiene fixes (`suggestedToken`, missing `alt=""`, `javascript:` URIs) and applies patches on disk only when `--fix` is passed.

---

## 3. Epic Acceptance Criteria
- [ ] **Shadow DOM AX Accuracy (`#19`):** Detects 100% of `ax_empty_name` and `ax_hidden_focus` defects inside encapsulated ShadowRoots with zero false positives.
- [ ] **Zero-Modification A2UI Compliance (`#31`):** Resolves `a2uiComponentId` and `a2uiComponentType` across Light/Shadow DOM boundaries with zero modifications to A2UI v1.0 wire or AG-UI schemas.
- [ ] **Renderer-Agnostic Portability (`#31`):** Passes cleanly against at least two distinct A2UI renderers (e.g., `@agnosticui/a2ui-lit` and `@agnosticui/a2ui-react`).
- [ ] **Closed-Loop Self-Healing Convergence (`#32`):** Opt-in self-healing on the A2UI Support Center Studio converges to `exitCode === 0` within <= 2 agent repair turns.
- [ ] **Deterministic Source Attribution & Auto-Fix (`#9`, `#13`):** Dev-mode audits resolve `sourceFile` / `lineNumber` and emit valid `unifiedDiff` patches that pass `uirig` upon `--fix`.
