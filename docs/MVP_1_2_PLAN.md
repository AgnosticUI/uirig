# `uirig` — MVP v1.2 Release Plan (`@rlevin/uirig`)

**Baseline:** MVP v0.1.0 (`@rlevin/uirig` published to npm; Phases 1–7 complete).  
**Purpose:** Self-contained architectural and execution blueprint for resolving GitHub Issues **#3**, **#4**, **#5**, and **#2** in strict dependency order so any fresh engineering session can execute with zero context loss.

---

## Execution Order & Dependency Rationale

| Order | Issue | Title | Effort | Status | Why This Order? |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **1** | Issue #3 | `--json` causes no color | **S** | **[x] Done** | Smallest isolated fix in `formatter.ts`; restores colored `stderr` telemetry during `--json` runs before adding new CLI flags. |
| **2** | Issue #4 | Expose Playground 4-Tool Check Report to core `uirig` | **S–M** | **[~] Active** | Establishes the canonical human-readable console violation formatter in `src/utils/` before `--selectors` filtering modifies which violations appear. |
| **3** | Issue #5 | Add `--selectors` (`-s`) flag to filter checks to specific elements | **M–L** | **[ ] Next** | Core engine and CLI flag enhancement; naturally inherits the fixed color behavior (#3) and structured console report (#4). |
| **4** | Issue #2 | Audit `npx uirig` -> `npx @rlevin/uirig` | **S** | **[ ] Pending** | Final documentation & CLI help sweep; performed last so docs are updated once with both `@rlevin/uirig` and the new `--verbose` / `--selectors` flags. |

---

## Task 1.2.1 — Issue #3: Restore Colored `stderr` Telemetry Under `--json`

* **GitHub Issue:** https://github.com/AgnosticUI/uirig/issues/3
* **Problem Statement:** Running `npx @rlevin/uirig <target> --json` strips all ANSI color codes from terminal output (`isColorDisabled()` currently returns `true` whenever `UIRIG_JSON_MODE` is enabled).
* **Architectural Rationale ("The Why"):**
  * Diagnostic telemetry (`logTelemetry()`) already routes to `stderr` (`console.error`) when `UIRIG_JSON_MODE` is active, while `formatAgenticJsonStream()` writes strictly to `stdout` (`process.stdout.write`) and never invokes `paint()`.
  * Suppressing ANSI colors when `UIRIG_JSON_MODE` is active degrades human readability on `stderr` without adding any safety to `stdout`. Color suppression should honor `NO_COLOR` (and non-TTY overrides if desired), **not** `UIRIG_JSON_MODE`.
* **Target Files & Routines:**
  * `src/utils/formatter.ts`: Update `isColorDisabled()` so it checks `process.env.NO_COLOR` only (decoupling it from `isJsonStreamMode()`).
  * `tests/unit/formatter.test.ts`: Update the `UIRIG_JSON_MODE` unit test to assert that `paint()` / `formatTelemetryLog()` **preserve** ANSI color codes when `UIRIG_JSON_MODE=1` (unless `NO_COLOR=1` is also set), while `logTelemetry()` still routes to `stderr`.
* **Acceptance Criteria:**
  1. `npx @rlevin/uirig <target> --json` emits colored telemetry badges to `stderr` and 100% ANSI-free, `JSON.parse()`-valid JSON to `stdout`.
  2. Setting `NO_COLOR=1` still disables all ANSI escape sequences across both `stdout` and `stderr`.

---

## Task 1.2.2 — Issue #4: Expose Structured Console Violation Report in Core CLI

* **Implementation Checklist:**
  - [ ] **Micro-Chunk 1:** Create `src/utils/console-report.ts` (`formatConsoleAuditReport`) + `tests/unit/console-report.test.ts`.
  - [ ] **Micro-Chunk 2:** Wire `verbose?: boolean` and `--verbose` into `src/commands/check.ts`, `src/index.ts`, `tests/unit/check.test.ts`, and `tests/unit/index.test.ts`.

