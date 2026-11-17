================================================================================
          uirig : Chronological Session Continuity Bridge Capsule              
================================================================================
 TIMESTAMP BASELINE : 2026-11-17T07:05:00-06:00 (Anchored to Nov 17, 2026 Timeline)
 ACTIVE WORKSPACE   : Post-MVP Roadmap — Issue #5 ("No-Vision Required" Semantic Spatial Brief `--spatial-brief`)
 PLAN DOCUMENT      : .uirig/docs/IMPLEMENT_ISSUE_5.md (Chunks 0–4 Complete; Chunk 5 Final Docs Sync Next)
 COMPLETED CHUNKS (ISSUE #5) :
   - [x] Chunk 0: Plan & continuity capsule scaffold (`.uirig/docs/IMPLEMENT_ISSUE_5.md`, `.uirig/docs/NEXT_PROMPT.md`)
   - [x] Chunk 1: `SpatialNode` types & `formatSpatialBrief()` (`src/utils/spatial-brief.ts`, `tests/unit/spatial-brief.test.ts`)
   - [x] Chunk 2: Shadow-DOM-aware `collectSpatialNodes()` (`src/utils/spatial-brief.ts`, `tests/unit/spatial-brief.test.ts`)
   - [x] Chunk 3: Runner, JSON stream & PR report integration (`src/commands/check.ts`, `src/utils/agent-stream.ts`, `src/utils/fs.ts`)
   - [x] Chunk 4: CLI flag `--spatial-brief` & `--help` wiring (`src/index.ts`, `tests/unit/index.test.ts`)
 REMAINING CHUNKS (ISSUE #5) :
   - Chunk 5: Docs sync (`README.md`, `AGENTS.md`) & next-issue handoff

--- MANDATORY WORKFLOW & MENTOR RULES (ENFORCE STRICTLY) ---
1. Pacing & Scope: Plan before coding. Break tasks into small, cohesive micro-chunks across separate turns.
2. Co-Develop Behavior & 1-to-1 Specs: Every implementation file must have a corresponding test file without `any` or `@ts-ignore`.
3. Motive First, Syntax Second: Always explain the engineering "WHY" in plain language before showing code.
4. Verbose Commenting & Walkthroughs: Preserve all existing JSDoc and inline comment headers when modifying files.
5. Explanatory Logging: Inject descriptive console.log / logTelemetry flow telemetry in both production code and tests.
6. No Code Placeholders & Small Widget Blocks: Keep each code block under ~110 lines (splitting files into numbered parts) and never nest triple-backtick fences inside outer markdown fences.
7. Verification & Git Checkpoint: Stop at the end of every chunk, provide `npm run build && npm run typecheck:all && npm test`, suggest a conventional commit message, and wait for user permission before advancing.

--- TARGET RUNTIME DELTA ---
 EXACT NEXT TASK    : Issue #5 Micro-Chunk 5 (Final) — Document `--spatial-brief` in `README.md` and `AGENTS.md`, mark Chunk 5 `[x]` in `.uirig/docs/IMPLEMENT_ISSUE_5.md`, and set `.uirig/docs/NEXT_PROMPT.md` to the next roadmap issue.
 CODE BOUNDARIES    :
   - Micro-Chunk 5: `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_5.md`, `.uirig/docs/NEXT_PROMPT.md`

--- SYSTEM BOOT TRIGGER COMMAND ---
::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO BEGIN ISSUE #5 MICRO-CHUNK 5 :::
================================================================================
