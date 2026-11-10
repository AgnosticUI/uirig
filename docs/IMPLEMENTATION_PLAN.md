# Implementation Plan: `uirig`

This document details the engineering blueprint, technical choices, and incremental build tasks required to implement `uirig` safely from a local system workspace.

## Inter-Session Continuity & Context Hardening Protocol

To preserve total engineering velocity across short, decoupled LLM sessions where memory state is completely lost, the project enforces a strict **Session Bootstrapping and Handoff Workflow**. At the conclusion of every turn or session exit, the developer and active LLM core must compile an invariant bridge payload to ensure seamless, hallucination-free initialization in the subsequent slate.

### 1. The Context-Window Bootstrapping Package
When initializing a brand-new session context window, the developer must feed the following foundational assets concurrently to enforce strict project boundaries:
1.  **`docs/PRD.md`**: Provides the structural product architecture, 14-tool matrix scope, and non-emoji terminal anchor specifications.
2.  **`docs/TECHNICAL_DESIGN_DOC.md`**: Provides the absolute database schemas (`session.json`, `default_tokens.json`), data model topologies, and programmatic interface contracts.
3.  **`docs/IMPLEMENTATION_PLAN.md`**: Provides the current task checklist, project phase matrices, and foundational workflow guardrails.
4.  **`.uirig/NEXT_PROMPT.md`**: A volatile, single-purpose tracking bridge document populated at the immediate end of the prior session.

### 2. The `NEXT_PROMPT.md` Generation Schema
Every session-closing handoff pass must generate a fresh `.uirig/NEXT_PROMPT.md` mapping block containing the exact following structural text elements with zero truncation:

```text
================================================================================
          uirig : Chronological Session Continuity Bridge Capsule              
================================================================================
 TIMESTAMP BASELINE : [YYYY-MM-DD THH:MM:SSZ] (Anchored to Nov 9, 2026 Timeline)
 ACTIVE WORKSPACE   : [Active Target File Target Path, e.g., src/core/crawler.ts]
 PREVIOUS SNAPSHOT  : [Exact short summary of the absolute last micro-chunk built]
 METRIC HASH GAIN   : [Current active ledger step and latest SHA-256 state checksum]

--- TARGET RUNTIME DELTA ---
 EXACT NEXT TASK    : [Phase X Step Y / Task Title from Implementation Plan]
 ENGINEERING "WHY"  : [Plain-language explanation of the immediate logic goal]
 CODE BOUNDARIES    : [List of methods, structures, or properties to write next]
 COMPANION TESTS    : [Precise assertions required in the sibling spec file]

--- SYSTEM BOOT TRIGGER COMMAND ---
::: [Developer: Paste this line to execute the protocol initialization loop]
::: System Initialized. Awaiting command to begin Phase X Step Y on [File Path] :::
================================================================================
```

### 3. The Zero-Code Boot Protocol Execution
Upon receiving the Context Bootstrapping Package, the new LLM session is strictly forbidden from printing, editing, or assuming any production or test code blocks. It must intercept the `NEXT_PROMPT.md` metadata, print an ASCII validation block reflecting the active milestone metrics, and immediately yield the signature trigger string to return control to the developer:

`::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO BEGIN PHASE X STEP Y :::`

## Technical Stack Bounds
To ensure **The Free-Tier Alchemist** execution property is strictly honored, the underlying CLI execution matrix must operate completely independently of paid cloud runtimes or network API constraints during base development:
*   **Runtime Environment:** Node.js 22+ LTS Stable Releases
*   **Core Compiler Engine:** Executable TypeScript 5.x ESM Engine
*   **AST & Parser Layers:** `oxc-parser`, `posthtml`, `chokidar` (watcher)
*   **Testing Harness Framework:** Vitest integrated natively into a Vite processing configuration, paired with Playwright v1.64+ headless execution packages
*   **Local State Data:** Isolated JSON file structures (`.uirig/session.json`)
*   **Local Layout Intermediaries:** Plain-text Markdown (`.uirig/copy_paste_pack.md`) and raw static HTML/JSX structures.

---

## Implementation Checklist

### Phase 1: Specifications & Documentation Design
- [x] Draft `docs/PRD.md` (Core System Architecture, Philosophy, & Specifications Matrix)
- [x] Draft `docs/TECHNICAL_DESIGN_DOC.md` (Comprehensive Schema Models & 14-Tool Subsystems Matrix)
- [x] Draft the GitHub 100k Stars `README.md` (High-Conversion Marketing & Architectural Core)

