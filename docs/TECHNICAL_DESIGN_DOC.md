# Technical Design Document (TDD): uirig System Architecture

---

## 1. Complete Software File Architecture

The following tree represents the exact, framework-agnostic file system blueprint for the `uirig` open-source codebase. By evaluating living runtime layout geometries directly inside an isolated browser environment, the codebase requires zero framework-specific AST compilers or transpilation wrappers.

```text
uirig/
├── .github/
│   └── workflows/
│       └── release.yml
├── .uirig/                         # Local workspace tracking directory
│   ├── snapshots/
│   │   ├── .gitkeep
│   ├── copy_paste_pack.md
│   └── session.json
├── bin/
│   └── uirig                       # Global CLI executable entrypoint script
├── config/
│   ├── default_tokens.json         # Enforces relational matrix parameters
│   └── templates/
│       ├── layout_base.html        # Wireframe base skeleton template file
│       └── handoff_capsule.md      # Portable markdown clipboard wrapper
├── package.json                    # Project configuration manifest
├── src/
│   ├── index.ts                    # Main system entry and command router
│   ├── commands/                   # 15 Tools CLI interaction handlers
│   │   ├── bleed.ts                # Padding stress fuzzer command
│   │   ├── blueprint.ts            # Structural boilerplate generator command
│   │   ├── break.ts                # [MVP] Text growth expansion fuzzer command
│   │   ├── checkout.ts             # [MVP] Snapshot time-travel controller command
│   │   ├── contrast.ts             # Rendered pixel contrast auditor command
│   │   ├── dev.ts                  # [MVP] Continuous live canvas monitor command
│   │   ├── flex.ts                 # Row overflow flex auditor command
│   │   ├── handoff.ts              # Portability context capsule builder command
│   │   ├── init.ts                 # [MVP] Workspace path initializer command
│   │   ├── layout.ts               # Grayscale blueprint generator command
│   │   ├── manifest.ts             # Blackhole-safe repository crawler command
│   │   ├── pack.ts                 # [MVP] Prompt text context compressor command
│   │   ├── paint.ts                # [MVP] JSON token styling controller command
│   │   ├── session-sync.ts         # [MVP] SIRP manual-edit ledger sync command
│   │   └── trace.ts                # Console wireframe ASCII trace command
│   ├── core/                       # Agnostic core domain logic
│   │   ├── adversary.ts            # Playwright browser evaluation manager
│   │   ├── compiler.ts             # Local JSON visual token palette mixer
│   │   ├── crawler.ts              # Blackhole-safe folder tree crawler
│   │   ├── matrix.ts               # Rendered text contrast math calculator
│   │   ├── orchestrator.ts         # WebSocket and file watcher runtime monitor
│   │   └── session.ts              # Transaction manager and checksum verifier
│   ├── interfaces/                 # Shared data model contracts
│   │   ├── browser.ts              # Headless telemetry layer
│   │   ├── config.ts               
│   │   ├── locator.ts              # [MVP] Agnostic telemetry tracking contracts
│   │   └── schema.ts               
│   └── utils/                      # Common tool primitives
│       ├── crypto.ts               # SHA-256 byte-hash calculators
│       ├── formatter.ts            # Alphanumeric console text stylers
│       └── fs.ts                   # Atomic filesystem file writers
├── tsconfig.json                   # ESM compilation settings
└── tests/                          # Automated local test suite manifest
    ├── mocks/
    │   ├── dummy_project/
    │   └── invalid_tokens.json
    ├── unit/
    │   ├── adversary.test.ts
    │   ├── locator.test.ts         # [MVP] Verification unit checks
    │   └── crawler.test.ts
    └── integration/
        └── workflow.test.ts
```

---

## 2. System Architecture & Runtime Data Flows

The toolchain functions as a **framework-blind inspection pipeline**. High-level tasks route down to standard browser validation environments via Playwright, communicating completely through decoupled metadata schemas to isolate processing burdens.

