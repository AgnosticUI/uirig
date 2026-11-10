# Product Requirement Document (PRD)

## Project: `uirig`
### Subtitle: The Composable Unix Pipeline for Token-Aware AI Design Engineering
**Status:** Approved | **Target:** 100k GitHub Stars Open-Source Launch

---

## 1. Executive Summary & Core Philosophy

### 1.1 The Problem
Current AI design generation toolchains are monolithic, fragile, and bound to an archaic "one-shot" paradigm. Passing massive instructions or multi-thousand-line global design sheets to an LLM context window simultaneously forces it to approximate document structure, styling, accessibility, and edge-case resilience all at once. This results in **AI Slop**—visually uninspired layouts that instantly collapse under real-world production stress (e.g., text reflow overflows, non-semantic DOM trees, layout collisions, broken event listeners, or missing native keyboard focus states).

### 1.2 The Solution
`uirig` breaks down the front-end layout engineering process into a deterministic sequence of single-purpose steps, directly honoring the **Unix Tools Philosophy**:
1. **Do One Thing and Do It Well (DOTADIW):** Isolate structural layout architecture completely from aesthetic visual skinning.
2. **Universal Interface:** Rely on plain-text streams (Semantic HTML/JSX structures and structured JSON tokens).
3. **Composability:** Pipe the immutable output of a structural wireframe generation directly into token paint operations, followed by automated web-first hardening loops.

`uirig` addresses the massive cognitive load of managing these iterative passes by hosting a localized **Session State Director** that handles state tracking, time-travel history rollbacks, and text-based token optimization natively on the user's filesystem—democratizing elite design engineering for everyone from enterprise professionals to resource-strapped indie hackers.

---

## 2. User Persona Matrix & Economic Realities

`uirig` treats **AI token budgets and platform access as a first-class architectural constraint**. The system is built to support varying economic profiles without vendor discrimination:

| Persona Name | Economic Reality | Core Tool Interaction |
| :--- | :--- | :--- |
| **The Enterprise Sovereign** | Unlimited token budget; corporate infrastructure access. | Uses `uirig` fully automated inside CLI agent loops (e.g., automated scripts running Claude Code or Cursor tools via `--agent` flags). |
| **The Metered Pragmatist** | \$20/month subscription cap. Constantly managing mid-week token exhaustion or throttles. | Uses `uirig` locally to prune context, compress layouts, and strip fluff *before* piping streams to paid APIs. |
| **The Free-Tier Alchemist** | \$0 AI budget. Cobbles free web tabs (Google AI Studio, ChatGPT free, Grok) via browser copy-paste. | Uses `uirig` entirely in `--local-only` mode to generate ultra-dense, text-based project maps and clipboard injection bundles. |

> **Development Mandate:** The `uirig` runtime and tooling matrix must remain entirely compilable and verifiable using only the free resources available to **The Free-Tier Alchemist**. The core toolchain requires zero paid runtime dependencies; local testing relies strictly on offline template synthesis, deterministic structural validation, and structured prompt generation templates.

---

## 3. Product Architecture & Functional Core

`uirig` operates as a standalone CLI application. All commands manipulate files locally within a project directory inside a specialized workspace folder (`.uirig/`).