### Phase 2: Core Workspace Engine & Manifest System
- [ ] **Task 2.1: Project Environment Scaffolding**
  * **Motive:** Establish the primitive, isolated workspace configuration boundaries required to compile our ESM modules without remote environment tracking side-effects.
  * **Action:** Initialize system context parameters via `npm init -y` and build a static `package.json` layout.
- [ ] **Task 2.2: Local Dependency Acquisition**
  * **Motive:** Secure the offline toolchain primitives (PostHTML, native Rust-bound Oxc, Playwright headless browsers, and WebSocket systems) ensuring zero hidden network runtime lookups.
  * **Action:** Install pin-locked versions (`typescript`, `vitest`, `vite`, `ts-node`, `@types/node`, `playwright`, `posthtml`, `oxc-parser`, `chokidar`, `ws`).
- [ ] **Task 2.3: Configuration Profile Matrix**
  * **Motive:** Enforce strict ESM compilation constraints, path mappings, and testing isolation rules.
  * **Action:** Generate complete definitions for `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`.
- [ ] **Task 2.4: Workspace Initializer (`uirig init`)**
  * **Motive:** Establish the localized filesystem sandbox boundaries and tracking directory topologies.
  * **Action:** Program `src/commands/init.ts` to scaffold `.uirig/`, `.uirig/snapshots/`, and local server baseline layouts (`react_canvas.html`).
- [ ] **Task 2.5: Framework Blackhole Crawler (`uirig manifest`)**
  * **Motive:** Deep-scan the developer's working directory to map out structural context assets while explicitly filtering out environment overhead.
  * **Action:** Code `src/core/crawler.ts` and `src/commands/manifest.ts` to filter out `node_modules/`, `.git/`, and build paths depth-first.
- [ ] **Task 2.6: State Ledger Schema Validation**
  * **Motive:** Lock down state entry parameters to protect historical generation trees from runtime corruption.
  * **Action:** Code the baseline session mapping and tracking models inside `src/core/session.ts` to read/write `.uirig/session.json`.

### Phase 3: Token Injection & Mutation Utilities (Local Engine)
- [ ] **Task 3.1: Visual Blueprint Generator (`uirig blueprint`)**
  * **Motive:** Allow high-discipline layout engineers to instantly synthesize raw, unstyled grid matrices without consuming cloud API budgets.
  * **Action:** Code `src/commands/blueprint.ts` to map cell arrays directly into static framework grids.
- [ ] **Task 3.2: Structural Intent Transformer (`uirig layout`)**
  * **Motive:** Isolate structural document containment rules completely from downstream visual style properties.
  * **Action:** Code `src/commands/layout.ts` to translate structural layout strings into pure grayscale CSS Flexbox and Grid frames.
- [ ] **Task 3.3: Dual-Engine Abstract Syntax Tree Core**
  * **Motive:** Prevent standard string manipulation and regex injection attacks from breaking tag properties during token mapping loops.
  * **Action:** Code `src/core/compiler.ts` to route markup to either a PostHTML engine array or an ultra-fast native Rust `oxc-parser` ESTree syntax loop.
- [ ] **Task 3.4: Framework Token Transformation Adapters**
  * **Motive:** Abstract multi-syntax class variations away from core design systems logic.
  * **Action:** Code unified mapping strategies inside `src/core/adapters/html.ts` and `src/core/adapters/jsx.ts` (`class` vs. `className`).
- [ ] **Task 3.5: Contrast Matrix & Relative Luminance Core**
  * **Motive:** Automate accessibility checks directly inside compiler stages using exact color luma equations.
  * **Action:** Build `src/core/matrix.ts` to perform mathematical color contrast checks.
- [ ] **Task 3.6: Palette Harmony Auditor (`uirig contrast`)**
  * **Motive:** Provide a standalone verification rig to explicitly intercept and block low-contrast paint operations.
  * **Action:** Build `src/commands/contrast.ts` to audit static files and exit with POSIX code `1` upon WCAG ratio failures.
- [ ] **Task 3.7: Token Mixer Pipeline & Alternative Shuffle (`uirig paint`)**
  * **Motive:** Fuse unstyled wireframe layouts with design token system dictionaries safely.
  * **Action:** Code `src/commands/paint.ts` to combine token variables into DOM structures, incorporating randomized harmony palette shifts when `--shuffle` is flagged.
- [ ] **Task 3.8: Spatial Layout Console Wireframer (`uirig trace`)**
  * **Motive:** Provide immediate, text-based debugging grids to visualize element nesting directly in standard shells.
  * **Action:** Implement `src/commands/trace.ts` to parse structural display parameters into a console ASCII map diagram.
