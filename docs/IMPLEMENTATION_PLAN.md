# Implementation Plan: `uirig`

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
*   **AST & Parser Layers:** `@oxc-project/parser`, `chokidar` (watcher), `ws` (WebSockets) *(Post-MVP: `posthtml`)*
*   **Testing Harness Framework:** Vitest integrated natively into a Vite processing configuration, paired with Playwright headless execution packages
*   **Local State Data:** Isolated JSON file structures (`.uirig/session.json`)
*   **Local Layout Intermediaries:** Plain-text Markdown and raw static HTML/JSX structures.
---

## Implementation Checklist

### Phase 1: Specifications & Documentation Design (MVP)
- [x] Draft `docs/PRD.md` (Core System Architecture, Stage-Gate Philosophy, & 15-Tool Matrix)
- [x] Draft `docs/MVP.md` (7-Tool Scoped Phase 1 Blueprint & CI/CD Exit Contract) (MVP)
- [x] Draft `docs/TECHNICAL_DESIGN_DOC.md` (Schemas, File Tree, & TypeScript Interface Contracts) (MVP)
- [x] Draft `README.md` (Value-Driven Positioning, 5 Core Pillars, & Command Reference) (MVP)

### Phase 2: Core Workspace Engine & Manifest System (MVP)
- [ ] **Task 2.1: Project Environment Scaffolding (MVP)**
  * **Motive:** Establish the isolated workspace configuration boundaries and binary entry mapping (`bin/uirig`) required to compile ESM modules.
  * **Action:** Create `package.json` with `"type": "module"`, `"bin": { "uirig": "./bin/uirig" }`, and core scripts.
- [ ] **Task 2.2: Local Dependency Acquisition (MVP)**
  * **Motive:** Install the offline toolchain primitives (native Rust-bound Oxc, Playwright headless browsers, chokidar, and WebSocket systems).
  * **Action:** Install pin-locked versions (`typescript`, `vitest`, `vite`, `@types/node`, `playwright`, `oxc-parser`, `chokidar`, `ws`).
- [ ] **Task 2.3: Configuration Profile Matrix & Shared Interfaces (MVP)**
  * **Motive:** Enforce strict ESM compilation constraints, path mappings, testing isolation rules, and shared TypeScript contracts.
  * **Action:** Generate `tsconfig.json`, `vitest.config.ts`, `config/default_tokens.json`, and `src/interfaces/` (`browser.ts`, `config.ts`, `schema.ts`, `tokens.ts`).
- [ ] **Task 2.4: Workspace Initializer (`uirig init`) (MVP)**
  * **Motive:** Establish the localized filesystem sandbox boundaries and tracking directory topologies.
  * **Action:** Program `src/commands/init.ts`, `src/utils/fs.ts`, and `src/utils/formatter.ts` to scaffold `.uirig/`, `.uirig/snapshots/`, `.uirig/session.json`, and `config/templates/react_canvas.html`.
- [ ] **Task 2.5: Framework Blackhole Crawler (`uirig manifest`)**
  * **Motive:** Deep-scan the developer's working directory to map structural context assets while filtering out environment overhead.
  * **Action:** Code `src/core/crawler.ts` and `src/commands/manifest.ts` to filter out `node_modules/`, `.git/`, and build paths depth-first.
- [ ] **Task 2.6: State Ledger Schema Validation (MVP)**
  * **Motive:** Lock down state entry parameters to protect historical generation trees from runtime corruption.
  * **Action:** Code the baseline session mapping and tracking models inside `src/core/session.ts` and `src/utils/crypto.ts` to read/write `.uirig/session.json`.

### Phase 3: Token Injection & Mutation Utilities (MVP)
- [ ] **Task 3.1: Visual Blueprint Generator (`uirig blueprint`)**
  * **Motive:** Allow layout engineers to synthesize raw, unstyled grid matrices offline without cloud API budgets.
  * **Action:** Code `src/commands/blueprint.ts` to map cell arrays directly into static framework grids.
- [ ] **Task 3.2: Structural Intent Transformer (`uirig layout`)**
  * **Motive:** Isolate structural document containment rules completely from downstream visual style properties.
  * **Action:** Code `src/commands/layout.ts` to translate structural layout strings into pure grayscale CSS Flexbox and Grid frames.
- [ ] **Task 3.3: Oxc ESTree Abstract Syntax Tree Compiler Core (MVP)**
  * **Motive:** Prevent string manipulation and regex substitution bugs from corrupting JSX logic during token mapping loops.
  * **Action:** Code `src/core/compiler.ts` to parse React/JSX markup via `oxc-parser` and emit both styled `.tsx` components and static `.html` snapshots (`02_painted.html`). *(Post-MVP: add PostHTML engine support.)*
- [ ] **Task 3.4: Framework Token Transformation Adapter (`jsx.ts`) (MVP)**
  * **Motive:** Decouple React `className` attribute mutations from core token lookup logic.
  * **Action:** Code `src/core/adapters/jsx.ts` implementing `IFrameworkAdapter`. *(Post-MVP: add `src/core/adapters/html.ts`.)*
- [ ] **Task 3.5: Contrast Matrix & Relative Luminance Core (MVP)**
  * **Motive:** Automate WCAG 2.1 AA (4.5:1) accessibility checks at compile time using exact relative luminance equations.
  * **Action:** Build `src/core/matrix.ts` to validate color pairings and generate compliant harmony pairs on `--shuffle`.
- [ ] **Task 3.6: Palette Harmony Auditor (`uirig contrast`)**
  * **Motive:** Provide a standalone verification command to audit static files and exit with POSIX code `1` upon WCAG ratio failures.
  * **Action:** Build `src/commands/contrast.ts` wrapping `src/core/matrix.ts`.
