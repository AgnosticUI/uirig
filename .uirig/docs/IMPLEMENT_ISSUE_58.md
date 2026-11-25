# Implementation Plan: Issue #58 — `--scope` (Audit Boundary) & `--exclude` (Carve-Out) Selector Options

- **Issue:** `#58` — `feat: add --scope (audit boundary) and --exclude (carve-out) selector options`
- **Pillar:** `Pillar 4: Agent-Native Ergonomics & Scoping` (`scope`, `exclude`, `cli`, `mcp`)
- **Status:** `Completed & Merged (commit 534b9c5 on main)`
- **Tracking:** `.uirig/docs/IMPLEMENT_ISSUE_58.md`

---

## 1. Goal & Scope

Support `--scope <selectors>` (audit boundary; keeps existing `--selectors` / `-s` as an exact alias) and `--exclude <selectors>` (carve-out filter skipping matching subtrees across Light DOM and open Shadow DOM, either inside `--scope` or across the document when `--scope` is omitted) across CLI flags, `uirig.config.json` (`"scope"` / `"exclude"`), all verification engines (`tokens`, `contrast`, `dark-mode`, `stress`, `sweep`, `dom`, `ax-tree`), and MCP tools (`scope` / `exclude`). In `stress` and `sweep`, evaluate horizontal overflow relative to the `--scope` container bounds rather than `document.documentElement` so host-shell scrollbars do not trigger false positives.

### Target Output Format

- **CLI text mode (`uirig check --scope "#uirig-stage" --exclude "h3.demo-title"`):**

      Target: http://localhost:5173 @ desktop (1440x900)
      Selectors matched on page (#uirig-stage): 12
      1. [tokens]    Design Token Violations : 0 PASS
      ...

- **JSON mode (`uirig check --scope "#uirig-stage" --exclude "h3.demo-title" --json`):**
  Audits only elements inside `#uirig-stage` (piercing open ShadowRoots) while carving out `h3.demo-title` and host-shell scrollbars.

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Create `feat/scope-exclude-58` branch and inspect `scope.ts`, `dom.ts`, and `cls.ts`** (`chore(context): inspect scope and engine traversal`)
- [x] **Chunk 1: Add `excludeSelectors` support to `src/utils/scope.ts`, `src/utils/dom-walker.ts`, `src/core/ax-tree.ts` + `tests/unit/scope.test.ts`** (`feat(scope): add Shadow-DOM-aware --exclude carve-out matcher` — `1e0ebbb`)
- [x] **Chunk 2: Thread `excludeSelectors` & scoped container overflow math through `tokens.ts`, `matrix.ts`, `dark-mode.ts`, `adversary.ts`, `sweep.ts`, `dom.ts`, `ax-tree.ts`** (`feat(engines): enforce --scope container overflow and --exclude carve-outs` — `cceee6d`)
- [x] **Chunk 3: Wire `scope` / `exclude` into `src/commands/check.ts` (`IUirigConfig`, `ICheckCommandOptions`, `auditViewportInParallel`, `executeCheckCommand`) + `tests/unit/check.test.ts`** (`feat(check): wire scope and exclude config and execution options` — `e142376`, `5d3a9cf`)
- [x] **Chunk 4: Wire `--scope` / `--exclude` CLI flags & help text in `src/index.ts` + `tests/unit/index.test.ts`** (`feat(cli): add --scope and --exclude selector flags` — `153e565`)
- [x] **Chunk 5: Wire `scope` / `exclude` MCP tool inputs in `src/commands/mcp.ts` + `tests/unit/mcp-a2ui-parity.test.ts`, merge & close Issue #58** (`feat(mcp): add scope and exclude options to MCP audit tools` — `8309551`, merged in `534b9c5`)

---

## 3. Acceptance Checklist (from Issue #58)

- [x] `--scope <selectors>` (comma-separated or repeatable) restricts auditing to matching containers and open `ShadowRoot` trees inside them (preserving `--selectors` / `-s` backwards compatibility).
- [x] `--exclude <selectors>` (comma-separated or repeatable) carves out matching subtrees inside `--scope` or from `document` when `--scope` is omitted.
- [x] `uirig.config.json` supports `"scope": ["#uirig-stage"]` and `"exclude": ["h3.demo-title"]`.
- [x] `stress` and `sweep` evaluate horizontal overflow relative to the `--scope` container rather than `document.documentElement`.
- [x] MCP tools accept `scope` and `exclude` arrays and pass them through to `executeCheckCommand`.
