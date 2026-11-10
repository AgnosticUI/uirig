# Implementation Plan: `uirig` — Diagnostic Fuzzing Architecture

This document details the engineering blueprint, technical choices, and incremental build tasks required to implement `uirig` safely from a local system workspace.

> **Scope Indicator Guide:** Sections and tasks marked **`(MVP)`** are part of the Phase 1 release (`init`, `dev`, `paint`, `break`, `pack`, `checkout`, `session:sync`). Unmarked sections and tasks represent the full 15-tool `docs/PRD.md` vision and should be skipped during Phase 1 execution.

## Inter-Session Continuity & Context Hardening Protocol (MVP)

To preserve total engineering velocity across short, decoupled LLM sessions where memory state is completely lost, the project enforces a strict **Session Bootstrapping and Handoff Workflow**. At the conclusion of every turn or session exit, the developer and active LLM core must compile an invariant bridge payload to ensure seamless, hallucination-free initialization in the subsequent slate.

### 1. The Context-Window Bootstrapping Package (MVP)
When initializing a brand-new session context window, the developer must feed the following foundational assets concurrently to enforce strict project boundaries:
1.  **`docs/MVP.md`**: Provides the active Phase 1 7-tool MVP scope, architectural compromises, and CI/CD exit code contract.
2.  **`docs/TECHNICAL_DESIGN_DOC.md`**: Provides the exact JSON schemas (`session.json`, `default_tokens.json`), file architecture, and TypeScript interface contracts.
3.  **`docs/IMPLEMENTATION_PLAN.md`**: Provides the current task checklist (`(MVP)` vs. aspirational PRD tasks), project phase matrices, and workflow guardrails.
4.  **`.uirig/NEXT_PROMPT.md`**: A volatile, single-purpose tracking bridge document populated at the immediate end of the prior session.

### 2. The `NEXT_PROMPT.md` Generation Schema (MVP)
Every session-closing handoff pass must generate a fresh `.uirig/NEXT_PROMPT.md` mapping block containing the exact following structural text elements with zero truncation:

```text
================================================================================
          uirig : Chronological Session Continuity Bridge Capsule              
================================================================================
 TIMESTAMP BASELINE : [YYYY-MM-DDTHH:MM:SSZ] (Anchored to Nov 9, 2026 Timeline)
 ACTIVE WORKSPACE   : [Active Target File Path, e.g., package.json]
 PREVIOUS SNAPSHOT  : [Exact short summary of the absolute last micro-chunk built]
 METRIC HASH GAIN   : [Current active ledger step and latest SHA-256 state checksum]

--- TARGET RUNTIME DELTA ---
 EXACT NEXT TASK    : [Phase X Task Y / Task Title from Implementation Plan]
 ENGINEERING "WHY"  : [Plain-language explanation of the immediate logic goal]
 CODE BOUNDARIES    : [List of methods, structures, or properties to write next]
 COMPANION TESTS    : [Precise assertions required in the sibling spec file]

--- SYSTEM BOOT TRIGGER COMMAND ---
::: [Developer: Paste this line to execute the protocol initialization loop]
::: System Initialized. Awaiting command to begin Phase X Task Y on [File Path] :::
================================================================================
```

### 3. The Zero-Code Boot Protocol Execution (MVP)
Upon receiving the Context Bootstrapping Package, the new LLM session is strictly forbidden from printing, editing, or assuming any production or test code blocks. It must intercept the `NEXT_PROMPT.md` metadata, print an ASCII validation block reflecting the active milestone metrics, and immediately yield the signature trigger string to return control to the developer:

`::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO BEGIN PHASE X TASK Y :::`

## Technical Stack Bounds (MVP)
To ensure zero paid runtime dependencies, the underlying CLI execution matrix operates completely locally without remote API constraints:
*   **Runtime Environment:** Node.js 22+ LTS Stable Releases
*   **Core Compiler Engine:** Executable TypeScript 5.x ESM Engine
*   **Browser Telemetry Framework:** Playwright Core v1.64+ (Headless browser execution package)
*   **Ecosystem Monitoring Layers:** Chokidar (Watcher Engine), Native WebSocket (`ws`)
*   **Local State Data Logs:** Isolated JSON file structures (`.uirig/session.json`)
*   **Local Layout Intermediaries:** Plain-text Markdown and standard HTML/JSON structures.