```text
[uirig CLI Matrix]
 ::: Structural Blueprint & Styling Engines
 ::: uirig layout         ==>  Compiles text intent into Grayscale Semantic Structure (No Color)
 ::: uirig paint          ==>  Fuses Grayscale Structure + tokens.json (Supports --shuffle)
 ::: uirig trace          ==>  Extracts existing layout classes to visualize spatial grids
 ::: uirig blueprint      ==>  Generates structural layout boilerplate from a matrix
 
 ::: Adversarial Stress & Quality Assurance Rigs
 ::: uirig break          ==>  Adversarial Stress Tester (Playwright Headless Hydrated Canvas Fuzzer)
 ::: uirig contrast       ==>  Throws error codes if text elements fall below WCAG 4.5:1
 ::: uirig bleed          ==>  Fuzzes container dimensions to spot structural break points
 ::: uirig flex           ==>  Audits alignment and wrapping under dynamic element counts
 
 ::: Dev Orchestration, Workspace, & Session Lifecycle
 ::: uirig init           ==>  Scaffolds workspace pathing and initializes session tracker ledger
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
* `==> ` - Piping Operations / Successful Transformations
* `[+] ` - Injected Node / Appended Class Modifier
* `[!] ` - System Warnings / Adversarial Stress Failures
* `_ \ | /` - Multi-frame text rotation spinner indicators for background processing.

---

## 4. Component Interface Specifications

### 4.1 Structural Blueprint & Styling Engines

#### 4.1.1 `uirig layout`
* **Description:** Generates zero-color, invariant layout skeletons focusing exclusively on document outlines, containment flows, and responsive layouts.
* **Input Parameters:** `intent` (string), `--platform` (`html-tailwind` | `react-tailwindcss` | `vue-prime`).
* **Output Artifact:** Emits `01_layout.html` stripped of any color, typography families, shadows, or motion styles.

#### 4.1.2 `uirig paint`
* **Description:** Fuses the unstyled structure markup file with a design system token configuration using a secure virtual tree engine to prevent regex collisions.
* **Input Parameters:** `--tokens` (string), `--shuffle` (flag).
* **In-Memory Transformation:** Validates tokens against the Relational Matrix schema. If color pairing falls below a 4.5:1 WCAG contrast threshold, it dynamically calculates a compliant harmony pair.
* **Output Artifact:** Emits `02_painted.html` or framework style snapshot.

#### 4.1.3 `uirig trace`
* **Description:** Extracts existing layout classes and renders a structural layout trace diagram directly to the console terminal to visualize spatial grid distribution.
* **Input Parameters:** `--target` (string).
* **Output Artifact:** Diagnostic plain-text console diagram map.

#### 4.1.4 `uirig blueprint`
* **Description:** Generates pure structural layout boilerplate wireframe models based on explicit grid distribution matrices without processing external prompt contexts.
* **Input Parameters:** `--matrix` (string), `--platform` (`html-tailwind` | `react-tailwindcss` | `vue-prime`).
* **Output Artifact:** Emits raw unstyled boilerplate canvas components.
### 4.2 Adversarial Stress & Quality Assurance Rigs

#### 4.2.1 `uirig break` (Aliases: `breakit`, `uibreakit`)
* **Description:** A local layout linter that launches a local, un-networked serverless browser thread to test component robustness under extreme interface configurations.
* **Input Parameters:** `--target` (string), `--fix` (flag).
* **In-Memory Transformation:** Spawns a headless Playwright runner, injects custom locale tracking parameters (+30% tracking characters), and simulates 200% document scale reflows. If `--fix` is active, `src/core/healer.ts` injects defensive class overrides (e.g., `flex-wrap`, `break-all`).
* **Output Artifact:** Emits hardened `03_hardened.html` or throws leakage parameters.

#### 4.2.2 `uirig contrast`
* **Description:** Evaluates the active painted file layout snapshot and explicitly throws error codes if text color elements fall below a mathematical 4.5:1 relative contrast threshold.
* **Input Parameters:** `--target` (string).
* **Output Artifact:** Exits with status `1` and prints precise DOM element paths failing WCAG guidelines.

#### 4.2.3 `uirig bleed`
* **Description:** Fuzzes container dimensions with incremental non-breaking padding to locate exactly where structural elements break encapsulation grids.
* **Input Parameters:** `--target` (string), `--steps` (integer).
* **Output Artifact:** Comprehensive visual breakdown matrix indicating layout strain points.

#### 4.2.4 `uirig flex`
* **Description:** Audits the flex-wrap and layout alignment properties under dynamic element counts to isolate structural collisions or line-break overlaps.
* **Input Parameters:** `--target` (string), `--count-range` (string).
* **Output Artifact:** Structural overlap diagnostic report.

---

### 4.3 Dev Orchestration, Workspace, & Session Lifecycle

#### 4.3.1 `uirig init`
* **Description:** Scaffolds the workspace directory paths, layout baselines, template mounting targets, and initializes the `.uirig/session.json` state tracking ledger.
* **Output Artifact:** Standardized `.uirig/` structural workspace ecosystem directory.

#### 4.3.2 `uirig manifest`
* **Description:** Compiles a full project file tree map while cleanly filtering out system blackholes (`node_modules/`, `.git/`, `dist/`).
* **Output Artifact:** Updated file indexing schema maps.

#### 4.3.3 `uirig session:sync`
* **Description:** Forces an immediate reconciliation loop between the local developer filesystem and the session ledger, computing current SHA-256 hashes to absorb out-of-band manual IDE changes cleanly.
* **Input Parameters:** None.
* **In-Memory Transformation:** Reads the working directory code files, generates an active SHA-256 byte-hash, compares it against the last state journaled in `.uirig/session.json`, and updates the current historical sequence block to `status: stable` without incrementing the step counter.
* **Output Artifact:** Updates `.uirig/session.json` state inline.
* **Failure Matrix:** Throws exit code `1` if the current files contain catastrophic structural syntax parsing errors (e.g., unclosed tags, invalid JSX) that prevent standard DOM/AST compilation.

#### 4.3.4 `uirig checkout <step>`
* **Description:** Performs a local workspace chronological rollback or roll-forward to restore files to a pristine historical file state snapshot.
* **Input Parameters:** `step` (integer target matching a recorded step index or string alias like `step-1`).
* **In-Memory Transformation:** Locates the specified step array item within the local ledger, validates its recorded file checksum against the immutable snapshot artifact cache stored inside `.uirig/snapshots/`, and overwrites the active project working file pointer.
* **Output Artifact:** Restores the active localized code files (e.g., `01_layout.html` or `02_painted.html`) to their historical variants.
* **Failure Matrix:** Exits with strict status code `1` if the targeted step index does not exist in the journal history or if its cached snapshot artifact file has been deleted from the filesystem.

---

### 4.4 Context Portability & Export Tools

#### 4.4.1 `uirig handoff`
* **Description:** Bundles active design artifacts, configuration states, and local repository metadata maps into a zero-overhead, portable Markdown transfer capsule optimized for browser copy-paste workflows.
* **Input Parameters:** `--session` (string UUID, optional).
* **In-Memory Transformation:** Reads current design files, serialized token schemas, and token ledger trees, stripping out large dependency blackholes. It maps text contents directly into predefined structural markdown blocks inside `config/templates/handoff_capsule.md`.
* **Output Artifact:** Emits an ultra-dense markdown transfer document saved directly to `.uirig/copy_paste_pack.md`.
* **Failure Matrix:** Throws exit code `1` if the current active session state is completely blank or corrupt.

#### 4.4.2 `uirig pack`
* **Description:** A dedicated minification and structural code compression utility that strips out boilerplate fluff, comments, and redundant formatting spacing to optimize raw text tokens for lower-tier AI prompt structures.
* **Input Parameters:** `--target` (string file path).
* **In-Memory Transformation:** Compiles the targeted file stream through a token-preserving lexical compressor that deletes unnecessary whitespace and internal source comments while explicitly retaining crucial framework structural data attributes and Tailwind class strings.
* **Output Artifact:** Rewrites the target layout component to an ultra-dense string layout or outputs a compressed string buffer directly to the terminal stdout stream.
* **Failure Matrix:** Throws exit code `1` if the file targeting mapping path fails validation checks.

---

## 5. Advanced Operational Invariants & Algorithmic Guardrails

### 5.1 The Relational Token Matrix Rules (Contrast & Fluid Scale Locks)
To eliminate visually broken layouts, `uirig` executes mathematical constraint filtering inside `src/core/matrix.ts` before allowing token attributes to compile into DOM/AST trees. 

1. **Relative Luminance Evaluation (WCAG 2.1 AA Compliance):**
   The matrix engine computes relative luminance ($Y$) for proposed background ($L_1$) and foreground ($L_2$) hex colors using the standard formula:
   $$Y = 0.2126 \cdot R + 0.7152 \cdot G + 0.0722 \cdot B$$
   If the resulting contrast ratio $(\frac{L_1 + 0.05}{L_2 + 0.05})$ falls below **4.5:1**, the application rejects the stylistic token pass. If `--shuffle` is active, it mutates the palette down a compliant harmony scale instead of rendering unreadable layout code.

2. **Typography Fluid Scale Lock:**
   The typography system enforces rigid geometric proportion steps (`minor-third`, `perfect-fourth`, `golden-ratio`) configured in `config/default_tokens.json`. Heading font sizes are calculated programmatically from a single base font configuration token rather than generated via separate text string prompts, ensuring absolute structural rhythm across screen changes.

### 5.2 The Adversarial Fuzzing Rig Mechanics
The QA tools suite (`break`, `bleed`, `flex`) uses localized, sandboxed browser testing to evaluate design durability against extreme data mutations:

* **Text Tracking Expansion Fuzzing:** Modifies text strings within layouts by appending high-length localized dummy content (+30% character tracking) to evaluate how containers wrap text and flex under translation stress.
* **Reflow Defenses:** Evaluates element bounding boundaries inside Playwright. If an element's calculated `getBoundingClientRect()` width or height exceeds its parent element container bounding boxes, a layout boundary collision violation is caught and output to standard diagnostic text channels.
* **Automated Component Healing:** When vulnerabilities are detected under the `--fix` parameter flag, the healing system loops back to inject precise corrective style tokens (e.g., appending structural parameters like `min-w-0`, `flex-wrap`, or `break-all`) safely into the corresponding PostHTML or Oxc abstract syntax tree layout indices.

---

## 6. Execution Lifecycle Scenarios

### 6.1 Standard Workflow Sequence
The following chronological terminal sequence highlights how the 14 core tools combine to handle layout generation, code hardening, and context-aware external handoffs without suffering from architectural design degradation:

```bash
# Step 1: Initialize local workspace boundaries
$ uirig init
::: Initializing Workspace Environment ==> .uirig/ generated successfully.

