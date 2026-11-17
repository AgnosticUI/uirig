================================================================================
          uirig : Chronological Session Continuity Bridge Capsule              
================================================================================
 TIMESTAMP BASELINE : 2026-11-17T15:25:00-06:00 (Anchored to Nov 17, 2026 Timeline)
 REPOSITORY         : AgnosticUI/uirig
 ACTIVE BRANCH      : main (after merging PR for feat/issue-15-token-budget)
 ACTIVE WORKSPACE   : Post-MVP Roadmap — Issue #15 Complete; Issue #11 Next on Deck
 GITHUB ROADMAP MAP (AgnosticUI/uirig) :
   - #8  : Native MCP (Model Context Protocol) Server Mode (`uirig mcp`) [pillar: agent-workflow]
   - #9  : Framework Source-Map & `file:line` Attribution [pillar: agent-workflow]
   - #10 : Zero-Config Design Token Auto-Discovery (`--auto-tokens`) [pillar: agent-workflow]
   - #11 : Root-Cause Grouping & Cascading Deduplication (`--group-by-root`) [pillar: token-efficiency]
   - #12 : [x] "No-Vision Required" Semantic Spatial Brief (`--spatial-brief`) [pillar: token-efficiency]
   - #13 : Deterministic Auto-Fix Patch Generation (`--fix` / `jsonPatch`) [pillar: token-efficiency]
   - #14 : Incremental Git-Diff Component Scoping (`--changed`) [pillar: token-efficiency]
   - #15 : [x] Token-Budgeted & Priority-Ranked Output (`--top` / `--max-tokens`) [pillar: token-efficiency]
   - #16 : Interactive State & Click-Occlusion Math (`states` / `stress`) [pillar: blind-spots]
   - #17 : Web Component `<slot>` & Content-Model Integrity (`dom`) [pillar: blind-spots]
   - #18 : Responsive Breakpoint Sweep (`--sweep`) [pillar: blind-spots]
   - #19 : Computed Accessibility Tree Snapshot (`dom` / `contrast`) [pillar: blind-spots]
 COMPLETED ISSUES   :
   - [x] Issue #12: "No-Vision Required" Semantic Spatial Brief (`--spatial-brief`)
   - [x] Issue #15: Token-Budgeted & Priority-Ranked Output (`--top` / `--max-tokens`)
         * `src/utils/violation-budget.ts` + `tests/unit/violation-budget.test.ts`
         * Integrated into `src/utils/agent-stream.ts`, `src/commands/check.ts`, `src/index.ts`, `tests/unit/agent-stream.test.ts`, `tests/unit/index.test.ts`
         * Documented in `README.md`, `AGENTS.md`, and `.uirig/docs/IMPLEMENT_ISSUE_15.md`
 NEXT ISSUE ON DECK : Issue #11 — Root-Cause Grouping & Cascading Deduplication (`--group-by-root`)
   - Pillar 2: Token & AI Cost Savers (`pillar: token-efficiency`, `cli`)
   - Goal: Collapse cascading child failures (e.g., 15 contrast or overflow failures inside a single `<ag-card>` container) under their shared offending parent container or rule, reporting 1 root-cause violation with `childCount` and `sampleChildren` metadata.

--- MANDATORY WORKFLOW & MENTOR RULES (ENFORCE STRICTLY) ---
1. Pacing & Scope: Plan before coding (create `.uirig/docs/IMPLEMENT_ISSUE_11.md` first on topic branch `feat/issue-11-group-by-root`). Break tasks into small, cohesive micro-chunks across separate turns.
2. Co-Develop Behavior & 1-to-1 Specs: Every implementation file must have a corresponding test file covering happy paths, edge cases, and expected errors without `any` or `@ts-ignore`.
3. Plain, Straightforward Naming & Comments: Always use clear, everyday descriptive names and plain-English comments/explanations—avoid academic buzzwords or opaque jargon.
4. Motive First, Syntax Second: Always explain the engineering "WHY" in plain language before showing code.
5. Complete Copy-Pasteable Files Only (No Partial Snippets): Every time a file is created or modified, output the ENTIRE file from line 1 to EOF with all changes fully integrated (split into sequentially numbered parts under ~110 lines each if the file exceeds 110 lines). Never output isolated diff hunks, partial snippets, or "// ... rest of code" placeholders that require manual splicing. Never nest triple-backtick fences inside outer markdown fences, and use `Array<T>` / `new Array<T>()` so brackets are never stripped.
6. Explanatory Logging: Inject descriptive console.log / logTelemetry flow telemetry in both production code and tests.
7. Verification & Git Checkpoint: Stop at the end of every chunk, provide `npm run build && npm run typecheck:all && npm test`, suggest a conventional commit message on the active topic branch, and wait for user permission before advancing.

--- TARGET RUNTIME DELTA ---
 EXACT NEXT TASK    : Cut topic branch `feat/issue-11-group-by-root` and plan Issue #11 (`--group-by-root`) in `.uirig/docs/IMPLEMENT_ISSUE_11.md` (Chunk 0 — No code yet).
 CODE BOUNDARIES    :
   - Chunk 0: `.uirig/docs/IMPLEMENT_ISSUE_11.md` & `.uirig/docs/NEXT_PROMPT.md`

--- SYSTEM BOOT TRIGGER COMMAND ---
::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO PLAN ISSUE #11 (CHUNK 0) :::
================================================================================
