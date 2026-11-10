# Product Requirement Document (PRD)

## Project: `uirig`
### Subtitle: A Deterministic Stage-Gate Compiler and Layout Fuzzing Rig for Safe, Accessible, Unbreakable UI
**Status:** Approved | **Target:** Open-Source Release

---

## 1. Executive Summary & Core Philosophy

### 1.1 The Problem
Current AI design workflows rely on a fragile "one-shot" paradigm. Asking an LLM to simultaneously invent layout structure, apply design tokens, maintain accessibility contrast, and anticipate edge-case text overflow inside a single prompt produces **AI Slop**: interfaces that look passable in a demo screenshot but break under real production conditions. Teams suffer from silent logic regressions during restyling, inaccessible low-contrast text, clipped layouts under real data, overwritten manual IDE edits, and zero automated guardrails in CI/CD.

### 1.2 The Solution
`uirig` turns AI front-end generation into a deterministic, multi-stage local CLI workflow inspired by **Unix modularity** and **`git`-style state management**, delivering five concrete outcomes:

1. **Visual Safety & Confidence:** Framework-blind visual styling operations update layouts via safe token dictionary file mutations without touching delicate source code or component logic.
2. **Compliance & Broader Usability:** Rendered contrast checking gates ensure every shipped screen is legible by executing WCAG 4.5:1 math on living elements inside a browser instance.
3. **Stress-Tested, Unbreakable Resilience:** Headless Playwright overflow fuzzing and automated line patching mitigate production risk by catching and healing layout breaks under +30% text expansion and 200% zoom.
4. **Faster, Safer Developer Experience (DX):** A local **Session State Director** (`.uirig/session.json`) protects manual IDE changes via SHA-256 checksums, enables instant snapshot rollbacks (`uirig checkout`), and compresses context packs (`uirig pack`) for faster iteration across any AI budget tier.
5. **Automated CI/CD Enforcement:** Fast headless execution and strict POSIX exit codes (`0`, `1`, `2`) let teams drop `uirig` directly into pull-request pipelines to block regressions before merge.

Everything runs locally on the user's filesystem with zero required cloud services, making deterministic design engineering practical for enterprise teams and resource-strapped indie hackers alike.

---

## 2. User Persona Matrix & Economic Realities

`uirig` treats **AI token budgets and platform access as a first-class architectural constraint**. The system is built to support varying economic profiles without vendor discrimination:

| Persona Name | Economic Reality | Core Tool Interaction |
| :--- | :--- | :--- |
| **The Enterprise Sovereign** | Unlimited token budget; corporate infrastructure access. | Uses `uirig` fully automated inside CLI agent loops (e.g., automated scripts running Claude Code or Cursor tools via `--agent` flags). |
| **The Metered Pragmatist** | $20/month subscription cap. Constantly managing mid-week token exhaustion or throttles. | Uses `uirig` locally to prune context, compress layouts, and strip fluff *before* piping streams to paid APIs. |
| **The Free-Tier Alchemist** | $0 AI budget. Cobbles free web tabs (Google AI Studio, ChatGPT free, Grok) via browser copy-paste. | Uses `uirig` entirely in `--local-only` mode to generate ultra-dense, text-based project maps and clipboard injection bundles. |

> **Development Mandate:** The `uirig` runtime and tooling matrix must remain entirely compilable and verifiable using only the free resources available to **The Free-Tier Alchemist**. The core toolchain requires zero paid runtime dependencies; local testing relies strictly on offline template synthesis, deterministic structural validation, and structured prompt generation templates.

---

## 3. Product Architecture & Functional Core

`uirig` operates as a standalone CLI application. All commands manipulate files locally within a project directory inside a specialized workspace folder (`.uirig/`).

