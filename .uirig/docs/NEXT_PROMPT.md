================================================================================
          uirig : Chronological Session Continuity Bridge Capsule              
================================================================================
 TIMESTAMP BASELINE : 2026-11-17T12:28:00-06:00 (Anchored to Nov 17, 2026 Timeline)
 REPOSITORY         : AgnosticUI/uirig
 ACTIVE BRANCH      : feat/issue-15-token-budget
 ACTIVE WORKSPACE   : Post-MVP Roadmap — Issue #15 (`--top <n>` / `--max-tokens <budget>`)
 PLAN DOCUMENT      : .uirig/docs/IMPLEMENT_ISSUE_15.md (Chunks 0–1 Complete; Chunk 2 Next)
 GITHUB ROADMAP MAP (AgnosticUI/uirig) :
   - #8  : Native MCP (Model Context Protocol) Server Mode (`uirig mcp`) [pillar: agent-workflow]
   - #9  : Framework Source-Map & `file:line` Attribution [pillar: agent-workflow]
   - #10 : Zero-Config Design Token Auto-Discovery (`--auto-tokens`) [pillar: agent-workflow]
   - #11 : Root-Cause Grouping & Cascading Deduplication (`--group-by-root`) [pillar: token-efficiency]
   - #12 : [x] "No-Vision Required" Semantic Spatial Brief (`--spatial-brief`) [pillar: token-efficiency]
   - #13 : Deterministic Auto-Fix Patch Generation (`--fix` / `jsonPatch`) [pillar: token-efficiency]
   - #14 : Incremental Git-Diff Component Scoping (`--changed`) [pillar: token-efficiency]
   - #15 : [IN PROGRESS] Token-Budgeted & Priority-Ranked Output (`--top` / `--max-tokens`) [pillar: token-efficiency]
   - #16 : Interactive State & Click-Occlusion Math (`states` / `stress`) [pillar: blind-spots]
   - #17 : Web Component `<slot>` & Content-Model Integrity (`dom`) [pillar: blind-spots]
   - #18 : Responsive Breakpoint Sweep (`--sweep`) [pillar: blind-spots]
   - #19 : Computed Accessibility Tree Snapshot (`dom` / `contrast`) [pillar: blind-spots]

--- MANDATORY WORKFLOW & MENTOR RULES (ENFORCE STRICTLY) ---
1. Pacing & Scope: Plan before coding. Break tasks into small, cohesive micro-chunks across separate turns. Never build an entire feature or multiple unrelated files at once.
2. Co-Develop Behavior & 1-to-1 Specs: Every implementation file must have a corresponding test file covering happy paths, edge cases, and expected errors without `any` or `@ts-ignore`.
3. Plain, Straightforward Naming & Comments: Always use clear, everyday descriptive names and plain-English comments/explanations—avoid academic buzzwords or opaque jargon.
4. Motive First, Syntax Second: Always explain the engineering "WHY" in plain language before showing code.
5. Full Files & Small Widget Blocks: Always provide full copy-pasteable files (or numbered parts under ~110 lines) with all changes fully integrated. Never use "// ... rest of code" or nest triple-backtick fences inside outer markdown fences. Use `Array<T>` / `new Array<T>()` so brackets are never stripped.
6. Explanatory Logging: Inject descriptive console.log / logTelemetry flow telemetry in both production code and tests.
7. Verification & Git Checkpoint: Stop at the end of every chunk, provide `npm run build && npm run typecheck:all && npm test`, suggest a conventional commit message on the active topic branch, and wait for user permission before advancing.

--- TARGET RUNTIME DELTA ---
 EXACT NEXT TASK    : Issue #15 Micro-Chunk 2 — Wire violation priority ranking and `--top` / `--max-tokens` limits into `src/utils/agent-stream.ts`, `src/commands/check.ts`, and `tests/unit/agent-stream.test.ts`.
 ENGINEERING "WHY"  :
   1. `formatAgenticJsonStream()` in `src/utils/agent-stream.ts` should always rank deduplicated violations from highest impact to lowest and trim them safely when `--top` or `--max-tokens` is passed, adding `totalViolations` and `truncatedCount` when items are omitted.
   2. `executeCheckCommand()` in `src/commands/check.ts` needs `top?: number` and `maxTokens?: number` so both JSON mode and terminal output respect the limits.
 CODE BOUNDARIES    :
   - Micro-Chunk 2: `src/utils/agent-stream.ts`, `src/commands/check.ts`, `tests/unit/agent-stream.test.ts` (+ mark Chunk 2 `[x]` in `.uirig/docs/IMPLEMENT_ISSUE_15.md` and update `.uirig/docs/NEXT_PROMPT.md`)

--- SYSTEM BOOT TRIGGER COMMAND ---
::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO BEGIN ISSUE #15 MICRO-CHUNK 2 :::
================================================================================
