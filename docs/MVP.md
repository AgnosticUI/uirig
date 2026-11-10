# Implementation Blueprint: `uirig` Scoped MVP

This document defines the focused Phase 1 engineering scope, core architectural compromises, and verification invariants required to ship `uirig`: a local React + Tailwind CLI workbench built for **visual safety, WCAG compliance, stress-tested layout resilience, faster DX, and drop-in CI/CD quality gates**.

## 1. The 7-Tool High-Signal MVP Matrix

To prevent configuration scope creep while delivering immediate end-to-end value, the MVP targets **React + Tailwind CSS** across **seven core commands**. Instead of fragile one-shot AI rewrites or complex POSIX stream piping, `uirig` operates as a deterministic, `git`-style stage-gate compiler over plain-text files:

```text
                  [uirig MVP Stage-Gate Pipeline]
                  
                 1. INITIALIZATION & LEDGER MANAGEMENT
                           $ uirig init
                                 │
                                 ▼
                 2. CONTINUOUS WORKSPACE RUNTIME MONITOR
                           $ uirig dev
                                 │
                                 ▼
                 3. STATIC AST COMPILATION & MATRIX VERIFICATION
                           $ uirig paint --tokens config/default_tokens.json
                                 │
                                 ├──► [matrix.ts] runs WCAG 4.5:1 contrast checks
                                 └───► [compiler.ts] runs oxc-parser JSX AST mutations
                                 │
                                 ▼
                 4. STATE RECONCILIATION & TIME-TRAVEL
                           $ uirig session:sync | $ uirig checkout <step>
                                 │
                                 ▼
                 5. ADVERSARIAL HEADLESS LAYOUT FUZZING
                           $ uirig break --target .uirig/snapshots/02_painted.html --fix
                                 │
                                 ├──► [adversary.ts] runs Playwright rect telemetry
                                 └───► [healer.ts] injects defensive layout tokens
                                 │
                                 ▼
                 6. CONTEXT COMPRESSION & EXPORT
                           $ uirig pack --target component.tsx
```

---

## 2. Component Interface & Architecture Specifications

### 2.1 `uirig init` (Ecosystem Bootstrap)
* **Description:** Scaffolds the localized workspace directory path, drops the baseline design token configuration, and initializes the local `session.json` state log ledger.
* **Output Artifact:** Generates `.uirig/`, `.uirig/snapshots/`, `.uirig/session.json`, and `config/default_tokens.json`.

### 2.2 `uirig paint` (The Token-to-AST Core)
* **Description:** Fuses an unstyled React/JSX component file with a design system token configuration using a native Rust-bound syntax tree loop to mutate visual properties without touching component logic.
* **In-Memory Transformation:** 
  1. Computes a SHA-256 byte-hash of the input layout file to verify it matches the ledger history.
  2. Runs incoming colors through `matrix.ts` to enforce a **4.5:1 WCAG relative luminance contrast minimum**. If a pair fails, execution halts immediately with exit code `1`.
  3. Routes the JSX markup string into **`oxc-parser`** to generate an ESTree-compliant Abstract Syntax Tree graph in memory. 
  4. Traverses `JSXOpeningElement` nodes and mutates `JSXAttribute` objects to swap design system tokens cleanly.
* **Output Artifact:** Emits a compiled, styled React component file alongside a static HTML snapshot (`.uirig/snapshots/02_painted.html`) for downstream headless testing.

### 2.3 `uirig break` (The Adversarial Fuzzing Rig)
* **Description:** A local layout linter and CI/CD gate that launches an isolated browser thread to evaluate layout durability under real-world text expansion and zoom constraints.
* **Architectural Compromise:** To bypass complex local component bundling and hydration bottlenecks in Phase 1, `uirig paint` emits a static HTML preview snapshot (`.uirig/snapshots/02_painted.html`) alongside the styled `.tsx` component so `uirig break` can evaluate raw DOM geometry directly in Playwright.
* **In-Memory Transformation:** Spawns a headless **Playwright** runner, loads the snapshot, and injects string expansion vectors (+30% character lengths and 200% zoom reflow). It queries native `getBoundingClientRect()` metrics and logs a collision violation whenever a child node leaks past its parent container boundaries.
* **Self-Healing Loop:** When `--fix` is active, `src/core/healer.ts` catches each structural violation and appends defensive Tailwind utility classes (such as `flex-wrap`, `break-all`, and `min-w-0`) directly into the component.
* **Output Artifact:** Emits a hardened component file on pass (exit code `0`), or exits with POSIX code `2` on layout breakage so CI/CD pipelines can block regressions automatically.

### 2.4 `uirig dev` (Continuous Workspace Live Orchestrator)
* **Description:** Instantiates the hot-reload developer experience loop, monitoring layout files and token configs via a local file watcher.
* **In-Memory Transformation:** Spawns a lightweight filesystem watch hook (`chokidar`). On file mutation events, it triggers background AST compilation in Node memory and broadcasts synchronization events over local WebSockets to hot-reload a local preview canvas without heavy bundler overhead.
* **Output Artifact:** Real-time terminal telemetry and WebSocket hot-reload updates.

