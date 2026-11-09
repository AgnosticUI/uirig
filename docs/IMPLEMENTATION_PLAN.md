# Implementation Plan: `uipipe` - Part 1

This document details the engineering blueprint, technical choices, and incremental build tasks required to implement `uipipe` safely from a local system workspace.

## Technical Stack Bounds
To ensure **The Free-Tier Alchemist** execution property is strictly honored, the underlying CLI execution matrix must operate completely independently of paid cloud runtimes or network API constraints during base development:
*   **Runtime Environment:** Node.js 22+ LTS Stable Releases
*   **Core Compiler Engine:** Executable TypeScript 5.x ESM Engine
*   **AST Dependency Layers:** oxc-parser, posthtml
*   **Testing Harness Framework:** Vitest integrated natively into a Vite processing configuration, paired with Playwright v1.64+ headless execution packages
*   **Local State Data:** Isolated JSON file structures (`.uipipe/session.json`)
*   **Local Layout Intermediaries:** Plain-text Markdown (`.uipipe/copy_paste_pack.md`) and raw static HTML/JSX structures.

---

## Implementation Checklist

### Phase 1: Specifications & Documentation Design
- [x] Draft PRD.md (Core System Architecture, Philosophy, & Specifications Matrix)
- [x] Draft the GitHub 100k Stars README.md (High-Conversion Marketing & Architectural Core)

### Phase 2: Core Workspace Engine & Manifest System
- [ ] Initialize bare system architecture workspace path environment variables via `npm init -y`.
- [ ] Run localized package acquisition streams via explicit save instructions to capture current stable releases (`npm i --save-dev typescript vitest vite ts-node @types/node playwright posthtml oxc-parser`).
- [ ] Configure localized system parameters (`tsconfig.json`, `vite.config.ts`, `vitest.config.ts`) directly from installed module parameters.
- [ ] Implement the local file scaffolding routine (`uipipe init`) to securely construct the `.uipipe/` workspace structure and layout browser template roots (`react_canvas.html`).
- [ ] Build the file tree crawling utility (`uipipe manifest`) to parse directory mapping definitions while safely ignoring blackholes (`node_modules/`, `.git/`, `dist/`).
- [ ] Define and schema-validate the session tracking database file (`.uipipe/session.json`) to accurately maintain the step tracking journal history.

### Phase 3: Token Injection & Mutation Utilities (Local Engine)
- [ ] Build the dynamic core engine router in `src/core/compiler.ts` to cleanly segregate static PostHTML DOM mapping loops from native Rust-backed `oxc-parser` ESTree syntax compilation paths.
- [ ] Implement token adapter strategy modules (`src/core/adapters/`) to map unified style variables cleanly across target syntaxes (`class` vs. `className`).
- [ ] Program the token shuffle pipeline (`uipipe paint --shuffle`) to apply randomized mapping combinations from data maps onto structural classes.
- [ ] Implement the State Invariant Reconciliation Protocol (SIRP) inside `src/core/session.ts` to trap checksum drift on manual out-of-band IDE adjustments.
- [ ] Implement the time-travel rollback module (`uipipe checkout step-n`) to restore exact previous snapshots by reading file hashes from the journal history.

### Phase 4: Adversarial Rigidity Logic (`uipipe break`)
- [ ] Code the headless browser instantiation scaffolding inside `src/core/adversary.ts` using stable Playwright configuration handlers.
- [ ] Implement the framework client template canvas mount loop to force blocking wait markers for runtime code state hydration before evaluating boxes.
- [ ] Code the text expansion utility in `uipipe break` to inject non-breaking text patterns and translation expands into element targets using web-first `page.locator()`.
- [ ] Construct the container scale evaluator to check markup properties under simulated text growth bounds utilizing native browser `getBoundingClientRect` metrics.
- [ ] Build the structural visual alert generator using console symbols (`:::`, `==>`, `[!]`, `[+]`) to format edge-case structural layout violations and wire exit code `2` interrupts.

### Phase 5: Handoff Compilations & Release Setup
- [ ] Code the pack system for `uipipe handoff` to synthesize project schemas and steps into the universal markdown proxy block (`.uipipe/copy_paste_pack.md`).
- [ ] Build unit testing scripts using basic mock assertions to enforce validation constraints without calling external server nodes.
- [ ] Package the executable distribution system for open deployment on npm/GitHub.
# Implementation Plan: `uipipe` - Part 2

## Session State Machine Constraints

