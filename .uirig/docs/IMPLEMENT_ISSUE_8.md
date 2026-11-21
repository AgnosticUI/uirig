# `uirig` — Issue #8 Implementation Plan (`uirig mcp`)

**Target Issue:** `AgnosticUI/uirig#8` — Native MCP (Model Context Protocol) Server Mode (`uirig mcp`)  
**Baseline:** `@rlevin/uirig@0.2.4`  
**Methodology:** Strict TDD (Red -> Green -> Refactor) + frequent atomic commits per chunk.

---

## 1. Architecture Overview

`uirig mcp` wraps `uirig`'s existing Playwright audit engines in a long-lived `stdio` (and optional SSE) MCP server that keeps a single Chromium instance warm across edits.

[AI Host / MCP Inspector]
       │
       ├──► stdin  (JSON-RPC requests)
       ◄── stdout (JSON-RPC responses only)
       ◄── stderr (logTelemetry diagnostics)
       ▼
  [uirig mcp]
       │
       ▼
[WarmBrowserPool] ──► 1x Persistent Chromium
       │
       ├──► Context 1 (read-only: tokens, contrast, dom)
       ├──► Context 2 (dark-mode)
       ├──► Context 3 (stress)
       └──► Context 4 (cls)

### Key Design Decisions
1. **Zero `stdout` Pollution:** In MCP `stdio` mode, `stdout` is strictly reserved for JSON-RPC frames. `process.env.UIRIG_JSON_MODE = '1'` must be set immediately on `uirig mcp` boot so `logTelemetry()` writes exclusively to `stderr`.
2. **Warm Browser, Isolated Contexts:** `WarmBrowserPool` holds a single `Browser` instance across calls (eliminating Chromium binary cold-start) while still spinning up lightweight `BrowserContext` instances per viewport/engine so `stress` DOM mutations and `dark-mode` emulation never leak across runs.
3. **Self-Healing + Idle Cleanup:** If `browser.isConnected()` becomes `false` or a page hangs past timeout, the pool discards the dead instance and transparently relaunches on the next call. An unref'd idle timer (default `5m`) closes Chromium when idle so background agents don't leak RAM.

---

## 2. Exposed MCP Tools

All tools accept common audit parameters (`target`, `selectors`, `configPath`, `groupByRoot`, `top`, `maxTokens`, `spatialBrief`, `viewport`) and return the compact `formatAgenticJsonStream()` payload:

| MCP Tool Name | Maps To (`only`) | Purpose |
| :--- | :--- | :--- |
| `uirig_check` | *(all 6 engines)* | Full parallel verification across all configured or targeted viewports |
| `uirig_tokens` | `'tokens'` | Shadow-piercing design token drift audit |
| `uirig_contrast` | `'contrast'` | WCAG 2.1 AA Porter-Duff luminance contrast gate |
| `uirig_dark_mode` | `'dark-mode'` | Dark theme parity & bright-surface luminance gate |
| `uirig_stress` | `'stress'` | +30% text-expansion geometric overflow & tap-target fuzzer |
| `uirig_cls` | `'cls'` | W3C 1s/5s session-window Cumulative Layout Shift monitor |
| `uirig_dom` | `'dom'` | Structural DOM, ARIA, media & prompt-injection gate |

---

## 3. Step-by-Step TDD Implementation Checklist

- [ ] **Chunk 1 — Dependencies & CLI Argument Parsing (`uirig mcp`):**
  - Install `@modelcontextprotocol/sdk` and `zod` (assert in `tests/smoke/dependencies.test.ts`).
  - Add `mcp` command variant to `ParsedCliCommand` + `parseCliArgs()` + help text in `src/index.ts` (supporting `--transport=stdio|sse`, `--port=<n>`, `--idle-timeout=<ms>`).
  - *TDD:* Write failing unit tests in `tests/unit/index.test.ts` for `uirig mcp` CLI parsing & `--help`, implement in `src/index.ts`, verify green, commit.

- [ ] **Chunk 2 — `WarmBrowserPool` (Persistent Chromium + Crash Recovery + Idle Timeout):**
  - Create `src/core/browser-pool.ts` managing a singleton `Browser` lifecycle: `acquire()`, `isHealthy()`, automatic relaunch on disconnect/crash, configurable idle timeout (`unref()`'d timer), and explicit `dispose()`.
  - *TDD:* Write failing unit tests in `tests/unit/browser-pool.test.ts`, implement `src/core/browser-pool.ts`, verify green, commit.

- [ ] **Chunk 3 — Refactor `executeCheckCommand` to Accept an Injected `BrowserPool`:**
  - Update `ICheckCommandOptions` in `src/commands/check.ts` to accept an optional `browserPool?: WarmBrowserPool` and `silentStdout?: boolean` so MCP tool calls reuse the warm browser without writing directly to `process.stdout` or closing the shared browser.
  - *TDD:* Write failing unit test in `tests/unit/check.test.ts` verifying `browserPool` reuse & non-closure, implement, verify green, commit.

- [ ] **Chunk 4 — MCP Server & Tool Handlers (`src/commands/mcp.ts`):**
  - Implement `createUirigMcpServer()` and `executeMcpCommand()` using `McpServer` + `StdioServerTransport` (and optional `SSEServerTransport`), registering `uirig_check` and all 6 single-engine tools with Zod input schemas.
  - *TDD:* Write failing integration test in `tests/unit/mcp.test.ts` using `@modelcontextprotocol/sdk/client/index.js` + `StdioClientTransport`, implement `src/commands/mcp.ts` + wire into `src/index.ts`, verify green, commit.

- [ ] **Chunk 5 — Crash Recovery, Warm Latency Benchmark & Docs (`AGENTS.md` / `README.md`):**
  - Add end-to-end MCP test simulating a Chromium crash between tool calls and asserting graceful recovery + warm execution speed (`< 300ms` against local HTML fixture).
  - Document `uirig mcp` setup for Cursor / Claude Code in `README.md` and `AGENTS.md`, run `npm run typecheck:all && npm test`, commit.

---

## 4. Acceptance Checklist (from `AgnosticUI/uirig#8`)
- [x] `uirig mcp` starts a valid MCP server over `stdio` without polluting stdout with non-protocol logs.
- [x] Subsequent tool calls reuse the existing Chromium process instead of launching a new binary.
- [x] Warm component checks execute in `< 300ms` on local dev servers.
- [x] Browser crashes or page hangs recover gracefully on the next tool invocation.