---

## Implementation Checklist

### Phase 1: Specifications & Documentation Design (MVP)
- [x] Draft `docs/PRD.md` (Core System Architecture, Stage-Gate Philosophy, & 15-Tool Matrix)
- [x] Draft `docs/MVP.md` (7-Tool Scoped Phase 1 Blueprint & CI/CD Exit Contract) (MVP)
- [x] Draft `docs/TECHNICAL_DESIGN_DOC.md` (Schemas, File Tree, & TypeScript Interface Contracts) (MVP)
- [x] Draft `README.md` (Value-Driven Positioning, 5 Core Pillars, & Command Reference) (MVP)

### Phase 2: Core Workspace Engine & Manifest System (MVP)
- [ ] **Task 2.1: Project Environment Scaffolding (MVP)**
  * **Motive:** Establish the isolated workspace configuration boundaries and binary entry mapping (`bin/uirig`) required to compile clean ESM modules locally.
  * **Action:** Create a standard `package.json` file explicitly configured with `"type": "module"`, `"bin": { "uirig": "./bin/uirig" }`, and standard pipeline unit testing script directives.
- [ ] **Task 2.2: Local Dependency Acquisition (MVP)**
  * **Motive:** Install locked local development primitives completely offline to guarantee environment stability across test environments.
  * **Action:** Run local package acquisition streams via explicit save instructions to capture pin-locked versions of `typescript`, `vitest`, `vite`, `@types/node`, `playwright`, `chokidar`, and `ws`.
- [ ] **Task 2.3: Configuration Profile Matrix & Shared Interfaces (MVP)**
  * **Motive:** Enforce strict ESM compilation constraints, strict null checks, deep path mappings, and shared structural data types across modules.
  * **Action:** Generate `tsconfig.json`, `vitest.config.ts`, `config/default_tokens.json`, and `src/interfaces/` shared schema contracts (`config.ts`, `schema.ts`, `tokens.ts`, `browser.ts`).
- [ ] **Task 2.4: Workspace Initializer (`uirig init`) (MVP)**
  * **Motive:** Establish the localized filesystem sandbox boundaries and tracking directory topologies required to support session snapshot history operations.
  * **Action:** Program `src/commands/init.ts`, `src/utils/fs.ts`, and `src/utils/formatter.ts` to construct the `.uirig/`, snapshots subfolder, template canvas locations, and drop the initial base state journal tracking ledger.
- [ ] **Task 2.5: Framework Blackhole Crawler (`uirig manifest`)**
  * **Motive:** Deep-scan the developer's working directory depth-first to map layout assets while completely blocking heavy dependency blackholes from polluting context records.
  * **Action:** Code `src/core/crawler.ts` and `src/commands/manifest.ts` to perform directory crawls that block `node_modules/`, `.git/`, and `dist/` subtrees, producing an active filesystem tree graph payload.
- [ ] **Task 2.6: State Ledger Schema Validation (MVP)**
  * **Motive:** Lock down state entry verification rules to protect historical generation trees from runtime memory or stream corruption.
  * **Action:** Code baseline session schema validation and file read/write models inside `src/core/session.ts` and `src/utils/crypto.ts` to manage `.uirig/session.json`.
---

### 📐 Part 2: Phase 3 — Blueprint, Layout, Paint, Trace, Contrast, & Session State
**File Path Target:** `docs/IMPLEMENTATION_PLAN.md` (Phase 3 Detailed Checklist)  
**Execution Verification Baseline Date:** **November 9, 2026**

### Phase 3: Token Palettes, Contours, & Session Tracking (MVP)
- [ ] **Task 3.1: Visual Blueprint Generator (`uirig blueprint`)**
  * **Motive:** Allow layout engineers to synthesize raw, unstyled skeleton wireframes completely offline from dimensional matrices without requiring an active LLM network connection.
  * **Action:** Code `src/commands/blueprint.ts` to map integer row/column dimensional parameters directly into unstyled framework utility layouts.
