# uirig

### Invariant Semantic Structure meets Composable Style Vectors.

`uirig` is a modular command-line toolchain built explicitly to destroy **AI Slop**—those fragile, bloated interfaces generated in a single prompt turn that collapse the second real text overflows, layout viewports scale, or input containers are dynamically populated.

By adapting the **Unix Tools Philosophy** directly to AI-driven front-end engineering, `uirig` splits the structural architecture from the visual skin. It allows you to pipe unstyled layout logic into variant token systems, run local adversarial fuzz tests to harden code resilience, and bundle clean context environments regardless of your AI platform tier.

```text
       [Prompt Intent]
              │
              ▼
   :::   uirig layout     ==>  [01_layout.html] (Grayscale, Rigid DOM Tree Grid Core)
              │
              ▼
   :::   uirig paint      ==>  [02_painted.html] (Token-Injected Skin, Contrast Locked)
              │
              ▼
   :::   uirig break      ==>  [03_hardened.html] (Defensive DOM Overflows Sealed)
              │
              ▼
   :::   uirig handoff    ==>  [.uirig/copy_paste_pack.md] (Context Capsule Proxy)
```

---

## 1. Core Philosophy

`uirig` breaks down the front-end layout engineering process into a deterministic sequence of single-purpose steps, directly honoring the **Unix Tools Philosophy**:

1. **Do One Thing and Do It Well (DOTADIW):** Isolate structural layout architecture completely from aesthetic visual skinning.
2. **Universal Interface:** Rely on plain-text streams (Semantic HTML/JSX structures and structured JSON tokens).
3. **Composability:** Pipe the immutable output of a structural wireframe generation directly into token paint operations, followed by automated web-first hardening loops.

---

## 2. The 15 Core Tools Suite

The toolchain provides total deterministic control over front-end compilation states through 15 distinct commands *(tools marked `[MVP]` represent the active Phase 1 release scope)*:

```text
 ::: Structural Blueprint & Styling Engines
 ::: uirig layout                ==>  Compiles text intent into Grayscale Semantic Structure (No Color)
 ::: uirig paint         [MVP]   ==>  Fuses Grayscale Structure + tokens.json (Supports --shuffle)
 ::: uirig trace                 ==>  Extracts existing layout classes to visualize spatial grids
 ::: uirig blueprint             ==>  Generates structural layout boilerplate from a matrix
 
 ::: Adversarial Stress & Quality Assurance Rigs
 ::: uirig break         [MVP]   ==>  Adversarial Stress Tester (Playwright Headless Fuzzer)
 ::: uirig contrast              ==>  Throws error codes if text elements fall below WCAG 4.5:1
 ::: uirig bleed                 ==>  Fuzzes container dimensions to spot structural break points
 ::: uirig flex                  ==>  Audits alignment and wrapping under dynamic element counts
 
 ::: Dev Orchestration, Workspace, & Session Lifecycle
 ::: uirig init          [MVP]   ==>  Scaffolds workspace pathing and initializes session tracker ledger
 ::: uirig dev           [MVP]   ==>  Starts continuous hot-reload watcher and local WebSocket canvas
 ::: uirig manifest              ==>  Compiles a clean project file tree map blocking system blackholes
 ::: uirig session:sync  [MVP]   ==>  Captures out-of-band developer optimizations via SHA-256 byte-hash
 ::: uirig checkout      [MVP]   ==>  Forcefully rewinds local files back to a pristine snapshot step
 
 ::: Context Portability & Export Tools
 ::: uirig handoff               ==>  Context Capsule Compiler (Formats context packs for browser tabs)
 ::: uirig pack          [MVP]   ==>  Compresses layout components to prevent lower-tier context saturation
```

---

## 3. Typographic Interface Standards

To preserve optimal console clarity across active terminal viewports, `uirig` completely bans standard graphical emojis from terminal outputs, utilizing a strict alphanumeric anchor key:
*   `::: ` System Boundary Markers / Stable State Checkpoints
*   `==> ` Stream Pipelines / Successful Transformations
*   `[+] ` Appended DOM Tokens / Injected Modifiers
*   `[!] ` Adversarial Structural Violations / Linter Breaks
*   `_ \ | /` Multi-frame background engine spinners