### 2.5 `uirig pack` (The Context Optimizer)
* **Description:** A lexical minification utility that strips comments and redundant whitespace from a layout component while preserving Tailwind class strings and structural data attributes.
* **Output Artifact:** Emits a compressed, token-efficient string (up to 75% smaller) to stdout or file to prevent context window bloat in LLM workflows.

### 2.6 `uirig checkout <step>` (The Time-Travel Engine)
* **Description:** Performs a chronological rollback across the `.uirig/session.json` ledger to restore workspace files to any verified historical checkpoint snapshot.
* **Output Artifact:** Overwrites active local files with cached snapshot artifacts on command.

### 2.7 `uirig session:sync` (The Out-of-Band Reconciliation Engine)
* **Description:** Resolves State Invariant Reconciliation Protocol (SIRP) halts when a developer manually edits a tracked component in their IDE. Computes the updated SHA-256 byte-hash, appends a verified milestone entry to `.uirig/session.json`, and caches a fresh snapshot.
* **Output Artifact:** Updates `.uirig/session.json` and writes a verified snapshot to `.uirig/snapshots/`.

---

## 3. High-Signal MVP Technical Stack & CI/CD Contract

* **Runtime:** Node.js 22+ LTS
* **AST/Parser Engine:** `@oxc-project/parser` (Native Rust bindings running zero-overhead syntax graph mapping inside Node memory)
* **Adversarial Browser Rig:** `playwright` (Headless Chromium instances handling `getBoundingClientRect()` geometry checks)
* **Orchestration Core:** `chokidar` paired with native Node child processes and lightweight `ws` WebSocket handlers
* **Validation Layer:** Plain-text SHA-256 byte hashing and WCAG relative luminance equations (`Y = 0.2126R + 0.7152G + 0.0722B`)
* **Typographic Console Logs:** Emoji-free terminal markers (`:::`, `==>`, `[!]`, `[+]`)
* **CI/CD Exit Code Contract:**
  * `0`: All compilation, contrast, and bounding-box checks passed.
  * `1`: Operational error, invalid syntax, SHA-256 checksum drift, or WCAG 4.5:1 contrast failure.
  * `2`: Adversarial layout breakage detected by `uirig break` (overflow or container collision).

---

## 4. Operational Invariant Rules

1. **Syntax-Safe Mutations via ESTree Nodes:** `uirig paint` never uses regex or string replacement to apply styles. By parsing JSX through `oxc-parser`, it traverses real `JSXOpeningElement` nodes and mutates `JSXAttribute` indices directly, guaranteeing a **0.00% syntax corruption rate**.
2. **Compile-Time Accessibility Gates:** `matrix.ts` evaluates WCAG 4.5:1 color luminance *before* emitting styled markup, making low-contrast UI impossible to compile.
3. **State Invariant Reconciliation Protocol (SIRP):** Before any modifier command runs, `uirig` compares the target file's SHA-256 hash against `.uirig/session.json`. If manual IDE edits are detected, execution halts and requires an explicit choice (`uirig session:sync` to keep manual edits or `uirig checkout <step>` to revert), preventing silent overwrites.

---

## 5. Architectural Scalability & Future PRD Expansion Paths

The MVP uses strict separation-of-concern boundaries so the toolchain can scale to the full 15-tool Product Requirement Document (`docs/PRD.md`) without rewriting core domain modules:

### 5.1 Decoupled Browser Telemetry (Scaling `break` to Live Frameworks)
* **MVP Boundary:** `uirig break` evaluates static HTML snapshots using raw `getBoundingClientRect()` bounds to avoid real-time bundling overhead.
* **PRD Expansion:** `src/core/adversary.ts` interacts with browsers through an `IHeadlessBrowserDriver` interface. Scaling to live React/JSX hydration later requires zero changes to the fuzzer loop or healer—only adding a `ReactCanvasAdapter` backed by an in-memory Vite server.

### 5.2 Immutable Tree Graph Extensibility (Scaling `paint` to `trace`)
* **MVP Boundary:** `src/core/compiler.ts` uses `oxc-parser` to traverse `JSXOpeningElement` nodes for style-token injection.
* **PRD Expansion:** Because the parser produces standard ESTree object graphs in memory, adding `uirig trace` (terminal ASCII grid wireframes) or `uirig layout` (grayscale structural skeletons) is purely additive and reuses the same AST traversal primitives.

### 5.3 Command-Routing Decoupling (Scaling to the 15-Tool Matrix)
* **MVP Boundary:** The CLI maps flags to seven core commands backed by pure domain modules (`matrix.ts`, `session.ts`, `adversary.ts`, `compiler.ts`, `healer.ts`, `orchestrator.ts`).
* **PRD Expansion:** Scaling from 7 tools to all 15 commands is achieved by adding thin CLI command wrappers in `src/commands/` (`bleed.ts`, `flex.ts`, `contrast.ts`, `handoff.ts`) that pass different parameters into the existing core primitives.