- [ ] **Task 3.2: Structural Intent Transformer (`uirig layout`)**
  * **Motive:** Force structural document layout outline containment properties to fully lock into files before visual styling properties are evaluated.
  * **Action:** Code `src/commands/layout.ts` to translate spatial design instructions into pure grayscale CSS Flexbox and Grid containment skeletons.
- [ ] **Task 3.3: Pluggable Browser Automation Adapter Matrix (MVP)**
  * **Motive:** Abstract browser automation frameworks behind a clean, interchangeable structural type system contract to protect layout fuzzing loops from vendor lock-in.
  * **Action:** Build `PlaywrightAdapter` implementing `IHeadlessBrowserDriver` inside `src/core/adversary.ts`, creating a clean interface loop to walk DOM nodes.
- [ ] **Task 3.4: Dynamic Computed-Style Contrast Gate (`uirig contrast`)**
  * **Motive:** Evaluate typography legibility framework-blind by using `window.getComputedStyle()` inside Playwright to execute relative luminance math directly on real rendered pixels.
  * **Action:** Code `src/core/matrix.ts` and `src/commands/contrast.ts` to calculate precise luminance contrast ratios, throwing an immediate error code and exit status `1` upon falling below 4.5:1.
- [ ] **Task 3.5: JSON Design Token Palette Controller (`uirig paint`) (MVP)**
  * **Motive:** Restyle theme parameters, colors, and layout densities framework-blindly by modifying isolated JSON token configuration files instead of hacking fragile source code lines.
  * **Action:** Code `src/commands/paint.ts` and `src/core/compiler.ts` to handle pure JSON dictionary updates on disk. Integrate a complete `--shuffle` alternative explorer utilizing mathematical contrast filters to map compliant color variants down harmony mappings.
- [ ] **Task 3.6: Spatial Layout Console Wireframer (`uirig` trace)**
  * **Motive:** Provide lightning-fast terminal-based ASCII wireframe traces to let developers visually monitor spatial flow mapping parameters without booting visual inspectors.
  * **Action:** Implement `src/commands/trace.ts` to parse computed layout bounding parameters into text-based alphanumeric structural map diagrams output to stdout.
- [ ] **Task 3.7: State Invariant Reconciliation Protocol (`uirig session:sync`) (MVP)**
  * **Motive:** Protect manual IDE source code changes from accidental automated pipeline overwrites by allowing developers to explicitly synchronize file system updates into the tracking ledger history.
  * **Action:** Complete the SIRP checksum verification logic inside `src/core/session.ts` and build `src/commands/session-sync.ts` to recalculate SHA-256 byte-hashes and commit active changes to `.uirig/session.json`.
- [ ] **Task 3.8: Time-Travel Chronological Checkpoint Engine (`uirig checkout`) (MVP)**
  * **Motive:** Allow instant workspace rollbacks or roll-forwards across the chronological state log ledger to recover from layout corruption errors effortlessly.
  * **Action:** Implement `src/commands/checkout.ts` to pull cached snap artifacts from `.uirig/snapshots/` and overwrite active workspace files on command.
  ### Phase 4: Dev Orchestration & Adversarial Fuzzing Rigs (MVP)
- [ ] **Task 4.1: Local Tracking Expansion Fuzzer (`uirig break`) (MVP)**
  * **Motive:** Test interface durability against real-world user data extensions, non-breaking character inputs, and malicious code scripts by running automated fuzz stressors inside a serverless browser thread.
  * **Action:** Code `src/commands/break.ts` (supporting `break`, `breakit`, `uibreakit` aliases) to launch isolated Playwright sessions and flood text blocks with +30% longer character content.
- [ ] **Task 4.2: Agnostic Geometric Bounding Telemetry Monitor (MVP)**
  * **Motive:** Trap element box clipping and layout overflow failures framework-blindly by querying native browser Web APIs.
  * **Action:** Program coordinate collision metrics inside `src/core/adversary.ts` utilizing native browser `getBoundingClientRect()` loops. If a child box leaks outside parent grid containment parameters, catch the error and map it to the corresponding `data-uirig-id`.
