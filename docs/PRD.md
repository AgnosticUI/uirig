# Product Requirement Document (PRD)

## Project: `uipipe`
### Subtitle: The Composable Unix Pipeline for Token-Aware AI Design Engineering
**Status:** Approved | **Target:** 100k GitHub Stars Open-Source Launch

---

## 1. Executive Summary & Core Philosophy

### 1.1 The Problem
Current AI design generation toolchains are monolithic, fragile, and bound to an archaic "one-shot" paradigm. Passing massive instructions or multi-thousand-line global design sheets to an LLM context window simultaneously forces it to approximate document structure, styling, accessibility, and edge-case resilience all at once. This results in **AI Slop**—visually uninspired layouts that instantly collapse under real-world production stress (e.g., text reflow overflows, non-semantic DOM trees, layout collisions, broken event listeners, or missing native keyboard focus states).

### 1.2 The Solution
`uipipe` breaks down the front-end layout engineering process into a deterministic sequence of single-purpose steps, directly honoring the **Unix Tools Philosophy**:
1. **Do One Thing and Do It Well (DOTADIW):** Isolate structural layout architecture completely from aesthetic visual skinning.
2. **Universal Interface:** Rely on plain-text streams (Semantic HTML/JSX structures and structured JSON tokens).
3. **Composability:** Pipe the immutable output of a structural wireframe generation directly into token paint operations, followed by automated web-first hardening loops.

`uipipe` addresses the massive cognitive load of managing these iterative passes by hosting a localized **Session State Director** that handles state tracking, time-travel history rollbacks, and text-based token optimization natively on the user's filesystem—democratizing elite design engineering for everyone from enterprise professionals to resource-strapped indie hackers.

---

## 2. User Persona Matrix & Economic Realities

`uipipe` treats **AI token budgets and platform access as a first-class architectural constraint**. The system is built to support varying economic profiles without vendor discrimination:

| Persona Name | Economic Reality | Core Tool Interaction |
| :--- | :--- | :--- |
| **The Enterprise Sovereign** | Unlimited token budget; corporate infrastructure access. | Uses `uipipe` fully automated inside CLI agent loops (e.g., automated scripts running Claude Code or Cursor tools via `--agent` flags). |
| **The Metered Pragmatist** | $20/month subscription cap. Constantly managing mid-week token exhaustion or throttles. | Uses `uipipe` locally to prune context, compress layouts, and strip fluff *before* piping streams to paid APIs. |
| **The Free-Tier Alchemist** | $0 AI budget. Cobbles free web tabs (Google AI Studio, ChatGPT free, Grok) via browser copy-paste. | Uses `uipipe` entirely in `--local-only` mode to generate ultra-dense, text-based project maps and clipboard injection bundles. |

> **Development Mandate:** The `uipipe` runtime and tooling matrix must remain entirely compilable and verifiable using only the free resources available to **The Free-Tier Alchemist**. The core toolchain requires zero paid runtime dependencies; local testing relies strictly on offline template synthesis, deterministic structural validation, and structured prompt generation templates.

## 3. Product Architecture & Functional Core

`uipipe` operates as a standalone CLI application. All commands manipulate files locally within a project directory inside a specialized workspace folder (`.uipipe/`).

```text
[uipipe CLI Matrix]
 ::: uipipe layout   ==>  Compiles text intent into Grayscale Semantic Structure (No Color)
 ::: uipipe paint    ==>  Fuses Grayscale Structure + tokens.json (Supports --shuffle)
 ::: uipipe break    ==>  Adversarial Stress Tester (Playwright Headless Hydrated Canvas Fuzzer)
 ::: uipipe handoff  ==>  Context Capsule Compiler (Formats context packs for browser tabs)
```

### 3.1 Non-Emoji Visual Anchor Language
To project a professional toolchain aesthetic, `uipipe` explicitly and completely bans standard graphical emojis from terminal outputs. It uses strict typographic character structures to retain scannability:
* `::: ` - System State Boundaries / Invariant Markers
* `==> ` - Piping Operations / Successful Transformations
* `[+] ` - Injected Node / Appended Class Modifier
* `[!] ` - System Warnings / Adversarial Stress Failures
* `_ \ | /` - Multi-frame text rotation spinner indicators for background processing.

