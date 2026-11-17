================================================================================
          uirig : Chronological Session Continuity Bridge Capsule              
================================================================================
 TIMESTAMP BASELINE : 2026-11-17T07:25:00-06:00 (Anchored to Nov 17, 2026 Timeline)
 REPOSITORY         : AgnosticUI/uirig
 ACTIVE WORKSPACE   : Post-MVP Roadmap — Issue #12 Complete; Issue #15 Next on Deck
 GITHUB ROADMAP MAP (AgnosticUI/uirig) :
   - #8  : Native MCP (Model Context Protocol) Server Mode (`uirig mcp`) [pillar: agent-workflow]
   - #9  : Framework Source-Map & `file:line` Attribution [pillar: agent-workflow]
   - #10 : Zero-Config Design Token Auto-Discovery (`--auto-tokens`) [pillar: agent-workflow]
   - #11 : Root-Cause Grouping & Cascading Deduplication (`--group-by-root`) [pillar: token-efficiency]
   - #12 : [x] "No-Vision Required" Semantic Spatial Brief (`--spatial-brief`) [pillar: token-efficiency]
   - #13 : Deterministic Auto-Fix Patch Generation (`--fix` / `jsonPatch`) [pillar: token-efficiency]
   - #14 : Incremental Git-Diff Component Scoping (`--changed`) [pillar: token-efficiency]
   - #15 : Token-Budgeted & Priority-Ranked Output (`--top` / `--max-tokens`) [pillar: token-efficiency]
   - #16 : Interactive State & Click-Occlusion Math (`states` / `stress`) [pillar: blind-spots]
   - #17 : Web Component `<slot>` & Content-Model Integrity (`dom`) [pillar: blind-spots]
   - #18 : Responsive Breakpoint Sweep (`--sweep`) [pillar: blind-spots]
   - #19 : Computed Accessibility Tree Snapshot (`dom` / `contrast`) [pillar: blind-spots]
 COMPLETED ISSUES   :
   - [x] Issue #12 (Roadmap #5): "No-Vision Required" Semantic Spatial Brief (`--spatial-brief`)
         * `src/utils/spatial-brief.ts` + `tests/unit/spatial-brief.test.ts`
         * Integrated into `src/commands/check.ts`, `src/utils/agent-stream.ts`, `src/utils/fs.ts`, `src/index.ts`, `tests/unit/index.test.ts`
         * Documented in `README.md`, `AGENTS.md`, and `.uirig/docs/IMPLEMENT_ISSUE_5.md`
 NEXT ISSUE ON DECK : Issue #15 — Token-Budgeted & Priority-Ranked Output (`--top <n>` / `--max-tokens <budget>`)
   - Pillar 2: Token & AI Cost Savers (`pillar: token-efficiency`, `cli`)
   - Goal: Rank deduplicated violations by structural blast radius (`Layout/CLS > Interactivity/Stress > Contrast/Dark-Mode > Token Drift > DOM Hygiene`) and support `--top <n>` and `--max-tokens <budget>` in `src/utils/agent-stream.ts`, `src/commands/check.ts`, and `src/index.ts`.

--- MANDATORY WORKFLOW & MENTOR RULES (ENFORCE STRICTLY) ---
1. Pacing & Scope: Plan before coding (create `.uirig/docs/IMPLEMENT_ISSUE_15.md` first). Break tasks into small, cohesive micro-chunks across separate turns.
2. Co-Develop Behavior & 1-to-1 Specs: Every implementation file must have a corresponding test file without `any` or `@ts-ignore`.
3. Motive First, Syntax Second: Always explain the engineering "WHY" in plain language before showing code.
4. Verbose Commenting & Walkthroughs: Preserve all existing JSDoc and inline comment headers when modifying files.
5. Explanatory Logging: Inject descriptive console.log / logTelemetry flow telemetry in both production code and tests.
6. No Code Placeholders & Small Widget Blocks: Keep each code block under ~110 lines (splitting files into numbered parts) and never nest triple-backtick fences inside outer markdown fences.
7. Verification & Git Checkpoint: Stop at the end of every chunk, provide `npm run build && npm run typecheck:all && npm test`, suggest a conventional commit message, and wait for user permission before advancing.

--- TARGET RUNTIME DELTA ---
 EXACT NEXT TASK    : Plan Issue #15 (`--top` / `--max-tokens`) in `.uirig/docs/IMPLEMENT_ISSUE_15.md` (Chunk 0 — No code yet).
 CODE BOUNDARIES    :
   - Chunk 0: `.uirig/docs/IMPLEMENT_ISSUE_15.md` & `.uirig/docs/NEXT_PROMPT.md`

--- SYSTEM BOOT TRIGGER COMMAND ---
::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO PLAN ISSUE #15 (CHUNK 0) :::
================================================================================
