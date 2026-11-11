# Technical Design Document (TDD): uirig System Architecture

---

## 1. Complete Software File Architecture

The following tree represents the framework-blind file system blueprint for the `uirig` open-source codebase. By executing all validation routines inside isolated browser contexts, it requires zero heavy file generation pipelines or language compilation weights.

```text
uirig/
├── .github/
│   └── workflows/
│       └── release.yml
├── .uirig/                         # Local workspace tracking directory
│   ├── docs/
│   │   └── NEXT_PROMPT.md          # Volatile chronological continuation capsule
│   ├── snapshots/
│   │   ├── .gitkeep
│   ├── github_pr_comment.md        # Standalone Markdown PR comment report artifact
│   └── session.json                # Immutable transaction tracking ledger
├── bin/
│   └── uirig                       # Global CLI executable entry router shell script
├── uirig.config.json               # Unified single configuration profile footprint
├── package.json                    # Project configuration and script manifest
├── src/
│   ├── index.ts                    # Main system entry and CLI argument parser
│   ├── commands/                   # 15 Tools CLI interaction wrapper handlers
│   │   ├── check.ts                # [MVP] Orchestrates parallel context tool validation runs
│   │   ├── init.ts                 # [MVP] Scaffolds uirig.config.json and .uirig/ ledger
│   │   └── manifest.ts             # Blackhole-safe repository filesystem crawler
│   ├── core/                       # Agnostic core domain evaluation logic
│   │   ├── adversary.ts            # [MVP] Playwright geometric stress execution core (stress)
│   │   ├── cls.ts                  # [MVP] PerformanceObserver runtime shift monitor (cls)
│   │   ├── matrix.ts               # [MVP] Rendered luminance contrast checking core (contrast)
│   │   ├── session.ts              # transaction lifecycle manager and SHA-256 validator
│   │   └── tokens.ts               # [MVP] Shadow-piercing computed style verification core (tokens)
│   ├── interfaces/                 # Shared data model type contracts
│   │   ├── browser.ts              # Headless automation driver token contracts
│   │   └── config.ts               # Configuration mapping boundaries and payload shapes
│   └── utils/                      # Low-overhead utility primitives
│       ├── formatter.ts            # Typographic console styler and agentic JSON stream router
│       └── fs.ts                   # Atomic filesystem handlers and markdown comment writers
├── tsconfig.json                   # ESM compilation target settings
└── tests/                          # Automated local testing validation manifest
    ├── unit/
    │   ├── matrix.test.ts          # Contrast luminance math unit tests
    │   └── tokens.test.ts          # Shadow-piercing crawler tree unit tests
    └── integration/
        └── workflow.test.ts        # End-to-end parallel incognito run check

```

---

## 2. Technical System Execution Data Flow

The architecture decouples individual quality tools into clean processing tracks. It routes calls through isolated browser contexts using a single running browser core binary to eliminate resource overhead.

```text
   [ uirig check ] ──► Ingests uirig.config.json parameters
                             │
                             ▼
                 Spawns Playwright Browser Instance
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  [ Context 1 ]       [ Context 2 ]       [ Context 3 ]
  - Read-Only Audits   - Mutated Fuzzing   - Performance Monitor
  - tokens.ts          - adversary.ts      - cls.ts
  - matrix.ts          (Text Expansion)    (PerformanceObserver)
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
         Compiles results array & writes to disk at:
                .uirig/github_pr_comment.md
```

---

## 3. Exact Data Model & Schema Definitions

All operations inside `uirig` track modifications inside `.uirig/session.json` and validate execution criteria directly against single configuration layers.

### 3.1 Session Tracking Schema (`.uirig/session.json`)
The fundamental state tracking ledger enforcing chronological synchronization integrity across the system.

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

### 3.2 Unified Configuration Schema (`uirig.config.json`)
Maps out target routes, design systems references, active viewports, and anti-flakiness tolerance filters.

```json
{
  "\$schema": "http://json-schema.org",
  "title": "uirigConfigurationProfile",
  "type": "object",
  "properties": {
    "targetUrls": {
      "type": "array",
      "items": { "type": "string", "format": "uri" }
    },
    "tokensPath": { "type": "string" },
    "thresholdBudgets": {
      "type": "object",
      "properties": {
        "clsMaxLimit": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.1 },
        "overflowPixelTolerance": { "type": "integer", "minimum": 0, "default": 2 },
        "touchTargetMinSpacingPx": { "type": "integer", "minimum": 0, "default": 24 }
      },
      "required": ["clsMaxLimit", "overflowPixelTolerance", "touchTargetMinSpacingPx"]
    },
    "viewports": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "width": { "type": "integer", "minimum": 320 },
          "height": { "type": "integer", "minimum": 480 }
        },
        "required": ["name", "width", "height"]
      }
    }
  },
  "required": ["targetUrls", "tokensPath", "thresholdBudgets", "viewports"]
}
```

---

## 4. Interface, API, & Pipeline Exit Contracts

### 4.1 Headless Browser Automation Contract
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
  init(headless: boolean): Promise<void>;
  loadLocalUrl(url: string): Promise<void>;
  injectTextFuzzing(selector: string, longString: string): Promise<void>;
  injectPaddingFuzzing(selector: string, paddingPx: number): Promise<void>;
  measureBoundingRects(childSelector: string, parentSelector: string): Promise<IElementGeometryNode>;
  inspectDOMRenderedContrast(): Promise<IComputedContrastPair[]>;
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
  remediationAdvice: string;
}

export interface IFuzzDiagnosticReporter {
  emitDiagnosticReport(violations: ILayoutViolation[]): void;
}

export interface ICLIArgumentPayload {
  command: string;
  args: string[];
  options: {
    config?: string;
    reporter?: 'github' | 'standard';
    json?: boolean; // True when called programmatically by an AI agent tool callout
  };
}

export interface ICLICommandRouter {
  dispatchRoute(payload: ICLIArgumentPayload): Promise<void>;
}
```

---

## 5. Technical Environment Boundaries

### 5.1 System POSIX Exit Code Specifications
All CLI engines return clean, non-ambiguous process diagnostics instantly to shell environments:
*   `0`: Success (All browser bounds, pixel metrics, and state ledger logs are valid).
*   `1`: Failure (Contrast failures below 4.5:1 ratio, bad code files, or SHA-256 checksum drifts).
*   `2`: Structural Break (Headless Playwright monitor detects elements breaching grid encapsulation boundaries).
