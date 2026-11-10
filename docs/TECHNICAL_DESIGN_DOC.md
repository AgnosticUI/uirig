# Technical Design Document (TDD): uirig System Architecture

---

# Technical Design Document (TDD): uirig System Architecture

---

## 1. Complete Software File Architecture

The following tree represents the framework-agnostic file system blueprint for the `uirig` open-source codebase. By evaluating running layout geometries directly inside a browser instance, the engine requires zero framework-specific AST compilers or transpilation wrappers.

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
│   └── uirig                       # Global CLI executable shell router
├── config/
│   ├── default_tokens.json         # Enforces relational matrix parameters
│   └── templates/
│       ├── layout_base.html        # Wireframe base skeleton file
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
│   │   ├── healer.ts               # Metadata-driven source code text repairer
│   │   ├── matrix.ts               # Rendered text contrast math calculator
│   │   ├── orchestrator.ts         # WebSocket and file watcher runtime monitor
│   │   └── session.ts              # Transaction manager and checksum verifier
│   ├── interfaces/                 # Shared data model contracts
│   │   ├── browser.ts              # Headless telemetry abstraction layer
│   │   ├── config.ts               
│   │   ├── locator.ts              # [MVP] Agnostic file targeting metadata contract
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
       ┌─────────────────────────────────┴─────────────────────────────────┐
       ▼                                                                   ▼
 [ Telemetry Read Phase ]                                       [ Disk Repair Phase ]
  - page.locator() scans DOM                                     - healer.ts targets file
  - window.getComputedStyle()                                    - Matches data-uirig-id
  - el.getBoundingClientRect()                                   - Appends defensive class
```
## 3. Exact Data Model & Schema Definitions

### 3.1 Session Tracking Schema (`.uirig/session.json`)
Tracks execution checkpoints and handles chronological snapshot history state maps.

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
      "required": ["platform", "createdAt", "updatedAt"]
    },
    "history": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "step": { "type": "integer", "minimum": 1 },
          "command": { "type": "string" },
          "variantName": { "type": "string" },
          "filePointer": { "type": "string" },
          "checksum": { "type": "string", "pattern": "^[a-f0-9]{64}\$" },
          "timestamp": { "type": "string", "format": "date-time" },
          "status": { "type": "string", "enum": ["stable", "active", "drifting"] }
        },
        "required": ["step", "command", "variantName", "filePointer", "checksum", "timestamp", "status"]
      }
    }
  },
  "required": ["sessionId", "meta", "history"]
}
```

### 3.2 Design Token System Dictionary Schema (`config/default_tokens.json`)
The central style configuration definition file managing theme variables.

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
        "enforceScaleLock": { "type": "boolean" }
      },
      "required": ["minWcagContrastRatio", "enforceScaleLock"]
    },
    "colors": {
      "type": "object",
      "properties": {
        "canvas": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" },
        "surface": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" },
        "primary": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" },
        "accent": { "type": "string", "pattern": "^#([A-Fa-f0-9]{6})\$" }
      },
      "required": ["canvas", "surface", "primary", "accent"]
    }
  },
  "required": ["matrixConstraints", "colors"]
}
```
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

## 5. Technical Environment Boundaries

### 5.1 System POSIX Exit Code Specifications
All CLI engines return clean, non-ambiguous process diagnostics instantly to shell environments:
* `0`: Success (All browser bounds, pixel metrics, and state ledger logs are valid).
* `1`: Failure (Contrast failures below 4.5:1 ratio, bad code files, or SHA-256 checksum drifts).
* `2`: Structural Break (Headless Playwright monitor detects elements breaching grid encapsulation boundaries).