```text
[uirig CLI Matrix]
 ::: Structural Blueprint & Styling Engines
 ::: uirig layout         ==>  Compiles text intent into Grayscale Semantic Structure (No Color)
 ::: uirig paint          ==>  Swaps design system tokens.json configs safely on disk
 ::: uirig trace          ==>  Extracts layout classes to visualize spatial grids via telemetry
 ::: uirig blueprint      ==>  Generates structural layout boilerplate from a matrix offline
 
 ::: Adversarial Stress & Quality Assurance Rigs
 ::: uirig break          ==>  Adversarial Stress Tester (Playwright Headless Bounding Box Fuzzer)
 ::: uirig contrast       ==>  Throws error codes if text elements fall below WCAG 4.5:1
 ::: uirig bleed          ==>  Fuzzes container dimensions to spot structural break points
 ::: uirig flex           ==>  Audits alignment and wrapping under dynamic element counts
 
 ::: Dev Orchestration, Workspace, & Session Lifecycle
 ::: uirig init           ==>  Scaffolds workspace pathing and initializes session tracker ledger
 ::: uirig dev            ==>  Starts continuous hot-reload watcher and local WebSocket canvas
 ::: uirig manifest       ==>  Compiles a clean project file tree map blocking system blackholes
 ::: uirig session:sync   ==>  Captures out-of-band developer optimizations via SHA-256 byte-hash
 ::: uirig checkout       ==>  Forcefully rewinds local files back to a pristine snapshot step
 
 ::: Context Portability & Export Tools
 ::: uirig handoff        ==>  Context Capsule Compiler (Formats context packs for browser tabs)
 ::: uirig pack           ==>  Compresses layout components to prevent lower-tier context saturation
```

### 3.1 Non-Emoji Visual Anchor Language
To project a professional toolchain aesthetic, `uirig` explicitly and completely bans standard graphical emojis from terminal outputs. It uses strict typographic character structures to retain scannability:
* `::: ` - System State Boundaries / Invariant Markers
* `==> ` - Stage Transformations / Successful Passes
* `[+] ` - Injected Node / Appended Class Modifier
* `[!] ` - System Warnings / Adversarial Stress Failures
* `_ \ | /` - Multi-frame text rotation spinner indicators for background processing.

---

## 4. Component Interface Specifications

### 4.1 Structural Blueprint & Styling Engines

#### 4.1.1 `uirig layout`
* **Description:** Generates zero-color, invariant layout skeletons focusing exclusively on document outlines, containment flows, and responsive layouts.
* **Input Parameters:** `intent` (string), `--platform` (`html-vanilla` | `react-jsx` | `vue-sfc` | `svelte-sfc` | `web-components`).
* **Output Artifact:** Emits layout skeletons stripped of any color, typography families, shadows, or motion styles.

#### 4.1.2 `uirig paint`
* **Description:** Fuses the active canvas with a design system token configuration by updating theme files on disk, ensuring layout styles can be modified without altering live component logic.
* **Input Parameters:** `--tokens` (string), `--shuffle` (flag).
* **Output Artifact:** Updates global visual token palettes cleanly.

#### 4.1.3 `uirig trace`
* **Description:** Extracts existing layout utility configurations and renders a structural layout trace diagram directly to the console terminal to visualize spatial grid distribution via browser-backed layout telemetry.
* **Input Parameters:** `--target` (string).
* **Output Artifact:** Diagnostic plain-text console diagram map.

#### 4.1.4 `uirig blueprint`
* **Description:** Generates pure structural layout boilerplate wireframe models based on explicit grid distribution matrices completely offline without processing external prompt contexts.
* **Input Parameters:** `--matrix` (string), `--platform` (string).
* **Output Artifact:** Emits raw unstyled boilerplate wireframe elements.
---

### 📐 Part 2: QA Rigs, Lifecycle, and Relational Contrast Matrix Rules
**File Path Target:** `docs/PRD.md` (Sections 4.2 through 5)  
**Execution Verification Baseline Date:** **November 9, 2026**

