================================================================================
          uirig : Chronological Session Continuity Bridge Capsule              
================================================================================
 TIMESTAMP BASELINE : 2026-11-16T21:23:00-06:00 (Anchored to Nov 16, 2026 Timeline)
 ACTIVE WORKSPACE   : Post-MVP Roadmap — Issue #5 ("No-Vision Required" Semantic Spatial Brief `--spatial-brief`)
 PLAN DOCUMENT      : .uirig/docs/IMPLEMENT_ISSUE_5.md
 STRATEGIC PIVOT    :
   - Positioning: "The first line of defense for AI-generated UIs and Web Components"
     (a fast, zero-config guardrail before heavier axe-core or Lighthouse audits run).
   - 6-Engine Core Suite: `tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom`
     (plus uncaught runtime JS error capture in `src/commands/check.ts`).
   - Zero-Config Entry: `npx uirig <url-or-file>` runs immediately with sensible
     defaults and auto-serves local `.html` files over ephemeral `127.0.0.1` HTTP.
 COMPLETED PHASES   :
   - Phases 1–7 (100% Complete & Passing):
       * Core Engines: `src/core/tokens.ts`, `src/core/matrix.ts`, `src/core/dark-mode.ts`,
         `src/core/adversary.ts`, `src/core/cls.ts`, `src/core/dom.ts`
       * Shared Utilities: `src/utils/dom-walker.ts` (Shadow-piercing walker), `src/utils/ignore.ts`,
         `src/utils/formatter.ts` (`logTelemetry` to `stderr` in `--json` mode),
         `src/utils/agent-stream.ts` (JSON stream generator), `src/utils/fs.ts` (PR comment reporter),
         `src/utils/static-server.ts`
       * CLI & Commands: `src/index.ts`, `src/commands/check.ts`, `src/commands/init.ts`, `bin/uirig`
       * Unit Tests: 1-to-1 specs under `tests/unit/*.test.ts`
 ROADMAP DELTAS     :
   - Active Feature (Issue #5): `--spatial-brief` flag + `spatialBrief` in `--json` output
     (ultra-compact bounding-box summary `header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836]`
     in ~40–60 plain-text tokens instead of 1,500–3,000+ vision tokens).
   - Remaining Roadmap Issues (#1–#4, #6–#12): Tracked on GitHub via `scripts/create-issues.sh`.

--- MANDATORY WORKFLOW & MENTOR RULES (ENFORCE STRICTLY) ---
1. Pacing & Scope: Plan before coding. Break tasks into small, cohesive micro-chunks across separate turns. Never build an entire feature or multiple unrelated files at once.
2. Co-Develop Behavior & 1-to-1 Specs: Every implementation file must have a corresponding test file covering happy paths, edge cases, and expected errors without `any` or `@ts-ignore`.
3. Motive First, Syntax Second: Always explain the engineering "WHY" in plain language before showing code.
4. Verbose Commenting & Walkthroughs: Over-explain WHAT the code is doing, HOW it works, and WHY inline, followed by a plain-English walkthrough. Preserve all existing JSDoc and inline comment headers when modifying files.
5. Explanatory Logging: Inject descriptive console.log / logTelemetry flow telemetry in both production code and tests.
6. No Code Placeholders & Small Widget Blocks: Never use "// ... rest of code". Keep each code block under ~110 lines (splitting files into numbered parts) so copy-paste widgets never break or escape. Never nest triple-backtick fences inside outer markdown fences.
7. Verification & Git Checkpoint: Stop at the end of every chunk, provide the exact local verification command (`npm run build && npm run typecheck:all && npm test`), suggest a conventional git commit message, and wait for user permission before advancing.

--- TARGET RUNTIME DELTA ---
 EXACT NEXT TASK    : Issue #5 Micro-Chunk 1 — Pure Spatial Brief Types & Formatter (`src/utils/spatial-brief.ts` & `tests/unit/spatial-brief.test.ts`)
 ENGINEERING "WHY"  :
   1. Isolating `SpatialNode` types and `formatSpatialBrief()` into a pure utility module first lets us lock down integer rounding, zero-rect filtering, duplicate landmark deduplication, `y -> x` reading-order sorting, and token-budget capping before touching Playwright/CDP evaluation or CLI flags.
   2. Aligns cleanly with `uirig`'s `src/utils/*` + `tests/unit/*.test.ts` 1-to-1 module layout.
 CODE BOUNDARIES    :
   - Micro-Chunk 1: `src/utils/spatial-brief.ts` (pure types + `formatSpatialBrief`) & `tests/unit/spatial-brief.test.ts`
   - Micro-Chunk 2: Browser-context Shadow-piercing landmark & selector collector in `src/utils/spatial-brief.ts` (reusing `src/utils/dom-walker.ts` conventions) + unit tests in `tests/unit/spatial-brief.test.ts`
   - Micro-Chunk 3: Wire `spatialBrief?: boolean` into `src/commands/check.ts`, `src/utils/agent-stream.ts`, and `src/utils/fs.ts` + tests in `tests/unit/check.test.ts` & `tests/unit/agent-stream.test.ts`
   - Micro-Chunk 4: Wire `--spatial-brief` CLI flag & subcommand `--help` in `src/index.ts` + tests in `tests/unit/index.test.ts`
   - Micro-Chunk 5: Update `README.md`, `AGENTS.md`, and `.uirig/docs/NEXT_PROMPT.md`

--- SYSTEM BOOT TRIGGER COMMAND ---
::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO BEGIN ISSUE #5 MICRO-CHUNK 1 :::
================================================================================