```text
  [ User Runs CLI Command ] ──► src/index.ts (Router Dispatch)
                                         │
                                         ▼
                             src/core/session.ts
                     (Verifies SHA-256 Checksum Matrix)
                                         │
                                         ▼
                             src/core/adversary.ts
                  (Spawns Headless Playwright Chrome Runner)
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
              [ Telemetry Read Phase ]        [ Diagnostic Phase ]
               - page.locator() scans DOM      - adversary.ts traps error
               - window.getComputedStyle()     - Extracts data-uirig-id
               - el.getBoundingClientRect()    - Prints stdout trace tables
```

### 2.1 In-Memory Architecture Flow Mapping

When a filesystem monitoring transaction or validation routine initiates, data shifts dynamically across three internal lifecycle structures:

1. **The Core Blueprint Initialization Stream:** Prompt strings or cell mapping distributions are parsed by the router and passed down to `src/core/compiler.ts`. The utility constructs an unstyled layout markup array containing base CSS Flexbox and Grid utility templates. Unique `data-uirig-id` structural tracking attributes are injected inline into all generated layout primitives to enable downstream element identification.
2. **The Swappable Token Engine Update Phase:** The working directory state ledger is cross-examined against recorded file history byte-hashes via `src/core/session.ts`. If no manual drift is found, visual variables inside `config/default_tokens.json` are overwritten or combined with style overrides, leaving the underlying component codes completely un-mutated.
3. **The Un-Networked Playwright Telemetry Pass:** Component instances are loaded into a serverless, headless Chromium instance. Once client hydration and rendering complete, testing vectors are fired inline. Element bounds are audited via browser computed styles and exact geometric layout checks (`getBoundingClientRect()`). On failure, the raw selector chain and tracking token parameters are passed instantly to stdout.
## 3. Exact Data Model & Schema Definitions

### 3.1 Session Tracking Schema (`.uirig/session.json`)
The fundamental state tracking ledger enforcing chronological synchronization integrity across all 15 system tools.

```json
{
  "\$schema": "http://json-schema.org",
  "title": "uirigSessionManifest",
  "type": "object",
  "properties": {
    "sessionId": { "type": "string", "format": "uuid" },
    "meta": {
      "type": "object",
      "properties": {
        "platform": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "required": ["platform", "createdAt", "updatedAt"],
      "additionalProperties": false
    },
    "history": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "step": { "type": "integer", "minimum": 1 },
          "command": { 
            "type": "string", 
            "enum": ["layout", "paint", "trace", "blueprint", "break", "contrast", "bleed", "flex", "init", "manifest", "dev", "session:sync", "checkout", "handoff", "pack"] 
          },
          "variantName": { "type": "string" },
          "filePointer": { "type": "string" },
          "checksum": { "type": "string", "pattern": "^[a-f0-9]{64}\$" },
          "timestamp": { "type": "string", "format": "date-time" },
          "status": { "type": "string", "enum": ["stable", "active", "drifting"] }
        },
        "required": ["step", "command", "variantName", "filePointer", "checksum", "timestamp", "status"],
        "additionalProperties": false
      }
    }
  },
  "required": ["sessionId", "meta", "history"],
  "additionalProperties": false
}
```

### 3.2 Design Token System Dictionary Schema (`config/default_tokens.json`)
Defines the style bounds, typography proportions, and absolute luminance color boundaries.

