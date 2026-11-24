# Issue #18: Responsive Breakpoint Sweep (`--sweep`)
**Current Focus:** ✅ All phases complete (`feat/breakpoint-sweep-18` merged to `main`, Issue #18 closed)

* **Repository:** `AgnosticUI/uirig`
* **Active Branch:** `main` (merged `feat/breakpoint-sweep-18`, closed Issue #18)
* **Latest Published Release on NPM:** `@rlevin/uirig@0.3.1` (`latest: 0.3.1`, closed Issues #51, #52, and #53)

---

## ✅ Phase 1: Core Sweep Engine & Unified Reporting Contracts
* **Goal:** Implement the responsive breakpoint sweep engine and integrate `failedWidths` across JSON streams, priority ranking, and human/Markdown reports.

### ✅ Step 1.1: Sweep Range Parser, Range Collapser & Live Chromium Engine (`71e383b`)
- [x] ✅ Micro-chunk 1.1.1: Implement `parseSweepRange`, `generateSweepWidths`, `collapseContiguousWidths`, and `runBreakpointSweepAudit` in `src/core/sweep.ts` reusing a single open Chromium `Page` via `page.setViewportSize`.
- [x] ✅ Micro-chunk 1.1.2: Co-develop unit and live Chromium specs in `tests/unit/sweep.test.ts` verifying contiguous range collapsing (`"720px-800px"`), sibling collision detection, and `< 1.5s` 28-step performance.

### ✅ Step 1.2: Agentic JSON Stream & Terminal Report Integration (`08e86ac`)
- [x] ✅ Micro-chunk 1.2.1: Add `'sweep'` to `UirigEngineName` in `src/interfaces/locator.ts`.
- [x] ✅ Micro-chunk 1.2.2: Normalize `sweepViolations` into `IAgenticViolation` with `failedWidths?: string` in `src/utils/agent-stream.ts` and render `8. [sweep]` in `src/utils/console-report.ts` with companion tests in `tests/unit/agent-stream.test.ts`.

---

## ✅ Phase 2: Check Dispatcher, CLI Flags & MCP Parity
* **Goal:** Wire `--sweep` end-to-end across `executeCheckCommand`, the root CLI router, and MCP server tools.

### ✅ Step 2.1: Check Dispatcher, Priority Scoring & PR Markdown Report (`af2e15d`)
- [x] ✅ Micro-chunk 2.1.1: Score `sweep` at priority tier `80` in `src/utils/violation-budget.ts` and render `8. Breakpoint Sweep` tables in `src/utils/fs.ts`.
- [x] ✅ Micro-chunk 2.1.2: Wire `sweep?: string | boolean` into `IUirigConfig`, `ICheckCommandOptions`, `IViewportAuditReport.sweepViolations`, `evaluatePosixExitCode` (POSIX exit code `2`), `auditViewportInParallel`, and `executeCheckCommand` in `src/commands/check.ts` with companion spec in `tests/unit/check.test.ts`.

### ✅ Step 2.2: Root CLI `--sweep` / `uirig sweep` Router & Help Text (`a14bbd6`)
- [x] ✅ Micro-chunk 2.2.1: Add `'sweep'` to `AUDIT_TOOL_NAMES` and `SUBCOMMAND_HELP_SPECS`, parse `--sweep`, `--sweep=<min:max:step>`, and `--sweep <min:max:step>` (defaulting bare `--sweep` to `'320:1440:40'` and validating via `parseSweepRange`) in `src/index.ts`, and forward `sweep` in `runCli`.
- [x] ✅ Micro-chunk 2.2.2: Add co-developed unit tests in `tests/unit/index.test.ts` and verify via `npx vitest run tests/unit/index.test.ts && npm run typecheck:all`.

### ✅ Step 2.3: MCP Server Parity (`3c52b97`, `6f92ffb`)
- [x] ✅ Micro-chunk 2.3.1: Add `sweep: z.union([z.string(), z.boolean()]).optional()` to `AUDIT_INPUT_SHAPE`, forward `sweep: rawArgs.sweep` in `createUirigMcpServer`, and register `uirig_sweep` in `MCP_TOOL_SPECS`.
- [x] ✅ Micro-chunk 2.3.2: Add companion integration spec in `tests/unit/mcp-a2ui-parity.test.ts` and update registered tool inventory assertion in `tests/unit/mcp.test.ts`.

---

## ✅ Phase 3: Full Verification, Merge & Issue Closure
* **Goal:** Verify the entire repository test suite, merge `feat/breakpoint-sweep-18` into `main`, and close Issue #18.

### ✅ Step 3.1: Full Build, Typecheck, Test Gate & Merge
- [x] ✅ Micro-chunk 3.1.1: Run `npm run build && npm run typecheck:all && npm test` and verify 100% green across all unit, smoke, and integration suites.
- [x] ✅ Micro-chunk 3.1.2: Merge `feat/breakpoint-sweep-18` into `main` (`git merge --no-ff`) and close Issue #18 on GitHub (`gh issue close 18`).
