================================================================================
          uirig : Chronological Session Continuity Bridge Capsule              
================================================================================
 TIMESTAMP BASELINE : 2026-11-18T06:59:00-06:00 (Anchored to Nov 18, 2026 Timeline)
 REPOSITORY         : AgnosticUI/uirig
 ACTIVE BRANCH      : feat/issue-17-slot-integrity
 ACTIVE WORKSPACE   : Post-MVP Roadmap — Issue #17 (Web Component `<slot>` & Content-Model Integrity)
 PLAN DOCUMENT      : .uirig/docs/IMPLEMENT_ISSUE_17.md (Chunk 0 Planned; Chunk 1 Next)
 GITHUB ROADMAP MAP (AgnosticUI/uirig) :
   - #8  : Native MCP (Model Context Protocol) Server Mode (`uirig mcp`) [pillar: agent-workflow]
   - #9  : Framework Source-Map & `file:line` Attribution [pillar: agent-workflow]
   - #10 : Zero-Config Design Token Auto-Discovery (`--auto-tokens`) [pillar: agent-workflow]
   - #11 : [x] Root-Cause Grouping & Cascading Deduplication (`--group-by-root`) [pillar: token-efficiency]
   - #12 : [x] "No-Vision Required" Semantic Spatial Brief (`--spatial-brief`) [pillar: token-efficiency]
   - #13 : Deterministic Auto-Fix Patch Generation (`--fix` / `jsonPatch`) [pillar: token-efficiency]
   - #14 : Incremental Git-Diff Component Scoping (`--changed`) [pillar: token-efficiency]
   - #15 : [x] Token-Budgeted & Priority-Ranked Output (`--top` / `--max-tokens`) [pillar: token-efficiency]
   - #16 : Interactive State & Click-Occlusion Math (`states` / `stress`) [pillar: blind-spots]
   - #17 : [IN PROGRESS] Web Component `<slot>` & Content-Model Integrity (`dom`) [pillar: blind-spots]
   - #18 : Responsive Breakpoint Sweep (`--sweep`) [pillar: blind-spots]
   - #19 : Computed Accessibility Tree Snapshot (`dom` / `contrast`) [pillar: blind-spots]

--- MANDATORY WORKFLOW & MENTOR RULES (ENFORCE STRICTLY) ---
1. Pacing & Scope: Plan before coding. Break tasks into small, cohesive micro-chunks across separate turns. Never build an entire feature or multiple unrelated files at once.
2. Co-Develop Behavior & 1-to-1 Specs: Every implementation file must have a corresponding test file covering happy paths, edge cases, and expected errors without `any` or `@ts-ignore`.
3. Plain, Straightforward Naming & Comments: Always use clear, everyday descriptive names and plain-English comments/explanations—avoid academic buzzwords or opaque jargon.
4. Motive First, Syntax Second: Always explain the engineering "WHY" in plain language before showing code.
5. Complete Copy-Pasteable Files Only (No Partial Snippets): Every time a file is created or modified, output the ENTIRE file from line 1 to EOF with all changes fully integrated (split into sequentially numbered parts under ~110 lines each if the file exceeds 110 lines). Never output isolated diff hunks, partial snippets, or "// ... rest of code" placeholders that require manual splicing. Never nest triple-backtick fences inside outer markdown fences, and use `Array<T>` / `new Array<T>()` so brackets are never stripped.
6. Explanatory Logging: Inject descriptive console.log / logTelemetry flow telemetry in both production code and tests.
7. Verification & Git Checkpoint: Stop at the end of every chunk, provide `npm run build && npm run typecheck:all && npm test`, suggest a conventional commit message on the active topic branch, and wait for user permission before advancing.

--- TARGET RUNTIME DELTA ---
 EXACT NEXT TASK    : Issue #17 Micro-Chunk 1 — Add `'orphaned_slot_content'` to `src/interfaces/locator.ts`, implement Web Component `<slot>` integrity checks in `src/core/dom.ts`, and add 1-to-1 unit tests in `tests/unit/dom.test.ts` (delivering all 3 files in full from line 1 to EOF).
 ENGINEERING "WHY"  :
   1. AI agents frequently hallucinate `slot="..."` names on light-DOM children of Web Components, causing the browser to silently drop those children from rendering with zero console errors.
   2. Inspecting open `ShadowRoot` `<slot>` definitions inside `src/core/dom.ts` catches orphaned children immediately and tells the agent the exact valid slot names.
 CODE BOUNDARIES    :
   - Micro-Chunk 1: `src/interfaces/locator.ts`, `src/core/dom.ts`, `tests/unit/dom.test.ts` (+ mark Chunk 1 `[x]` in `.uirig/docs/IMPLEMENT_ISSUE_17.md` and update `.uirig/docs/NEXT_PROMPT.md`)

--- SYSTEM BOOT TRIGGER COMMAND ---
::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO BEGIN ISSUE #17 MICRO-CHUNK 1 :::
================================================================================