```json
{
  "\$schema": "http://json-schema.org",
  "title": "RelationalTokenMatrixDefinition",
  "type": "object",
  "properties": {
    "matrixConstraints": {
      "type": "object",
      "properties": {
        "minWcagContrastRatio": { "type": "number", "minimum": 4.5 },
        "enforceScaleLock": { "type": "boolean" },
        "harmonyMappings": {
          "type": "object",
          "properties": {
            "lightModeLock": { "type": "array", "items": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" } },
            "darkModeLock": { "type": "array", "items": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" } }
          },
          "required": ["lightModeLock", "darkModeLock"],
          "additionalProperties": false
        }
      },
      "required": ["minWcagContrastRatio", "enforceScaleLock", "harmonyMappings"],
      "additionalProperties": false
    },
    "density": { "type": "string", "enum": ["compact", "normal", "roomy"] },
    "colors": {
      "type": "object",
      "properties": {
        "canvas": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" },
        "surface": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" },
        "primary": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" },
        "accent": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" },
        "border": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" }
      },
      "required": ["canvas", "surface", "primary", "accent", "border"],
      "additionalProperties": false
    },
    "typography": {
      "type": "object",
      "properties": {
        "baseFamily": { "type": "string" },
        "headingFamily": { "type": "string" },
        "scale": { "type": "string", "enum": ["minor-third", "perfect-fourth", "golden-ratio"] }
      },
      "required": ["baseFamily", "headingFamily", "scale"],
      "additionalProperties": false
    },
    "geometry": {
      "type": "object",
      "properties": {
        "radiusBase": { "type": "string" },
        "borderWidthBase": { "type": "string" },
        "shadowBase": { "type": "string" }
      },
      "required": ["radiusBase", "borderWidthBase", "shadowBase"],
      "additionalProperties": false
    }
  },
  "required": ["matrixConstraints", "density", "colors", "typography", "geometry"],
  "additionalProperties": false
}
```
## 4. Interface, API, & Pipeline Exit Contracts

### 4.1 Interchangeable Browser Telemetry Driver contract
* **Path:** `src/interfaces/browser.ts`

```typescript
export interface IElementGeometryNode {
  x: number;
  y: number;
  width: number;
  height: number;
  selector: string;
}

export interface IComputedContrastPair {
  selector: string;
  foregroundRgb: string;
  backgroundRgb: string;
  contrastRatio: number;
}

export interface IHeadlessBrowserDriver {
  /**
   * Spawns the underlying un-networked browser thread instance.
   */
  init(headless: boolean): Promise<void>;

  /**
   * Mounts a local component or viewport directory URL into window spaces.
   */
  loadLocalUrl(url: string): Promise<void>;

  /**
   * Inject high-length string fuzzing variables directly into the document context.
   */
  injectTextFuzzing(selector: string, longString: string): Promise<void>;

  /**
   * Progressively modifies local component padding properties.
   */
  injectPaddingFuzzing(selector: string, paddingPx: number): Promise<void>;

  /**
   * Measures running layout elements via native bounding clients.
   */
  measureBoundingRects(childSelector: string, parentSelector: string): Promise<IElementGeometryNode>;

  /**
   * Walks text nodes to check foreground and opaque background color rendering parameters.
   */
  inspectDOMRenderedContrast(): Promise<IComputedContrastPair[]>;

  /**
   * Terminate open runner processing buckets securely to prevent resource leakage.
   */
  terminate(): Promise<void>;
}
```

### 4.2 Agnostic Telemetry Diagnostic Tracking Contract
* **Path:** `src/interfaces/locator.ts`

```typescript
export interface ILayoutViolation {
  elementId: string; // Matched via data-uirig-id metadata tracking attributes
  violationType: 'overflow' | 'clipping' | 'contrast_drop' | 'wrapping_overlap';
  offendingSelectorPath: string;
  measuredLeakPixels: number;
  reremediationAdvice: string;
}

export interface IFuzzDiagnosticReporter {
  /**
   * Receives violation arrays from browser monitors, maps parameters to the console
   * via clean typographic symbols, and triggers POSIX code 2 exit overrides.
   */
  emitDiagnosticReport(violations: ILayoutViolation[]): void;
}
```

---

## 5. Technical Environment Boundaries

### 5.1 System POSIX Exit Code Specifications
All CLI processing scripts pass exact exit diagnostics back to hosting continuous integration or shell environment runtimes:
*   `0`: Operational Success (All telemetry parameters, relative contrast balances, and ledger states hold perfect alignment).
*   `1`: General Operational Crash (Syntax error occurrences, invalid design tokens catalog schema configurations, or WCAG accessibility contrast drop failures).
*   `2`: Adversarial Execution Break (Playwright telemetry calculations discover container breaches, content clipping, or layout grid collapse).