* **GitHub Issue:** https://github.com/AgnosticUI/uirig/issues/4
* **Problem Statement:** Outside of `playground/vite.config.ts` (`uirigAutoSpotCheckPlugin`), standard CLI runs (`npx @rlevin/uirig <target>`) print only aggregate violation counts (`Violations detected: 274`) without showing the offending CSS/Shadow-DOM selectors or measured deltas unless the user opens `.uirig/github_pr_comment.md` or parses `--json`.
* **Architectural Rationale ("The Why"):**
  * Developers iterating locally need immediate, scannable feedback on *which* selector failed and *why* (e.g., `div#contrast-token-trap (2.31:1 < 4.5:1)`).
  * Extracting the structured console report renderer out of `playground/src/spot-check.ts` (or `playground/vite.config.ts`) into a dedicated core module (`src/utils/console-report.ts`) eliminates playground-only lock-in while keeping `formatter.ts` focused strictly on ANSI primitives.
  * Supporting an opt-in `--verbose` flag (or printing a concise per-tool selector breakdown when `--verbose` is passed, with a hint in default output) prevents terminal flooding on pages with hundreds of legacy violations.
* **Target Files & Routines:**
  * `playground/src/spot-check.ts` & `playground/vite.config.ts`: Inspect existing `Live 4-Tool Check Report` formatting logic to reuse/port cleanly.
  * `src/utils/console-report.ts` (new) + `tests/unit/console-report.test.ts` (new): Implement `formatConsoleAuditReport(report: ICheckExecutionReport): string` covering all engines (`tokens`, `contrast`, `stress`, `cls`, `xss`, `a11y`, `dark-mode` if present).
  * `src/index.ts` & `src/commands/check.ts`: Add `verbose?: boolean` to `ICheckCommandOptions` and `--verbose` flag parsing in `parseAuditCommandArgs()`; print the detailed selector report in human mode when `options.verbose` is enabled (and print a one-line hint `Run with --verbose to list individual selector violations` when violations > 0 and `--verbose` is omitted).
---

## Task 1.2.3 — Issue #5: Add `--selectors` (`-s`) Flag for Component-Scoped Audits

* **GitHub Issue:** https://github.com/AgnosticUI/uirig/issues/5
* **Problem Statement:** Auditing an entire page (`npx @rlevin/uirig http://localhost:5173`) produces noisy output (e.g., 274 hits across global navs, footers, or legacy widgets) when a developer or AI agent is iterating on one specific component or region.
* **Architectural Rationale ("The Why"):**
  * Scoping audits via `--selectors "#foo, .bar, [data-qux='yo']"` (and repeatable `-s "#foo" -s ".bar"`) lets developers isolate a single Web Component, card, or form without modifying `uirig.config.json`.
  * **Shadow DOM Matching Invariant:** When a user passes `--selectors "ag-button"`, the `<ag-button>` host lives in Light DOM while its `<button>` internals live inside `ag-button.shadowRoot`. Therefore, the browser-side scope helper `matchesScope(el, selectors)` must return `true` if `el` (or any Light DOM ancestor, **including** `el.getRootNode().host` when traversing inside a `ShadowRoot`) matches any selector in `selectors`.
  * **Viewport-Global Engines (`cls` / document-level scrollbar):** Layout shifts (`cls`) and `document.documentElement.scrollWidth` are inherently viewport-global metrics; when `--selectors` is active, `cls` continues measuring viewport stability while element-level engines (`tokens`, `contrast`, `stress`, `xss`, `a11y`, `dark-mode`) filter strictly to matched subtrees.