```markdown
### 4.2 Adversarial Stress & Quality Assurance Rigs

#### 4.2.1 `uirig break` (Aliases: `breakit`, `uibreakit`)
* **Description:** A local layout linter that launches a local, un-networked serverless browser thread via Playwright to evaluate layout durability under extreme interface configurations.
* **Input Parameters:** `--target` (string), `--fix` (flag).
* **In-Memory Transformation:** Spawns a headless Playwright runner, injects custom locale tracking parameters (+30% tracking characters), and simulates 200% document scale reflows. If `--fix` is active, `src/core/healer.ts` uses element metadata-tracking indicators (`data-uirig-id`) to inject defensive inline class overrides (e.g., `flex-wrap`, `break-all`) onto source file paths.
* **Output Artifact:** Emits a hardened file on pass, or throws structural layout bounding violations.

#### 4.2.2 `uirig contrast`
* **Description:** Evaluates the active layout viewport using `window.getComputedStyle()` inside Playwright to execute exact luminance checks on rendered pixels. Throws error codes if text elements fall below a mathematical 4.5:1 relative contrast threshold.
* **Input Parameters:** `--target` (string).
* **Output Artifact:** Exits with status `1` and prints precise element selector paths failing WCAG guidelines.

#### 4.2.3 `uirig bleed`
* **Description:** Commands Playwright to fuzz container dimensions with incremental padding shifts to locate exactly where structural elements break encapsulation grids.
* **Input Parameters:** `--target` (string), `--steps` (integer).
* **Output Artifact:** Visual breakdown matrix indicating padding strain limits.

#### 4.2.4 `uirig flex`
* **Description:** Audits the flex-wrap and layout alignment properties under dynamic element counts inside the browser to isolate structural collisions or line-break overlaps.
* **Input Parameters:** `--target` (string), `--count-range` (string).
* **Output Artifact:** Structural overlap diagnostic report.

---

### 4.3 Dev Orchestration, Workspace, & Session Lifecycle

#### 4.3.1 `uirig init`
* **Description:** Scaffolds the workspace directory paths, configuration templates, and initializes the `.uirig/session.json` state tracking ledger.
* **Output Artifact:** Standardized `.uirig/` tracking folder topology.

#### 4.3.2 `uirig dev`
* **Description:** Instantiates the continuous workspace live orchestrator, monitoring components and design token files via chokidar file watchers and broadcasting live hot-reload updates over local WebSockets.
* **Input Parameters:** `--port` (integer, optional).
* **Output Artifact:** Establishes real-time background compilation logs and local WebSocket synchronization connections.

#### 4.3.3 `uirig manifest`
* **Description:** Compiles a full project file tree map while cleanly filtering out system blackholes (`node_modules/`, `.git/`, `dist/`).
* **Output Artifact:** Updated file indexing schema maps.

#### 4.3.4 `uirig session:sync`
* **Description:** Forces an immediate reconciliation loop between the local developer filesystem and the session ledger, computing current SHA-256 hashes to absorb out-of-band manual IDE changes cleanly.
* **Input Parameters:** None.
* **Output Artifact:** Updates `.uirig/session.json` state inline.

#### 4.3.5 `uirig checkout <step>`
* **Description:** Performs a local workspace chronological rollback or roll-forward to restore files to a pristine historical file state snapshot.
* **Input Parameters:** `step` (integer target matching a recorded step index).
* **Output Artifact:** Restores active workspace code files to previous snapshot targets.

---

### 4.4 Context Portability & Export Tools

#### 4.4.1 `uirig handoff`
* **Description:** Bundles active design artifacts, configuration states, and local repository metadata maps into a portable Markdown transfer capsule optimized for browser copy-paste workflows.
* **Input Parameters:** `--session` (string, optional).
* **Output Artifact:** Emits an ultra-dense markdown transfer document saved directly to `.uirig/copy_paste_pack.md`.

#### 4.4.2 `uirig pack`
* **Description:** A dedicated minification and text compression utility that strips out comments and redundant formatting spacing to optimize raw text tokens for lower-tier AI prompt structures.
* **Input Parameters:** `--target` (string file path).
* **Output Artifact:** Outputs a compressed string buffer directly to stdout.

---

## 5. Advanced Operational Invariants & Algorithmic Guardrails

### 5.1 The Relational Token Matrix Rules (Agnostic Contrast & Fluid Scale Locks)
To eliminate visually broken layouts, `uirig` executes mathematical contrast evaluation frameworks inside Playwright via standard Web APIs before code passes finalize.

1. **Relative Luminance Evaluation (WCAG 2.1 AA Compliance):**
   The browser automation framework inspects every visible text node and computes relative luminance (Y) for background (L₁) and foreground (L₂) colors using standard computed style rgb channels:
   \[Y = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B\]
   If the resulting contrast ratio \((\frac{L_1 + 0.05}{L_2 + 0.05})\) falls below **4.5:1**, the build pass is instantly blocked with a validation error code.

2. **Typography Fluid Scale Lock:**
   The typography system enforces rigid geometric proportion steps (`minor-third`, `perfect-fourth`, `golden-ratio`) configured inside `config/default_tokens.json`. Heading font sizes are calculated programmatically from a single base font configuration token rather than generated via separate text prompts, ensuring absolute structural rhythm across screen changes.

## 6. Technical Session Lifecycle & State Engine

`uirig` manages session states via an immutable chronological journal schema stored inside `.uirig/session.json`. This local engine functions as a lightweight time-travel tracker built specifically to protect layout architectures across active execution states.

### 6.1 State Invariant Reconciliation Protocol (SIRP)
To protect a developer's manual IDE optimizations from being overwritten during pipeline steps, the engine verifies the local working file's active SHA-256 checksum against the checkpoint hash inside `session.json` before triggering commands. If manual, out-of-band updates are discovered, `uirig` initiates a halt intercept path:
1. **Halt and Alert:** Stop execution and display a strict warning notice layout to the console: `[!] Warning: Out-of-band developer modification detected.`
2. **Resolution Routes:**
   * `uirig session:sync` -> Captures the developer's manual optimizations, re-calculates the local checksum snapshot, and updates the step history ledger state cleanly.
   * `uirig checkout <step>` -> Forcefully discards manual modifications and rewinds local target files to a pristine historical state snapshot.

---

## 7. Competitive Landscape & Market Differentiation

| Competitor / Skill Vector | Primary System Architecture | Core Capability Focus | Glaring Operational Weakness(es) | `uirig` Strategic Counter-Positioning |
| :--- | :--- | :--- | :--- | :--- |
| **v0.dev & Bolt.new** | Monolithic web runtime environments. | Full-stack scaffolding and sandboxed web iteration. | **Total Vendor Lock-In & Cloud Token Bleed:** Workflow failure if network access or API budgets dry up. | **Deterministic Offline Control:** Replaces high-latency online loops with localized browser-driven CLI controls. |
| **Anthropic Artifacts** | System prompt heuristics. | Structural clarity and semantic minimalist layouts. | **Purely Advisory & Visual Only:** Completely lacks an automated local execution layer to verify rules. | **The Hardened Automation Rig:** Translates abstract layout prompts into exact terminal bounding box validation tests. |

---

## 8. Distribution Model & Enterprise Hardening

### 8.1 The Ultimate CI/CD Plug-and-Play Footprint
By maintaining a strict framework-blind execution strategy, `uirig` functions as an invisible visual gatekeeper sitting directly beside standard automation tools inside GitHub Actions runners to strip out layout regressions flawlessly:

```yaml
name: uirig Defensive Hardening Core Gate
on: [pull_request]
jobs:
  harden_layout:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Boot Sandbox Environment
        run: npm ci && npx playwright install chromium
      - name: Verify Rendered Typography Contrast (WCAG 4.5:1)
        run: uirig contrast --target ./dist/
      - name: Fuzz Layout Container Grid Bleed Bounds
        run: uirig bleed --target ./dist/ --steps 5
```