- [ ] **Task 4.3: Alphanumeric Diagnostic Report Generator (MVP)**
  * **Motive:** Emit highly readable, actionable stdout logs when fuzz parameters collapse layouts, returning a strict POSIX exit code `2` so CI/CD quality gates block the PR automatically.
  * **Action:** Code `src/utils/formatter.ts` and `src/core/adversary.ts` to format structured plaintext remediation tables showing the failing metadata ID, leak dimensions, and required tactical CSS remediation.
- [ ] **Task 4.4: Grid Margin Strain Fuzzer (`uirig bleed`)**
  * **Motive:** Map out the exact visual tolerance limits where structural containers shatter by injecting incremental padding expansions into parent elements inside Playwright.
  * **Action:** Implement `src/commands/bleed.ts` to drive incremental padding stress loops over configured step intervals, tracking container alignment shifts.
- [ ] **Task 4.5: Sub-Element Injection Row Auditor (`uirig flex`)**
  * **Motive:** Verify that responsive grid rows handle dynamic database data updating cycles gracefully without box overlapping collisions or line-break overflows.
  * **Action:** Build `src/commands/flex.ts` to audit flex wrapping layout rules by dynamically generating and injection varying sub-element array sizes into the active browser window.
- [ ] **Task 4.6: Continuous Hot-Reloading Monitor (MVP)**
  * **Motive:** Drive an instantaneous, sub-150ms local developer preview loop that tracks filesystem mutations and visual token updates in real time.
  * **Action:** Code `src/core/orchestrator.ts` and `src/commands/dev.ts` using `chokidar` watchers paired with local WebSocket child processes to hot-reload rendering channels automatically.

### Phase 5: Handoff Compilations & Release Setup (MVP)
- [ ] **Task 5.1: Lexical Text Context Packer (`uirig pack`) (MVP)**
  * **Motive:** Prune conversation fluff, trailing spaces, and layout formatting comments to compress text payloads, lowering token window usage parameters by up to 75% for clipboard injection blocks.
  * **Action:** Program `src/commands/pack.ts` to execute token-preserving content compression, emitting optimized layout strings directly to stdout.
- [ ] **Task 5.2: Portable Context Capsule (`uirig handoff`)**
  * **Motive:** Compile repository blueprints, token sets, and session logs into a single, cohesive transfer capsule block optimized for browser copy-paste workflows across any AI tier.
  * **Action:** Implement `src/commands/handoff.ts` to assemble active design parameters into the permanent text artifact `.uirig/copy_paste_pack.md`.
- [ ] **Task 5.3: Baseline Integration & Testing Manifest (MVP)**
  * **Motive:** Enforce tool reliability and pipeline safety across all 15 commands through isolated, zero-dependency unit and end-to-end testing validation frameworks.
  * **Action:** Write comprehensive Vitest verification files (`tests/unit/matrix.test.ts`, `locator.test.ts`, `adversary.test.ts`) and end-to-end lifecycle passes (`tests/integration/workflow.test.ts`).
- [ ] **Task 5.4: CLI Executable Global Package Distribution (MVP)**
  * **Motive:** Mount the global CLI executable wrapper script to allow instant local linking (`npm link`) and frictionless package manager distribution.
  * **Action:** Implement `src/index.ts` and `bin/uirig` (`chmod +x`), ensuring command flags map securely to domain modules.

---

## Session State Machine Constraints (MVP)

Every functional step modifies state inside `.uirig/session.json`. The programmatic loop must verify historical checksums before modifying downstream assets:

```text
 [Stage-Gate Loop]
 Check existing .uirig/session.json  ==> Run SIRP Checksum Validation  ==> Execute Next Pipeline Stage
```

If a contrast check fails or an out-of-band edit is detected, execution halts immediately with POSIX exit code `1` (or `2` on layout overflow) without corrupting previous verified snapshots.