---

## 4. Component Interface Specifications

### 4.1 `uipipe layout` (The Structural Blueprint)
* **Description:** Pure-responsibility layout generator. Accepts structural content parameters and synthesizes a zero-color, unstyled HTML/JSX skeleton baseline.
* **Input:** Natural language structural description or wireframe constraint.
* **Output:** An immutable, semantic `01_layout.html` or framework template chunk utilizing only primitive layout bounds (Flexbox/Grid layout constructs, gray wireframe placeholders). It is completely stripped of all aesthetic embellishments.

### 4.2 `uipipe paint` & The Framework Adapter Matrix
* **Description:** Ingests unstyled structure markup strings and forks parsing logic based on platform choice. For raw static HTML layouts, it parses elements via PostHTML nodes. For React/JSX environments, it leverages a high-performance native Rust compiler bridge via `oxc-parser` to process target structures directly into standard ESTree compliance. This completely safeguards complex hybrid tag expressions, dynamic brace variables, and self-closing tags from element corruption. Strategy adapters parse values securely into final framework token bindings (standard markup `class` formatting tags versus React/JSX camelCase `className` properties).
* **The Variation Machine:** Instead of outputting a single design outcome, `uipipe paint` reads the token spectrum and generates 3-5 distinct visual applications onto the identical structural base (e.g., shifting structural token density from compact to roomy, swapping accent priorities, alternating light/dark surface maps).
* **The Shuffle Engine:** Supports an interactive command variant (`uipipe paint --shuffle`). This operates as a design "I'm Feeling Lucky" engine. It dynamically randomizes token mappings (color bindings from the design token system, border-radius themes, shadow depths) across the structural blocks. The user cycles through applications with simple keystrokes until a layout variant satisfies aesthetic targets.

### 4.3 `uipipe break` (The Adversarial Stress Fuzzer)
* **Description:** A strict adversarial layout robustness inspector (accessible via `uipipe break`, `breakit`, or `uibreakit`). It completely abandons brittle, error-prone string length estimations inside Node.js. Instead, it launches an un-networked serverless browser context via a local headless Playwright execution process (v1.64+ stable line).
* **Functional Injections:** For components that rely on state hydration (React/Vue components), the engine constructs a clean sandboxed local mount frame (`config/templates/react_canvas.html`) paired with framework execution scripts. It executes an internal blocking evaluate hook to guarantee client-side hydration is fully active before running text growth stress injections via modern web-first `page.locator()` parameters. It tests layout boundaries using native browser bounding rectangles (`getBoundingClientRect` measurements):
  1. *String Expansion Fuzzing:** Injects long textual strings with zero break spaces (e.g., 75-character long string IDs, German locale length amplification (+30% tracking characters)) to verify text-wrapping layouts.
  2. *Scale Fuzzing:* Forces document containers into simulating a 200% text layout scaling rule to test responsiveness.
  3. *Interrupted Phase Simulation:* Validates element mechanics when actions fire out of order or animation states are dropped mid-execution.
* **Output:** If text overflows break layout boundary containment grids, the tool throws a structural violation error, logs element leaks, and exits with a strict POSIX status code `2`, preventing broken builds from hitting production code paths.

### 4.4 `uipipe handoff` & `uipipe manifest` (The Filesystem Proxies)
* **Description:** The ultimate enabler for the **Free-Tier Alchemist** and **Metered Pragmatist**. It abstracts the local environment into portable text bundles.
* **The Manifest Engine (`uipipe manifest`):** Safely computes a clean local directory tree snapshot while completely blocking dependency blackholes (`node_modules/`, `.git/`, build distributions).
* **The Context Capsule:** Compiles all steps, current workspace tree maps, token definitions, and structural snapshots into a hyper-dense, single markdown layout pack saved at `.uipipe/copy_paste_pack.md`. The user copies this individual asset directly into the prompt frame of any free web-browser LLM, successfully executing complex, context-aware coding tasks without setting up live API environments.