- [ ] **Task 3.7: Token Mixer Pipeline & Alternative Shuffle (`uirig paint`) (MVP)**
  * **Motive:** Fuse unstyled wireframe layouts with design token dictionaries safely while enforcing WCAG 4.5:1 contrast gates.
  * **Action:** Code `src/commands/paint.ts` integrating SIRP checksum checks, `matrix.ts`, and `compiler.ts`.
- [ ] **Task 3.8: Spatial Layout Console Wireframer (`uirig trace`)**
  * **Motive:** Provide text-based debugging grids to visualize element nesting directly in standard terminals.
  * **Action:** Implement `src/commands/trace.ts` to parse structural display parameters into a console ASCII map diagram.
- [ ] **Task 3.9: State Invariant Reconciliation Protocol (`uirig session:sync`) (MVP)**
  * **Motive:** Protect manual IDE edits from accidental pipeline overwrites via SHA-256 byte-hash verification.
  * **Action:** Complete SIRP drift detection in `src/core/session.ts` and implement `src/commands/session-sync.ts`.
- [ ] **Task 3.10: Time-Travel Chronological Checkpoint Engine (`uirig checkout`) (MVP)**
  * **Motive:** Allow instant rollbacks to any verified historical snapshot step recorded in `.uirig/session.json`.
  * **Action:** Implement `src/commands/checkout.ts` to restore cached snapshot artifacts safely.

### Phase 4: Dev Orchestration & Quality Assurance Rigs (MVP)
- [ ] **Task 4.1: Continuous Hot-Reloading Monitor (MVP)**
  * **Motive:** Drive a local preview loop tracking filesystem mutations and visual token updates in real time.
  * **Action:** Code `src/core/orchestrator.ts` using `chokidar` file watchers paired with local `ws` WebSocket connections.
- [ ] **Task 4.2: Development Workspace Orchestration (`uirig dev`) (MVP)**
  * **Motive:** Manage continuous automated background compilation and live canvas updates.
  * **Action:** Program `src/commands/dev.ts` to boot the local watcher and WebSocket server.
- [ ] **Task 4.3: Headless Sandbox Intercept Scaffold (MVP)**
  * **Motive:** Set up an isolated serverless browser validation layer behind `IHeadlessBrowserDriver`.
  * **Action:** Implement `PlaywrightAdapter` and headless initialization logic inside `src/core/adversary.ts`.
- [ ] **Task 4.4: Local Tracking Expansion Stressor (`uirig break`) (MVP)**
  * **Motive:** Adversarially stress container properties by testing +30% character growth and 200% zoom reflows, returning POSIX exit code `2` on layout failure.
  * **Action:** Code `src/commands/break.ts` (supporting `break`, `breakit`, `uibreakit` aliases).
- [ ] **Task 4.5: Geometric Bounding & Reflow Monitor (MVP)**
  * **Motive:** Catch clipping and overflow failures inside the layout sandbox using native `getBoundingClientRect()` telemetry.
  * **Action:** Implement parent-child bounding collision detection inside `src/core/adversary.ts`.
- [ ] **Task 4.6: Automated Component Healing Synthesizer (MVP)**
  * **Motive:** Dynamically patch broken responsive layouts when `--fix` is flagged.
  * **Action:** Code `src/core/healer.ts` to inject defensive utility classes (`flex-wrap`, `break-all`, `min-w-0`).
- [ ] **Task 4.7: Grid Margin Strain Fuzzer (`uirig bleed`)**
  * **Motive:** Map the exact limits where structural containers shatter by testing incremental padding expansions.
  * **Action:** Implement `src/commands/bleed.ts` to track canvas padding stress tolerances over step intervals.
- [ ] **Task 4.8: Sub-Element Injection Row Auditor (`uirig flex`)**
  * **Motive:** Verify that responsive grids handle dynamic layout updates gracefully without box overlapping collisions.
  * **Action:** Build `src/commands/flex.ts` to audit flex wrapping behaviors under fluid node populations.

### Phase 5: Handoff Compilations & Release Setup (MVP)
- [ ] **Task 5.1: Lexical Text Context Packer (`uirig pack`) (MVP)**
  * **Motive:** Strip structural layout templates of whitespace and comment bulk to cut prompt token bloat by up to 75%.
  * **Action:** Program `src/commands/pack.ts` to emit compressed component strings to stdout or file.
- [ ] **Task 5.2: Portable Context Capsule (`uirig handoff`)**
  * **Motive:** Compile repository blueprints, token sets, and ledger steps into `.uirig/copy_paste_pack.md`.
  * **Action:** Implement `src/commands/handoff.ts`.
- [ ] **Task 5.3: Baseline Integration & Testing Manifest (MVP)**
  * **Motive:** Enforce tool stability via isolated unit and end-to-end Vitest suites.
  * **Action:** Write unit tests (`tests/unit/matrix.test.ts`, `compiler.test.ts`, `adversary.test.ts`) and integration tests (`tests/integration/workflow.test.ts`).
- [ ] **Task 5.4: CLI Executable Global Package Distribution (MVP)**
  * **Motive:** Wire the CLI router and executable entrypoint for local linking and npm distribution.
  * **Action:** Implement `src/index.ts` and `bin/uirig` (`chmod +x`), and verify `npm link` end-to-end.

---

## Session State Machine Constraints (MVP)

Every functional step modifies state inside `.uirig/session.json`. The programmatic loop must verify historical checksums before modifying downstream assets:

```text
 [Stage-Gate Loop]
 Check existing .uirig/session.json  ==> Run SIRP Checksum Validation  ==> Execute Next Pipeline Stage
```

If a contrast check fails or an out-of-band edit is detected, execution halts immediately with POSIX exit code `1` (or `2` on layout overflow) without corrupting previous verified snapshots.
