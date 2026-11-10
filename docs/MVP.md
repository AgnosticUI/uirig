# Implementation Blueprint: `uirig` Scoped MVP

This document defines the focused Phase 1 engineering scope, core architectural compromises, and verification invariants required to ship `uirig`: a local framework-agnostic CLI workbench built for **visual safety, WCAG compliance, stress-tested layout resilience, faster DX, and drop-in CI/CD quality gates**.

## 1. The 7-Tool High-Signal MVP Matrix

To deliver immediate end-to-end value with zero framework lock-in, the MVP implements **seven core commands**. Instead of complex AST code manipulation or language-specific string parsers, `uirig` operates as a deterministic, browser-driven telemetry gate over running UI contexts:

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
                 3. DESIGN TOKEN PARITY CONTROLLER
                           $ uirig paint --tokens config/default_tokens.json
                                 │
                                 ▼
                 4. STATE RECONCILIATION & TIME-TRAVEL
                            uirig session:sync |  uirig checkout <step>
                                 │
                                 ▼
                 5. ADVERSARIAL HEADLESS LAYOUT FUZZING
                           $ uirig break --target component.html --fix
                                 │
                                 ├──► [adversary.ts] runs Playwright rect telemetry via Web APIs
                                 └───► [healer.ts] updates file line strings via data-uirig-id
                                 │
                                 ▼
                 6. CONTEXT COMPRESSION & EXPORT
                           $ uirig pack --target component.html
```

---

## 2. Component Interface & Architecture Specifications

### 2.1 `uirig init` (Ecosystem Bootstrap)
* **Description:** Scaffolds the localized workspace directory path, drops the baseline design token configuration, and initializes the local `session.json` state log ledger.
* **Output Artifact:** Generates `.uirig/`, `.uirig/snapshots/`, `.uirig/session.json`, and `config/default_tokens.json`.

### 2.2 `uirig paint` (The Token Palette Controller)
* **Description:** Updates interface visual variables by altering the target global design token json configuration on disk. 
* **In-Memory Transformation:** 
  1. **SIRP Check (`session.ts`):** Computes a SHA-256 byte-hash of the file system target to verify it matches ledger history.
  2. **Palette Sync (`compiler.ts`):** Rewrites token value pairs inside `config/default_tokens.json` to allow user application dev servers to naturally pick up transformations.

### 2.3 `uirig break` (The Adversarial Fuzzing Rig)
* **Description:** A local layout linter and CI/CD gate that launches an isolated browser thread via Playwright to evaluate layout durability under real-world text expansion and zoom constraints.
* **In-Memory Transformation:** Spawns a headless **Playwright** runner, loads the component URL or file context, and injects string expansion vectors (+30% character lengths and 200% zoom reflow). It queries native `getBoundingClientRect()` metrics and logs a collision violation whenever a child node leaks past its parent container boundaries.
* **Metadata-Driven Fix Loop:** When `--fix` is active, `src/core/healer.ts` catches each structural violation and appends defensive styles (such as `flex-wrap`, `break-all`, or `min-w-0`) directly onto the code file line matching the failed `data-uirig-id`.
* **Output Artifact:** Emits a hardened code asset on pass (exit code `0`), or exits with POSIX code `2` on layout breakage so CI/CD pipelines can block regressions automatically.
---

### 📐 Part 2: MVP Orchestration, Primitives, and Invariant Systems
**File Path Target:** `docs/MVP.md` (Sections 2.4 through 4)  
**Execution Verification Baseline Date:** **November 9, 2026**

```markdown
### 2.4 `uirig dev` (Continuous Workspace Live Orchestrator)
* **Description:** Instantiates the hot-reload developer experience loop, monitoring files and token configs via a local file watcher.
* **In-Memory Transformation:** Spawns a lightweight filesystem watch hook (`chokidar`). On file mutation events, it broadcasts synchronization metrics over local WebSockets to hot-reload a preview canvas without heavy internal compiler overhead.

### 2.5 `uirig pack` (The Context Optimizer)
* **Description:** A dedicated layout minification utility that strips comments and unnecessary whitespace from a layout asset while explicitly retaining crucial identifying metadata tags and layout utility classes.
* **Output Artifact:** Emits a compressed, token-efficient string (up to 75% smaller) to stdout or file to prevent context window bloat in LLM workflows.

### 2.6 `uirig checkout <step>` (The Time-Travel Engine)
* **Description:** Performs a chronological rollback across the `.uirig/session.json` ledger to restore workspace files to any verified historical checkpoint snapshot.

### 2.7 `uirig session:sync` (The Out-of-Band Reconciliation Engine)
* **Description:** Resolves State Invariant Reconciliation Protocol (SIRP) halts when a developer manually edits a tracked layout component in their IDE. Computes the updated SHA-256 byte-hash, appends a verified milestone entry to `.uirig/session.json`, and caches a fresh snapshot.

---

## 3. High-Signal MVP Technical Stack & CI/CD Contract

* **Runtime:** Node.js 22+ LTS
* **Adversarial Browser Rig:** `playwright` (Headless Chromium instances handling `getBoundingClientRect()` geometry checks)
* **Orchestration Core:** `chokidar` paired with lightweight `ws` WebSocket handlers
* **Validation Layer:** Plain-text SHA-256 byte hashing and WCAG relative luminance equations (`Y = 0.2126R + 0.7152G + 0.0722B`)
* **Typographic Console Logs:** Emoji-free terminal markers (`:::`, `==>`, `[!]`, `[+]`)
* **CI/CD Exit Code Contract:**
  * `0`: All compilation, contrast, and bounding-box checks passed.
  * `1`: Operational error, invalid syntax, SHA-256 checksum drift, or WCAG 4.5:1 contrast failure.
  * `2`: Layout breakage detected by `uirig break` (overflow or container collision).

---

## 4. Operational Invariant Rules

1. **Framework-Blind Evaluation via Web APIs:** `uirig` never attempts to transpile individual framework code strings. By evaluating living DOM layouts directly inside Playwright, it treats React, Vue, Svelte, and Vanilla Web Components identically.
2. **Compile-Time Accessibility Gates:** `matrix.ts` evaluates WCAG 4.5:1 color luminance on rendered pixel channels inside Playwright *before* letting code passes finalize, making low-contrast UI impossible to ship.
3. **State Invariant Reconciliation Protocol (SIRP):** Before any modifier command runs, `uirig` compares the target file's SHA-256 hash against `.uirig/session.json`. If manual IDE edits are detected, execution halts and requires an explicit choice (`uirig session:sync` to keep manual edits or `uirig checkout <step>` to revert), preventing silent overwrites.

