================================================================================
          uirig : Chronological Session Continuity Bridge Capsule              
================================================================================
 TIMESTAMP BASELINE : 2026-11-16T22:49:00-06:00 (Anchored to Nov 16, 2026 Timeline)
 ACTIVE WORKSPACE   : Post-MVP Roadmap — Issue #5 ("No-Vision Required" Semantic Spatial Brief `--spatial-brief`)
 PLAN DOCUMENT      : .uirig/docs/IMPLEMENT_ISSUE_5.md (Chunks 0–3 Complete; Chunk 4 Next)
 STRATEGIC PIVOT    :
   - Positioning: "The first line of defense for AI-generated UIs and Web Components"
     (a fast, zero-config guardrail before heavier axe-core or Lighthouse audits run).
   - 6-Engine Core Suite: `tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom`
     (plus uncaught runtime JS error capture in `src/commands/check.ts`).
   - Zero-Config Entry: `npx uirig <url-or-file>` runs immediately with sensible
     defaults and auto-serves local `.html` files over ephemeral `127.0.0.1` HTTP.
 COMPLETED CHUNKS (ISSUE #5) :
   - [x] Chunk 0: Plan & continuity capsule scaffold (`.uirig/docs/IMPLEMENT_ISSUE_5.md`, `.uirig/docs/NEXT_PROMPT.md`)
   - [x] Chunk 1: `SpatialNode` types & `formatSpatialBrief()` (`src/utils/spatial-brief.ts`, `tests/unit/spatial-brief.test.ts`)
   - [x] Chunk 2: Shadow-DOM-aware `collectSpatialNodes()` (`src/utils/spatial-brief.ts`, `tests/unit/spatial-brief.test.ts`)
   - [x] Chunk 3: Runner, JSON stream & PR report integration (`src/commands/check.ts`, `src/utils/agent-stream.ts`, `src/utils/fs.ts`)
 REMAINING CHUNKS (ISSUE #5) :
   - [ ] Chunk 4: CLI flag `--spatial-brief` & `--help` wiring (`src/index.ts`, `tests/unit/index.test.ts`)
   - [ ] Chunk 5: Docs sync (`README.md`, `AGENTS.md`) & next-issue handoff

--- MANDATORY WORKFLOW & MENTOR RULES (ENFORCE STRICTLY) ---
1. Pacing & Scope: Plan before coding. Break tasks into small, cohesive micro-chunks across separate turns. Never build an entire feature or multiple unrelated files at once.
2. Co-Develop Behavior & 1-to-1 Specs: Every implementation file must have a corresponding test file covering happy paths, edge cases, and expected errors without `any` or `@ts-ignore`.
3. Motive First, Syntax Second: Always explain the engineering "WHY" in plain language before showing code.
4. Verbose Commenting & Walkthroughs: Over-explain WHAT the code is doing, HOW it works, and WHY inline, followed by a plain-English walkthrough. Preserve all existing JSDoc and inline comment headers when modifying files.
5. Explanatory Logging: Inject descriptive console.log / logTelemetry flow telemetry in both production code and tests.
6. No Code Placeholders & Small Widget Blocks: Never use "// ... rest of code". Keep each code block under ~110 lines (splitting files into numbered parts) so copy-paste widgets never break or escape. Never nest triple-backtick fences inside outer markdown fences.
7. Verification & Git Checkpoint: Stop at the end of every chunk, provide the exact local verification command (`npm run build && npm run typecheck:all && npm test`), suggest a conventional git commit message, and wait for user permission before advancing.

--- TARGET RUNTIME DELTA ---
 EXACT NEXT TASK    : Issue #5 Micro-Chunk 4 — Wire `--spatial-brief` CLI flag & `--help` output in `src/index.ts` & `tests/unit/index.test.ts`
 ENGINEERING "WHY"  :
   1. `executeCheckCommand({ spatialBrief: true })` is now ready in `src/commands/check.ts`, so `src/index.ts` needs to parse `--spatial-brief` (both for `uirig check --spatial-brief` and zero-config `uirig <target> --spatial-brief`), forward it to `executeCheckCommand`, and document it in `--help`.
   2. 1-to-1 unit specs in `tests/unit/index.test.ts` lock down flag parsing and help output regressions.
 CODE BOUNDARIES    :
   - Micro-Chunk 4: `src/index.ts` & `tests/unit/index.test.ts` (+ mark Chunk 4 `[x]` in `.uirig/docs/IMPLEMENT_ISSUE_5.md` and update `.uirig/docs/NEXT_PROMPT.md`)

--- SYSTEM BOOT TRIGGER COMMAND ---
::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO BEGIN ISSUE #5 MICRO-CHUNK 4 :::
================================================================================