- [ ] **Task 3.9: State Invariant Reconciliation Protocol (SIRP)**
  * **Motive:** Secure user IDE edits from accidental pipeline overwrites.
  * **Action:** Build `src/core/session.ts` to trap checksum drifts via SHA-256 byte-hash routines.
- [ ] **Task 3.10: Time-Travel Chronological Checkpoint Engine (`uirig checkout`)**
  * **Motive:** Decouple development from linear generation errors, allowing instant rollbacks to stable underlying structures.
  * **Action:** Implement `src/commands/checkout.ts` to match state log history array indices and safely restore cached snapshots.

### Phase 4: Dev Orchestration & Quality Assurance Rigs
- [ ] **Task 4.1: Continuous Hot-Reloading Monitor**
  * **Motive:** Drive an active local preview loop tracking both filesystem transformations and visual token updates in real time.
  * **Action:** Code `src/core/orchestrator.ts` using `chokidar` file system monitors paired with local WebSocket connections.
- [ ] **Task 4.2: Development Workspace Orchestration (`uirig dev`)**
  * **Motive:** Manage continuous automated compilation processes silently in background threads.
  * **Action:** Program `src/commands/dev.ts` to boot local servers and sync modifications over runtime connections.
- [ ] **Task 4.3: Headless Sandbox Intercept Scaffold**
  * **Motive:** Set up an isolated serverless automated validation layer completely clear of third-party telemetry networks.
  * **Action:** Implement the headless browser initialization logic inside `src/core/adversary.ts` utilizing local Playwright configurations.
- [ ] **Task 4.4: Local Tracking Expansion Stressor (`uirig break`)**
  * **Motive:** Adversarially stress container properties by testing text growth limits under rapid locale reflow conditions.
  * **Action:** Code `src/commands/break.ts` to inject text growth vectors (+30% tracking characters) into web-first browser frames.
- [ ] **Task 4.5: Geometric Bounding & Reflow Monitor**
  * **Motive:** Catch clipping and overflow failures inside the layout sandbox using absolute coordinate telemetry.
  * **Action:** Code within `src/core/adversary.ts` to evaluate structural bounds utilizing native browser `getBoundingClientRect()` metrics.
- [ ] **Task 4.6: Automated Component Healing Synthesizer**
  * **Motive:** Dynamically patch broken responsive layouts by executing target AST repairs inline.
  * **Action:** Code `src/core/healer.ts` to intercept layout violations and inject defensive class structures (`flex-wrap`, `break-all`).
- [ ] **Task 4.7: Grid Margin Strain Fuzzer (`uirig bleed`)**
  * **Motive:** Map the exact limits where structural containers shatter by testing incremental padding expansions.
  * **Action:** Implement `src/commands/bleed.ts` to track canvas padding stress tolerances over step intervals.
- [ ] **Task 4.8: Sub-Element Injection Row Auditor (`uirig flex`)**
  * **Motive:** Verify that responsive grids handle dynamic layout updates gracefully without provoking box overlapping collisions.
  * **Action:** Build `src/commands/flex.ts` to audit flex wrapping behaviors under fluid node populations.

### Phase 5: Handoff Compilations & Release Setup
- [ ] **Task 5.1: Lexical Text Context Packer (`uirig pack`)**
  * **Motive:** Strip structural layout templates of white space and comment bulk to maximize efficiency for low-tier AI prompt contexts.
  * **Action:** Program `src/commands/pack.ts` to provide highly optimized component string compressions.
- [ ] **Task 5.2: Portable Context Portability Capsule (`uirig handoff`)**
  * **Motive:** Compile repository blueprints, token sets, and steps into an isolated Markdown block optimized for web-tab copy-pasting.
  * **Action:** Implement `src/commands/handoff.ts` to write data structures out to `.uirig/copy_paste_pack.md`.
- [ ] **Task 5.3: Baseline Integration & Testing Manifest**
  * **Motive:** Enforce absolute tool stability via isolated, hermetic mock evaluations.
  * **Action:** Write integration verification test matrices inside `tests/integration/workflow.test.ts`.
- [ ] **Task 5.4: CLI Executable Global Package Distribution**
  * **Motive:** Build a lightweight global binary configuration node to deploy the executable tool.
  * **Action:** Set up `bin/uirig` global executable parameters and release routines.

---

## Session State Machine Constraints

Every functional step modifies state inside `.uirig/session.json`. The programmatic loop must balance historical verification parameters before modifying downstream assets:

```text
 [State State Loop]
 Check existing .uirig/session.json  ==> Run SIRP Checksum Validation  ==> Execute Next Pipeline Step
```

If an error configuration is applied during any single generation block, the tracking manifest must cleanly permit rollbacks to pristine, immutable structural state data blocks without forcing project state resets.