# Step 2: Compile pure structural design blueprint skeletons
$ uirig layout "desktop medical dashboard with sidebar navigation and tabular patient grids" --platform html-tailwind
::: Compiling Grayscale Blueprint ==> Emitted 01_layout.html [Stable Step 1 Checkpoint]

# Step 3: Apply design tokens while verifying relative visual contrast bounds
$ uirig paint --tokens config/default_tokens.json
::: Running Relational Matrix Verification ==> Contrast Check Passed (5.4:1 ratio)
::: Fusing Visual Style Tokens ==> Emitted 02_painted.html [Active Step 2 Checkpoint]

# Step 4: Run adversarial layout fuzzing to hunt down element clipping flaws
$ uirig break --target .uirig/snapshots/02_painted.html --fix
::: Spawning Headless Playwright Context Rig...
::: Injecting Stress Vectors [+30% Tracking Characters, 200% Scale Reflow]
[!] Element Collision Warning: Selector (.patient-table-cell) overflows parent container!
[+] Applying Defensive Patch Class Overrides ==> Injected [break-all, flex-wrap]
::: Hardening Complete ==> Emitted 03_hardened.html

# Step 5: Export project context capsule to paste directly into browser chat inputs
$ uirig handoff
::: Gathering Local Directory Tree Blueprint...
::: Packaging Local Tokens and Historical Snapshot State Ledger Maps...
==> Portability Capsule Compiled to .uirig/copy_paste_pack.md [Handoff Ready]
```

## 7. Extended Error Matrix & Invariant Enforcement Systems

### 7.1 Diagnostic Error Code Architecture
`uirig` implements a strict, non-ambiguous error handling architecture. When a background compilation pass or headless browser test violates structural integrity rules, the CLI intercepts the error, prevents file system corruption, and yields specific POSIX codes paired with plaintext alphanumeric identifiers.

| Error Code Identifier | POSIX Exit Code | Primary System Trigger | Mitigation Path Resolution Strategy |
| :--- | :--- | :--- | :--- |
| `ERR_INV_CHECKSUM_DRIFT` | `1` | The SHA-256 byte-hash of the local target file does not match the ledger state tracked within `session.json`. | Execute `uirig session:sync` to safely record user IDE structural optimizations or force rollback with `uirig checkout <step>`. |
| `ERR_MAT_CONTRAST_FAIL` | `1` | A manual or automated text-to-background color token pairing falls below the mathematical threshold limit of 4.5:1. | Re-evaluate the token palette mapping dictionaries; pass the `--shuffle` flag during a paint pass to force compliance. |
| `ERR_ADV_CONTAIN_COLLAPSE` | `2` | Headless Playwright engine verifies a child DOM node's `getBoundingClientRect()` bounds leak past its parent grid element boundaries. | Append the `--fix` parameter to trigger the `healer.ts` automated structural repair utility tree injection mechanism. |
| `ERR_AST_SYNTAX_CORRUPT` | `1` | The Oxc ESTree engine parser or PostHTML DOM core catches incomplete tags, expression faults, or broken structural blocks. | Halt compilation sequence immediately, protect the last stable snapshot step, and display the line number failure on the console layout. |

### 7.2 The State Invariant Reconciliation Protocol (SIRP) Tree
To safely preserve manual human developer edits while retaining automated layout pipelines, the runtime system runs a multi-phase verification loop upon executing any modifier command:

```text
       [Command Invocation (e.g., uirig paint)]
                          │
                          ▼
            Compute Local File SHA-256 Hash
                          │
                          ▼
         Does Hash Match session.json Ledger?
              ├─── YES ───► Proceed to Execution Pipeline Loop
              └─── NO  ───► [SIRP Intercept Triggered]
                                 │
                                 ▼
                     Halt Execution & Print
             "::: [!] Warning: Out-of-band drift detected."
                                 │
                                 ▼
                     Await User Override Route
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
[Route A: uirig session:sync]                [Route B: uirig checkout <step>]
  ├─ Read user IDE updates                      ├─ Purge out-of-band updates
  ├─ Re-calculate current SHA-256               ├─ Pull last stable snapshot
  ├─ Commit state to history array              ├─ Overwrite local file pointer
  └─ Resume processing pipelines                └─ Restore historical ecosystem