---

## 4. Installation & Environment Scope

### Prerequisites
* **Node.js Environment:** `v22.0.0` or higher (LTS Stable)
* **Operating System:** POSIX-compliant platform (`Linux`, `macOS`) or Windows Subsystem for Linux (`WSL`)

### Global Installation
```bash
npm install -g uirig
```

### Workspace Bootstrapping
Scaffold your layout project directory to initialize the local session ledger infrastructure:
```bash
cd my-layout-workspace
uirig init
```

---

## 5. Standard Pipeline Workflows

### 5.1 The Anti-Slop Compilation Pipeline
Compile high-fidelity interface markup from raw intent to hardened, zero-color layouts before styling:

```bash
# 1. Compile pure structural grayscale layout skeletons focus on bounding boundaries
uirig layout "desktop medical dashboard with sidebar navigation and client data grid" --platform react-tailwindcss

# 2. Apply theme design tokens while mathematically locking WCAG relative contrast values
uirig paint --tokens config/default_tokens.json

# 3. Run adversarial layout fuzzing to locate and patch element container overflows
uirig break --target .uirig/snapshots/02_painted.tsx --fix
```

### 5.2 Deep Adversarial Verification and Perimeter QA Testing
Execute localized un-networked Playwright stress injection loops to mathematically ascertain where component grids collapse under variable layout pressures:

```bash
# Explicitly intercept and capture typographic luminance contrast ratio failures
uirig contrast --target .uirig/snapshots/02_painted.tsx

# Fuzz wrapper metrics with incremental padding shifts to map grid leakage thresholds
uirig bleed --target .uirig/snapshots/02_painted.tsx --steps 12

# Audit flex rows to verify element wrapping holds against variable sub-element injection arrays
uirig flex --target .uirig/snapshots/02_painted.tsx --count-range "1-24"
```
## 6. Command Reference Matrix

### `uirig layout`
*   **Syntax:** `uirig layout "<intent>" --platform <engine>`
*   **Valid Platforms:** `html-tailwind` | `react-tailwindcss` | `vue-prime`
*   **Description:** Compiles text intent into zero-color, invariant layout skeletons focusing exclusively on document outlines, containment flows, and responsive layouts.

### `uirig paint`
*   **Syntax:** `uirig paint --tokens <path> [--shuffle]`
*   **Description:** Fuses the unstyled structure markup file with a design system token configuration using a secure virtual tree engine to prevent regex substitution collisions. `--shuffle` activates randomized harmony palette exploration.

### `uirig trace`
*   **Syntax:** `uirig trace --target <path>`
*   **Description:** Parses display metrics via target abstract syntax trees and renders a geometric wireframe trace layout directly inside terminal consoles.

### `uirig blueprint`
*   **Syntax:** `uirig blueprint --matrix "<dimensions>" --platform <engine>`
*   **Description:** Directly generates standard placeholder boilerplate skeletons from explicit dimension matrices completely offline, bypassing API processing layers.

### `uirig break`
*   **Syntax:** `uirig break --target <path> [--fix]`
*   **Description:** Launches un-networked browser processes to append high-length tracking text extensions (+30% characters) and simulate 200% document zooming. `--fix` maps corrective inline attributes via `healer.ts`.

### `uirig contrast`
*   **Syntax:** `uirig contrast --target <path>`
*   **Description:** Audits the current painted layout and outputs distinct stack tracks pointing to the precise elements that violate the absolute WCAG 4.5:1 relative luma contrast ratio.

### `uirig bleed`
*   **Syntax:** `uirig bleed --target <path> --steps <integer>`
*   **Description:** Progressively stretches parent canvas padding to isolate the exact coordinate boundary threshold limits where grid elements drop out of alignment.

