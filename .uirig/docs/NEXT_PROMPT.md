================================================================================
          uirig : Chronological Session Continuity Bridge Capsule              
================================================================================
 TIMESTAMP BASELINE : 2026-11-11T18:38:00Z (Anchored to Nov 11, 2026 Timeline)
 HEAD COMMIT        : ac135bcf5b7a66eb755f65ad73c467d6fa8b660d (HEAD -> main)
 ACTIVE WORKSPACE   : Phase 4 Task 4.1 / playground/ & src/core/crawler.ts
 COMPLETED PHASES   :
   - Phase 1: Specifications & Documentation Design (MVP + Agentic Harness positioning)
   - Phase 2: Workspace Environment Scaffolding, Init, Crawler, & Session Ledger
   - Phase 3 (100% Complete & Passing):
       * Task 3.1: src/core/tokens.ts (Shadow-piercing crawler + pure token validator)
       * Task 3.2: src/core/matrix.ts (colorjs.io WCAG 2.1 contrast + Porter-Duff alpha compositing + ShadowRoot.host ancestor walker)
       * Task 3.3: src/core/adversary.ts (+30% pseudo-localization text-expansion fuzzer + Euclidean box/scrollbar/touch-target rig)
       * Task 3.4: src/core/cls.ts (W3C 1s/5s session-window CLS scorer + pre-navigation PerformanceObserver collector)
 ROADMAP DELTAS     :
   - Phase 4: Local Spot Checking Test Bed (Vite + Lit + local agnosticui-cli components + #theme-toggle data-theme="dark")
   - Phase 5: CI/CD Orchestration & Reporting (check.ts parallel contexts, github_pr_comment.md, --json stream, .uirig/SKILL.md in init.ts, AGENTS.md recipe)

--- MANDATORY WORKFLOW & MENTOR RULES (ENFORCE STRICTLY) ---
1. Slow Down & Work Iteratively: Break tasks into the smallest logical increments possible across separate exchanges. Never build an entire feature or file at once.
2. Co-Develop Behavior & Executable Specs: Whenever introducing an operational routine, logic fork, or behavioral chunk, immediately write its companion test spec in the same response (except pure boilerplate/types/fixtures).
3. Prerequisite & Environment Setup First: Always outline directory structure, prerequisites, and exact terminal commands before writing code.
4. Motive First, Syntax Second: Always explain the engineering "WHY" in plain language before showing code.
5. Pedantic, Heavy Commenting: Err heavily on over-explaining WHAT the code is doing and WHY inline.
6. Explanatory Logging: Inject descriptive console.log flow telemetry in both production code and tests.
7. No Code Placeholders: Never use "// ... rest of code". Split large files into numbered parts if needed to avoid markdown escaping glitches.
8. Await User Signal: End every response with a 1-sentence summary and explicitly ask for permission before generating the next chunk.

--- TARGET RUNTIME DELTA ---
 EXACT NEXT TASK    : Phase 4 Task 4.1 (Micro-Chunk 2) — Isolate `playground/` in Crawler & Configure Lit TypeScript Settings
 ENGINEERING "WHY"  :
   1. Add `'playground'` to `BLOCKLIST_DIRECTORIES` in `src/core/crawler.ts` (and verify in `tests/unit/crawler.test.ts`) so `uirig`'s repository scanner ignores the isolated Vite test bed.
   2. Configure `playground/tsconfig.json` with `"experimentalDecorators": true` and `"useDefineForClassFields": false` as required by AgnosticUI's Lit Web Components.
   3. Then advance to Task 4.2: install AgnosticUI locally in `playground/` (`npx agnosticui-cli init --framework lit`, `npx agnosticui-cli add button card input`) and wire the mandatory `#theme-toggle` button toggling `data-theme="dark"` on `document.documentElement`.
 CODE BOUNDARIES    :
   - src/core/crawler.ts & tests/unit/crawler.test.ts
   - playground/tsconfig.json

--- SYSTEM BOOT TRIGGER COMMAND ---
::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO BEGIN PHASE 4 TASK 4.1 MICRO-CHUNK 2 :::
================================================================================