Every functional step modifies state inside `.uipipe/session.json`. The programmatic loop must balance historical verification parameters before modifying downstream assets:

```text
 [State State Loop]
 Check existing .uipipe/session.json  ==> Run SIRP Checksum Validation  ==> Execute Next Pipeline Step
```

If an error configuration is applied during any single generation block, the tracking manifest must cleanly permit rollbacks to pristine, immutable structural state data blocks without forcing project state resets.

---

## Implementation Rules

### 1. Elite Mentor Workflow Guardrails
All software development, prompting, and orchestration tasks must follow the highly iterative, instructional workflow defined by the following foundational rules:
*   **Hyper-Iterative Slicing:** Never construct a feature or file all at once. Break code tasks down into the smallest possible logical increments. Multiple passes are a structural success.
*   **Co-Developed Specifications:** Every time an operational routine, logic fork, or behavioral chunk is introduced, its companion test spec must be written in the same response as an inseparable unit of work. 
    *   *Note:* Focus tests on demonstrating visual state changes, data flows, and perimeter boundaries in the terminal.
    *   *Exception:* Do not write specs for pure structural boilerplate, environment configurations, raw data fixtures, or isolated type/interface declarations.
*   **Environment Validation First:** Before writing code for any specific task, the very first step must outline the exact folder structure, system prerequisites, and the precise terminal commands required to install packages or initialize the test engine.
*   **Motive Precedes Syntax:** Before displaying code blocks, provide a plain-language explanation of the engineering "WHY" and architectural motivations (e.g., how a function boundary isolates an adversarial input stream).
*   **Pedantic, Dense Commenting:** All production source code and test files must be heavily documented with line-by-line or section-by-section inline comments over-explaining exactly what the logic is doing and why.
*   **Explanatory Logging Streams:** Inject explicit, descriptive console logging paths into both production blocks and test scripts (e.g., `console.log('\n::: START CRAWLER RUN: ... :::')`) to make internal processing execution flows visible directly in the shell.
*   **Zero Placeholders:** Comprehensive code blocks are mandatory. Code omission tricks like `// ... rest of your code here` are completely banned.
*   **Hardcoded Time Checkpoint Rule:** To maintain accurate runtime context, all code modifications, workspace installations, and file-saving operations must be timestamped and validated explicitly against the present execution baseline date of **November 9, 2026**.
*   **Explicit Trapping Sign-Off:** Every single response must conclude with a brief, 1-sentence summary of the micro-chunk built, followed by an explicit request for user permission to proceed. Do not generate the next increment until instructed.

### 2. Documentation Synchronization & Anti-Drift Lifecycle
To prevent documentation decay during this highly iterative development cycle, the system must execute a strict sync routine at the end of every individual task loop:
*   **Drift Analysis:** Cross-examine code changes against `README.md` and `docs/TECHNICAL_DESIGN_DOC.md`. If transformations occur, modify the documentation immediately.
*   **Staging Validation:** Provide clear `git add` and `git commit` syntax suggestions utilizing strict conventional commit definitions (e.g., `feat: build local crawler directory filter`).
*   **Human-in-the-Loop Gate:** Halt the workflow execution path, render the current documentation drift balance to the console, and await formal user sign-off before selecting the next item on the implementation checklist.

### 3. Context-Window Bootstrapping & LLM Session Hardening
To prevent contextual drift, hallucinations, or unprompted code drops when initializing a brand-new session context window, the following enforcement triggers are active:
*   **The Zero-Code Boot Protocol:** The first response of any new session must strictly contain zero production or testing code. The LLM must output an ASCII summary of the active phase checklist, print the typographic anchor keys (`:::`, `==>`), and end immediately with `::: SYSTEM INITIALIZED. AWAITING USER COMMAND TO BEGIN PHASE X STEP Y :::`.
*   **The Invariant 25-Line Method Cap:** A "micro-chunk" is programmatically defined as a single logic block, method, or helper utility containing fewer than 25 lines of actual code execution. Generating multiple methods or exceeding this threshold in a single turn constitutes a workflow violation.
*   **The Blank Slate Constraint:** The LLM must assume zero local system state. It is strictly forbidden from importing local modules, referencing external helper utilities, or assuming files exist unless that exact file architecture has been written out in full text within the active context window boundaries.
*   **State Sign-Post Requirement:** Every code block response must explicitly display the absolute file target path as a markdown header (e.g., `### File Target: src/core/crawler.ts`) immediately before explaining the engineering "WHY".