* **Target Files & Routines:**
  * `src/index.ts` & `tests/unit/index.test.ts`:
    * Extend `parseAuditCommandArgs()` to parse `--selectors=<csv>`, `--selectors <csv>`, `-s=<csv>`, and repeatable `-s <selector>` flags into `selectors?: string[]` (trimmed, deduplicated, non-empty; return `command: 'unknown'` with clear error message if empty).
    * Forward `selectors` into `executeCheckCommand()`.
  * `src/commands/check.ts` & `tests/unit/check.test.ts`:
    * Add `selectors?: string[]` to `ICheckCommandOptions` and pass it into `auditViewportInParallel()` and each engine entry function.
    * Validate selector syntax early (or handle `DOMException` gracefully with a clear `ERR_INVALID_SELECTOR` diagnostic if an invalid CSS selector is supplied).
  * `src/core/tokens.ts`, `src/core/matrix.ts`, `src/core/adversary.ts`, `src/core/xss.ts`, `src/core/a11y.ts` (and `dark-mode.ts` if present) + `tests/unit/*.test.ts`:
    * Accept optional `selectors?: string[]` in each engine's public audit function (`crawlPageTokens`, `auditPageContrast`, `runGeometricStressAudit`, `runXssSecurityAudit`, `runA11yAudit`).
    * Filter evaluated nodes via a shared Shadow-DOM-aware `isElementWithinSelectors(el, selectors)` predicate so violations outside the target subtree(s) are excluded.
* **Acceptance Criteria:**
  1. When `--selectors` / `-s` is omitted, behavior is 100% unchanged.
  2. Passing `--selectors "#card-a, .btn-primary"` or `-s "#card-a" -s ".btn-primary"` evaluates only matching elements and their Light/Shadow DOM descendants.
  3. Invalid CSS selector strings fail fast with exit code `1` and an actionable error on `stderr`.

---

## Task 1.2.4 — Issue #2: Repo-Wide Audit of `npx uirig` -> `npx @rlevin/uirig`

* **GitHub Issue:** https://github.com/AgnosticUI/uirig/issues/2
* **Problem Statement:** Now that the package is published under the scoped npm name `@rlevin/uirig`, remaining `npx uirig` references in documentation, CLI help text, and generated `.uirig/SKILL.md` templates can fail or resolve to an unintended unscoped package name when external users run `npx`.
* **Architectural Rationale ("The Why"):**
  * Performing this sweep **after** Tasks 1.2.1–1.2.3 ensures we update `README.md`, `AGENTS.md`, `src/commands/init.ts`, and `src/index.ts` in one pass—simultaneously switching `npx uirig` -> `npx @rlevin/uirig` and documenting `--verbose` and `--selectors` (`-s`).
* **Target Files & Routines:**
  * `README.md`: Replace user-facing `npx uirig` commands with `npx @rlevin/uirig` and document `--verbose` and `--selectors` (`-s`).
  * `AGENTS.md`: Update `npx uirig check --json` -> `npx @rlevin/uirig check --json` (and mention `--selectors` for targeted agent self-healing).
  * `src/commands/init.ts` (`DEFAULT_UIRIG_SKILL_MD`) & `tests/unit/init.test.ts`: Update generated `.uirig/SKILL.md` commands to `npx @rlevin/uirig`.
  * `src/index.ts` (`CLI_HELP_TEXT` / per-command help) & `tests/unit/index.test.ts`: Update usage examples to `npx @rlevin/uirig` and document `--verbose` and `--selectors` / `-s`.
  * `ANNOUNCEMENTS/` & `docs/`: Audit remaining active documentation references (`rg "npx uirig"`).
* **Acceptance Criteria:**
  1. `rg "npx uirig"` returns zero stale unscoped references in user-facing docs, CLI help, and `.uirig/SKILL.md` templates.
  2. `npm run build && npm run typecheck:all && npm test` passes 100% green.

---

## Fresh-Session Boot Instructions

To execute this plan in a clean LLM session, provide `docs/MVP_1_2_PLAN.md` along with the target files for the active task (`Task 1.2.1` first) and follow the standard micro-chunk workflow:
1. **Plan & Explain "WHY"** before writing code.
2. **Co-develop 1-to-1 unit tests** in `tests/unit/*.test.ts` with zero `any` or `@ts-ignore`.
3. **Verify & Commit** after each micro-chunk via `npm run build && npm run typecheck:all && npm test`.