```

---

## 8. Technical Environment Boundaries

### 8.1 Zero-Dependency Offline Execution Mandate
To ensure support for **The Free-Tier Alchemist**, `uirig` operates with completely isolated execution constraints:
* **No Premium Subscriptions:** Zero run-time reliance on commercial SaaS tools, hosted microservices, or paid open-source platforms.
* **Network-Independent Mode:** All layout validation models, relational matrices, and tree-shaking mechanisms execute entirely locally within memory space without invoking remote API connections.
* **Hermetic Sandbox Operations:** The headless browser layer powered by Playwright relies on isolated text generators and standard local stylesheets rather than fetching tracking components or online CDNs.
* **Lightweight Runtime Profile:** Bypasses bloated server runtimes by routing JSX abstractions directly through ultra-fast, native Rust-bound `oxc-parser` binaries, allowing rapid compilation routines on standard developer laptops.
## 9. Distribution Model & Enterprise Hardening

### 9.1 The Package Blueprint & Installation Footprint
`uirig` distributes as a self-contained open-source global executable utility module via standard package registries. It contains an efficient local footprint structure designed to initialize instantaneously without system drift:

```text
[Global Executable Scope Map]
 npm install -g uirig 
   └── uirig (Global CLI Executable Router Symbol Link)
        ├── src/index.ts (Directs Execution Args)
        └── config/
             ├── default_tokens.json (Local Structural Baseline Rules Configuration File)
             └── templates/
                  ├── layout_base.html (Grayscale Layout Standard Wireframe Template File)
                  └── handoff_capsule.md (Markdown Compilation Target Standard Framework File)