### `uirig flex`
*   **Syntax:** `uirig flex --target <path> --count-range "<min>-<max>"`
*   **Description:** Loops row sub-element populations iteratively to assert layout wrap resilience and catch element clipping or overlap collisions early.

### `uirig init`
*   **Syntax:** `uirig init`
*   **Description:** Scaffolds the localized `.uirig/` workspace pathing, drops baseline token configurations, and initializes the `.uirig/session.json` state tracker ledger.

### `uirig dev`
*   **Syntax:** `uirig dev [--port <number>]`
*   **Description:** Instantiates the continuous workspace live orchestrator, watching layout components and token configs for mutations and broadcasting live hot-reload updates over local WebSockets.

### `uirig manifest`
*   **Syntax:** `uirig manifest`
*   **Description:** Runs an incredibly light index scan deep within local project roots, producing an active filesystem tree graph while systematically skipping heavy build block directory paths like `node_modules/` or `.git/`.

### `uirig session:sync`
*   **Syntax:** `uirig session:sync`
*   **Description:** Reconciles manual out-of-band IDE edits by recalculating the working file's SHA-256 checksum, updating `.uirig/session.json`, and logging an incremental milestone snapshot.

### `uirig checkout`
*   **Syntax:** `uirig checkout <step>`
*   **Description:** Rewinds local workspace files back to a verified historical checkpoint snapshot recorded in `.uirig/session.json`.

### `uirig pack`
*   **Syntax:** `uirig pack --target <path>`
*   **Description:** A dedicated minification compressor that cleans layout comment blocks, trailing spacing, and lexical formatting anomalies to compress text volumes.

### `uirig handoff`
*   **Syntax:** `uirig handoff`
*   **Description:** Assembles local session manifests, historical steps, and compressed code arrays into a single, cohesive portability markdown capsule block at `.uirig/copy_paste_pack.md`.

---

## 7. State Invariant Reconciliation Protocol (SIRP)

To protect manual IDE optimizations from accidental automated overwrites, `uirig` verifies the working file's active SHA-256 checksum against the step history logged inside `.uirig/session.json` prior to initiating any compilation loops.

When file modifications drift out-of-band, the transaction process initiates a halt intercept path:
1.  **Halt and Alert:** System blocks execution and yields a warning to stdout: `[!] Warning: Out-of-band developer modification detected.`
2.  **Resolution Routes:**
    *   Execute `uirig session:sync` to cleanly absorb manual modifications, update the SHA-256 state ledger, and record an incremental milestone entry pass.
    *   Execute `uirig checkout <step>` to discard local mutations and revert workspace assets to a clean previous check snapshot.

```bash
# Sync out-of-band manual IDE changes directly into the session ledger tracking history
uirig session:sync

# Instantly roll-back to Step 1 Snapshot (Pure Invariant Structural Grayscale Layout)
uirig checkout 1
```

---

## 8. Token Budget Matrix Profiles

`uirig` considers computational resource profiles and context limits as critical front-end compilation constraints, offering native strategies across 3 economic tiers:

*   **The Enterprise Sovereign (`--agent`):** Uncapped token resources. Integrates `uirig` automated workflows into autonomous CLI agents (e.g., Cursor or Claude Code) via execution flags.
*   **The Metered Pragmatist (`--api`):** Standard subscription limits ($20/month caps). Leverages `uirig pack` to lexically compress template assets locally, eliminating prompt overhead before streams run through paid commercial APIs.
*   **The Free-Tier Alchemist (`--local-only`):** $0 AI budget. Runs `uirig handoff` locally to generate ultra-dense prompt portability blocks, completely avoiding progressive context degradation across free browser tabs.

---

## 9. Manifesto

*"Built for Enterprise Sovereigns, Metered Pragmatists, and Free-Tier Alchemists alike. Zero token waste. 100% functional with raw clipboard copy-pasting via local context encapsulation. Elevate vibe coding into a high-discipline, predictable front-end software engineering methodology."*

---

## 10. License

Distributed under the MIT License. See `LICENSE` for details.