## 5. Technical Session Lifecycle & State Engine

`uipipe` manages session state via an immutable journal schema stored in `.uipipe/session.json`. This acts like a lightweight time-travel tracker designed explicitly for front-end architecture tracking.

### 5.1 The Local Session Blueprint Example
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
      "filePointer": ".uipipe/snapshots/01_layout.html",
      "checksum": "a7b3c9d8e7f6a5b4c3d2e1f0a7b3c9d8e7f6a5b4c3d2e1f0a7b3c9d8e7f6a5b4",
      "timestamp": "2026-11-09T14:05:00Z"
    },
    {
      "step": 2,
      "command": "paint",
      "variantName": "02_painted_lucky_variant_3",
      "status": "active",
      "filePointer": ".uipipe/snapshots/02_painted.html",
      "checksum": "f2e9d4c3b2a1f0e9d8c7b6a5f2e9d4c3b2a1f0e9d8c7b6a5f2e9d4c3b2a1f0e9",
      "timestamp": "2026-11-09T14:14:00Z"
    }
  ]
}
```

### 5.2 Time-Travel Operation
If an automated token application or adversarial mutation degrades the component structure, the user drops back to a specific checkpoint instantly:
```bash
\$ uipipe checkout step-1
::: Restoring Step 1 Snapshot [01_layout.html] ==> Active State Restored.
```
This detaches development from linear generation errors, allowing users to rapidly experiment with different token skins on top of the identical underlying grayscale architecture without suffering from progressive generation rot.

### 5.3 State Invariant Reconciliation Protocol (SIRP)
To protect a developer's manual IDE optimizations from being overwritten during pipeline steps, the engine verifies the local working file's active SHA-256 checksum against the checkpoint hash inside `session.json` before triggering commands. If manual, out-of-band updates are discovered, `uipipe` initiates the following resolution tree:
1. **Halt and Alert:** Stop execution and display a strict warning notice layout to the console: `[!] Warning: Out-of-band developer modification detected. Current file checksum has drifted from session ledger history.`
2. **Fork and Preserved State Actions:** The CLI prompts the user with an interactive decision checkpoint:
   * `uipipe session:sync` -> Captures the developer's manual optimizations, re-calculates the local checksum snapshot, and updates the step history ledger state cleanly as an incremental commit pass.
   * `uipipe checkout step-n` -> Forcefully discards manual modifications and rewinds the local target file to a pristine historical file state snapshot.

---

## 6. Competitive Landscape & Market Differentiation

### 6.1 Comprehensive Competitor & Capability Matrix

| Competitor / Skill Vector | Primary System Architecture | Target Audience Profile | Core Capability Focus | Glaring Operational Weakness(es) | `uipipe` Strategic Counter-Positioning |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **v0.dev & Bolt.new** | Monolithic web runtime environments. | Enterprise Sovereigns / Metered Pragmatist devs. | Full-stack scaffolding, package installations, and rapid sandboxed web iteration. | **Total Vendor Lock-In & Cloud Token Bleed:** High infrastructure latency, high subscription overhead, and immediate workflow failure if network access or API budgets dry up. | **Deterministic Offline Control:** Replaces bloated, opaque, high-latency online platform loops with localized Unix CLI command controls. |
| **Replit Agent 4 & Infinite Canvas** | Infinite state tracking workspace canvas. | Metered Pragmatists / Collaborative Teams. | Multi-user parallel task execution and interactive visual design tweaks directly on active live applications. | **Massive Cognitive Context Bloat:** Constant file modifications quickly saturate prompt context windows, causing progressive generation rot during long sessions. | **Modular Decoupling:** Replaces complex cloud-hosted IDE boundaries with plain-text Markdown structure capsules optimized for any LLM tier. |
| **Anthropic Frontend Design & Artifacts** | Specialized system prompt heuristics. | Advanced Vibe Coders / Product Designers. | Structural clarity, semantic minimalist layouts, and clean visual execution states. | **Purely Advisory & Visual Only:** The model weights completely lack an automated local execution layer to enforce or mathematically verify their own architectural design rules. | **The Hardened Automation Rig:** Translates abstract behavioral prompts into a deterministic, local layout linter that outputs exact terminal errors. |
| **The "Taste Skill" / UI/UX Pro Max** | Custom fine-tunes and specialized persona contexts. | Design Engineers / AI Enthusiasts. | Visual asymmetry, responsive fluid hierarchies, typography configurations, and premium UI Polish. | **Fragile Structural Drift:** Attempting to alter aesthetic themes simultaneously mutates underlying DOM nodes, breaking semantic layout structure. | **Invariant Visual Splits:** Forces models to generate raw grayscale layouts first, completely isolating structural balance from aesthetic variations. |
| **Impeccable / Hallmark / Anti-Slop** | Strict rule-driven defensive validation guardrails. | Senior Engineers / System Operators. | Preventing generic card grids, infinite online dots, and common "AI tells" or element styling overlaps. | **High False-Positive Strictness:** Heavily over-engineered string-matching rules frequently reject highly creative, valid, edge-case interface patterns. | **Locally Injected Fuzz Tester:** Active browser adversarial fuzzing via Playwright to uncover element clipping automatically before production commits. |
| **GSAP AI Skills** | Advanced animation state models and vector choreography. | Creative Developers / UI Innovators. | Highly interactive canvas timelines, expressive layout physics, and custom state transition animations. | **DOM Event Handler Collisions:** Script injections frequently corrupt elements, detaching active event listeners when layouts are updated mid-stream. | **Immutable Base + Variant Motion:** Pipes clean, structured DOM trees directly into variant style configurations without corrupting event listeners. |

### 6.2 Market Demand Summary
"Vibe coders," design engineers, and creative developers across active developer forums are experiencing deep fatigue with first-generation layout generation tools. The demand vectors have systematically shifted from absolute generation velocity to architectural discipline and interactive precision:
*   **The Rejection of "AI Slop":** The market has moved past the novelty of simple single-prompt inputs. Technical teams are looking for "Anti-Slop" filters—strict mechanisms that introduce typographic variation, spatial whitespace allocation, and structural resilience into raw components.
*   **The Craving for Aesthetic Taste:** Standard base models default to conservative, generic design patterns. Developers are manually stringing together custom system prompt matrices to inject "Taste Skills"—forcing AI layouts to adopt complex editorial alignments, micro-interactions, fluid scales, and elevated visual minimalism.
*   **Choreographed Motion Over Static Components:** Creators leveraging motion skill models (e.g., GSAP AI) find that when models attempt to write deep layout classes and timeline structural animations simultaneously, the code breaks instantly under tracking desyncs. The market is asking for pipelines that keep base element code lightweight while allowing robust animation vectors to sit cleanly on top.
*   **Context Window Fatigue:** As models regenerate complete files repeatedly to patch minor alignment issues, context windows saturate, triggering token limits. Developers demand local optimization tools that handle context pruning before pushing data out to AI endpoints.

---

## 7. Community Viral Growth Strategy

To hit **100k GitHub stars within 2 weeks of release**, `uipipe` addresses these core demand vectors directly:
1. **Zero-Lock-In Exit Strategy:** The presence of `uipipe handoff` means the tool openly advertises itself as a launchpad. It explicitly encourages users to take their clean code out to Cursor or web tabs whenever they want, building massive goodwill.
2. **Aggressive Financial Accessibility:** The README leads with a proud manifesto: *"Built for Enterprise Sovereigns, Metered Pragmatists, and Free-Tier Alchemists alike. Zero token waste. 100% functional with raw clipboard copy-pasting via local context encapsulation."*
3. **The Developer Pride Factor:** By framing UI generation through the lenses of compilers, linters, and classic Unix pipelines (`cat struct.html \| uipipe paint --shuffle`), it elevates the vibe coding lifestyle into a respected, high-discipline software engineering methodology.