```

The global installer contains direct check gates verifying the execution platform matches safe system environments (e.g., Node.js versions >= 18.0.0).

### 9.2 The Secure Local Context Capsule Lifecycle
The `uirig handoff` context engine treats local workspace project code explicitly as highly private infrastructure data:
1. **Total Isolation Safeguards:** The parsing crawler strictly enforces system exclusion blocklists (`node_modules/`, `.git/`, `dist/`, `.env`) to block private credentials, infrastructure keys, or heavy external modules from slipping into clipboard structures.
2. **Context Density Minimization:** Minifies structure frames to compress tracking assets. This lowers context window congestion limits by up to 75% on low-tier browser tab interfaces, completely eliminating the progressive generation rot that typically happens when passing heavy raw markup strings through commercial chat tools.

---

## 10. Open-Source Success Metrics & Validation Protocols

### 10.1 Viral Evaluation Target Benchmarks
To guarantee project momentum during the target **100k GitHub Stars Open-Source Launch**, the pipeline is mathematically evaluated against rigorous performance criteria:

* **Execution Velocity Target:** Standard `uirig layout` execution routines must compile from plain text instructions to grayscale DOM structures within a threshold window of less than **150ms**.
* **Tree Modification Reliability:** Running complex structural design updates via `uirig paint` across PostHTML or Oxc ESTree syntax engines must demonstrate a **0.00% syntax degradation rate** (no broken tags, or corrupted variable injections).
* **Self-Healing Resolution Efficiency:** Under active adversarial layout tests with `--fix` active, the internal healing system must resolve a minimum of **90% of bounding box container leaks** on the first patch pass.

### 10.2 Strict Continuous Integration Invariants
The release pipeline validation rules require that every open-source code commit passes absolute health conditions prior to artifact deployment:
* **100% Core Matrix Test Pass:** Test suites must execute all structural evaluation matrices against invalid token mappings (`tests/mocks/invalid_tokens.json`) to confirm contrast errors trigger exit codes instantly.
* **Zero Graphic Emoji Rule:** The build configuration parses all logging files and terminal strings via automated scripts to confirm that zero standard visual emojis are included, ensuring strict adherence to the typographic visual anchor framework.

---

## 11. Technical Session Lifecycle & State Engine

`uirig` manages session states via an immutable chronological journal schema stored inside `.uirig/session.json`. This local engine functions as a lightweight time-travel tracker built specifically to protect front-end architectures across active execution states.

#### 11.1 The Local Session Blueprint Example
```json
{
  "\$schema": "http://json-schema.org",
  "sessionId": "medical-dashboard-029",
  "meta": {
    "platform": "html-tailwind",
    "updatedAt": "2026-11-09T14:14:00Z"
  },
  "history": [
    {
      "step": 1,
      "command": "layout",
      "variantName": "01_layout",
      "status": "stable",
      "filePointer": ".uirig/snapshots/01_layout.html",
      "checksum": "a7b3c9d8e7f6a5b4c3d2e1f0a7b3c9d8e7f6a5b4c3d2e1f0a7b3c9d8e7f6a5b4",
      "timestamp": "2026-11-09T14:05:00Z"
    },
    {
      "step": 2,
      "command": "paint",
      "variantName": "02_painted_lucky_variant_3",
      "status": "active",
      "filePointer": ".uirig/snapshots/02_painted.html",
      "checksum": "f2e9d4c3b2a1f0e9d8c7b6a5f2e9d4c3b2a1f0e9d8c7b6a5f2e9d4c3b2a1f0e9",
      "timestamp": "2026-11-09T14:14:00Z"
    }
  ]
}
```

#### 11.2 Time-Travel Operation
If an automated token application, layout trace, or adversarial mutation degrades the component structure, the developer drops back to any safe historical step instantly using the expanded command matrix:
```bash
\$ uirig checkout 1
::: Restoring Step 1 Snapshot [01_layout.html] ==> Active State Restored.
```

#### 11.3 State Invariant Reconciliation Protocol (SIRP)
To protect a developer's manual IDE optimizations from being overwritten during pipeline steps, the engine verifies the local working file's active SHA-256 checksum against the checkpoint hash inside `session.json` before triggering commands. If manual, out-of-band updates are discovered, `uirig` initiates the following resolution tree:
1. **Halt and Alert:** Stop execution and display a strict warning notice layout to the console: `[!] Warning: Out-of-band developer modification detected. Current file checksum has drifted from session ledger history.`
2. **Fork and Preserved State Actions:** The CLI prompts the user with an interactive decision checkpoint:
   * `uirig session:sync` -> Captures the developer's manual optimizations, re-calculates the local checksum snapshot, and updates the step history ledger state cleanly as an incremental commit pass.
   * `uirig checkout <step>` -> Forcefully discards manual modifications and rewinds the local target file to a pristine historical file state snapshot.

## 12. Competitive Landscape & Market Differentiation

#### 12.1 Comprehensive Competitor & Capability Matrix

| Competitor / Skill Vector | Primary System Architecture | Target Audience Profile | Core Capability Focus | Glaring Operational Weakness(es) | `uirig` Strategic Counter-Positioning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **v0.dev & Bolt.new** | Monolithic web runtime environments. | Enterprise Sovereigns / Metered Pragmatist devs. | Full-stack scaffolding, package installations, and rapid sandboxed web iteration. | **Total Vendor Lock-In & Cloud Token Bleed:** High infrastructure latency, high subscription overhead, and immediate workflow failure if network access or API budgets dry up. | **Deterministic Offline Control:** Replaces bloated, opaque, high-latency online platform loops with localized Unix CLI command controls. |
| **Replit Agent 4 & Infinite Canvas** | Infinite state tracking workspace canvas. | Metered Pragmatists / Collaborative Teams. | Multi-user parallel task execution and interactive visual design tweaks directly on active live applications. | **Massive Cognitive Context Bloat:** Constant file modifications quickly saturate prompt context windows, causing progressive generation rot during long sessions. | **Modular Decoupling:** Replaces complex cloud-hosted IDE boundaries with plain-text Markdown structure capsules optimized for any LLM tier via `uirig handoff` and `uirig pack`. |
| **Anthropic Frontend Design & Artifacts** | Specialized system prompt heuristics. | Advanced Vibe Coders / Product Designers. | Structural clarity, semantic minimalist layouts, and clean visual execution states. | **Purely Advisory & Visual Only:** The model weights completely lack an automated local execution layer to enforce or mathematically verify their own architectural design rules. | **The Hardened Automation Rig:** Translates abstract behavioral prompts into a deterministic, local layout linter (`uirig break`, `bleed`, `flex`) that outputs exact terminal errors. |

#### 12.2 Market Demand Summary
"Vibe coders," design engineers, and creative developers across active developer forums are experiencing deep fatigue with first-generation layout generation tools. The demand vectors have systematically shifted from absolute generation velocity to architectural discipline and interactive precision:
*   **The Rejection of "AI Slop":** The market has moved past the novelty of simple single-prompt inputs. Technical teams are looking for "Anti-Slop" filters—strict mechanisms that introduce typographic variation, spatial whitespace allocation, and structural resilience into raw components.
*   **The Craving for Aesthetic Taste:** Standard base models default to conservative, generic design patterns. Developers are manually stringing together custom system prompt matrices to inject "Taste Skills"—forcing AI layouts to adopt complex editorial alignments, micro-interactions, fluid scales, and elevated visual minimalism.
*   **Choreographed Motion Over Static Components:** Creators leveraging motion skill models (e.g., GSAP AI) find that when models attempt to write deep layout classes and timeline structural animations simultaneously, the code breaks instantly under tracking desyncs. The market is asking for pipelines that keep base element code lightweight while allowing robust animation vectors to sit cleanly on top.
*   **Context Window Fatigue:** As models regenerate complete files repeatedly to patch minor alignment issues, context windows saturate, triggering token limits. Developers demand local optimization tools like `uirig pack` that handle context pruning before pushing data out to AI endpoints.

---

## 13. Community Viral Growth Strategy

To hit **100k GitHub stars within 2 weeks of release**, `uirig` addresses these core demand vectors directly:

1. **Zero-Lock-In Exit Strategy:** The presence of `uirig handoff` means the tool openly advertises itself as a launchpad. It explicitly encourages users to take their clean, packed context capsules out to Cursor, Claude Code, or browser tabs whenever they want, building massive open-source goodwill.
2. **Aggressive Financial Accessibility:** The README leads with a proud manifesto: *"Built for Enterprise Sovereigns, Metered Pragmatists, and Free-Tier Alchemists alike. Zero token waste. 100% functional with raw clipboard copy-pasting via local context encapsulation."*
3. **The Developer Pride Factor:** By framing UI generation through the lenses of compilers, linters, and classic Unix pipelines (`uirig layout "intent" | uirig paint --shuffle | uirig trace`), it elevates the vibe coding lifestyle into a respected, high-discipline software engineering methodology.

### 13.1 The Universal Boundary Tool Persona Matrix
`uirig` unifies completely different personas across the AI design engineering spectrum by delivering specific, role-targeted value:

*   **📐 Design & UI Engineers / Technologists:** Gains deterministic layout architecture enforcement and type-safe linting primitives (`uirig contrast`, `trace`, `blueprint`) to replace fragile visual regression suites inside team workflows.
*   **📋 Technical PMs & Technical Designers:** Protects visual product governance. Allows instant iteration across fluid design tokens, dark/light themes, and layout densities (`uirig paint --shuffle`) over an invariant, production-safe frame.
*   **🔮 Vibe Coders & AI Builders:** Eliminates repetitive engineering loops by trapping and auto-healing browser clipping anomalies (`uirig break`, `bleed`, `flex`) locally before pushing broken layouts into live production tracking code.

### 13.2 The Ultimate CI/CD Plug-and-Play Footprint
By maintaining a strict **150ms unit execution budget**, `uirig` functions as an invisible visual gatekeeper sitting directly beside Playwright workflows inside GitHub Actions runners to strip out layout regressions flawlessly without inflating infrastructure SaaS budgets:

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
      - name: Verify Typography Contrast (WCAG 4.5:1)
        run: uirig contrast --target ./src/components/
      - name: Fuzz Layout Container Grid Bleed Bounds
        run: uirig bleed --target ./src/components/ --steps 5
      - name: Audit Dynamic Row Element Flex Accumulations
        run: uirig flex --target ./src/components/ --count-range "1-12"
```

