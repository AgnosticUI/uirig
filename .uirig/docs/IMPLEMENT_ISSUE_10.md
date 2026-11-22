# Implementation Plan: Issue #10 — Zero-Config Design Token Auto-Discovery (`--auto-tokens`)

- **Issue:** `AgnosticUI/uirig#10` — `Zero-Config Design Token Auto-Discovery (--auto-tokens)`
- **Branch:** `feat/issue-10-auto-tokens`
- **Status:** In Progress (Chunks 0–1 Complete)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Enable `uirig` to automatically discover design tokens from workspace files and live browser `:root` CSS custom properties when `--auto-tokens` is passed (or `autoTokens: true` in `uirig.config.json` / MCP tool arguments), allowing true zero-config `tokens` drift auditing and `suggestedToken` recommendations without requiring `uirig init` or a hand-authored `tokensPath` JSON file.

### Precedence & Scope Rules
1. **Explicit `tokensPath` Always Wins:** If `uirig.config.json` specifies `tokensPath` (or `tokenScaleOverride` is passed), `uirig` loads `tokensPath` as before and does not override it with auto-discovered tokens.
2. **File + Runtime Merge:** When `--auto-tokens` (or `config.autoTokens: true`) is active and no `tokensPath` is set, `uirig` merges:
   - **Workspace token files** (W3C Design Tokens `*.tokens.json`, Style Dictionary JSON token files, and Tailwind v4 `@theme` CSS blocks), AND
   - **Live `:root` CSS custom properties** (`--*`) scraped from the rendered page in Chromium.
3. **Value Normalization:** Colors are normalized via `colorjs.io` to `rgb(...)` / `rgba(...)` strings matching computed styles (`getComputedStyle`), and `rem`/`em` lengths are converted to `px` (`1rem = 16px`) so `validateComputedStyleEntry` and `findNearestPassingColorToken` match seamlessly.

### Out of Scope
- Executing arbitrary TypeScript/ESM `tailwind.config.ts` modules via dynamic `import()` (to avoid unsafe code execution on untrusted repos; static JSON/CSS token files and live `:root` computed styles cover Tailwind v4 `@theme`, W3C `.tokens.json`, Style Dictionary JSON, and any runtime CSS-in-JS/Tailwind variables cleanly).

---

## 2. Micro-Chunk Execution Breakdown

Each micro-chunk is small, testable, and committed immediately upon passing `npm run typecheck && npm test && npm run build`, followed by updating this checklist and `.uirig/docs/NEXT_PROMPT.md`.

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_10.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-10-auto-tokens`, save this implementation plan, and initialize the continuity capsule.
  - **Commit:** `docs(plan): add implementation plan and continuity capsule for issue #10 (--auto-tokens)`

- [x] **Chunk 1: Value Classifier & Normalizer (`classifyAndNormalizeTokenValue`) in `src/core/auto-tokens.ts` + Unit Tests**
  - **Files:** `src/core/auto-tokens.ts`, `tests/unit/auto-tokens.test.ts`
  - **Action:**
    - Create `src/core/auto-tokens.ts` with `classifyAndNormalizeTokenValue()` and `mergeTokenScales()` to normalize CSS colors (`hex`, `rgb`, `hsl`, `oklch` -> `rgb(...)`) and lengths (`px`, `rem` -> `px`) into `{ colors, spacing, fontSizes, radii }` buckets using token name hints (`radius`/`rounded`, `font`/`text`, `space`/`gap`/`padding`/`margin`, `color`/`bg`/`fg`/`surface`/`border`).
    - Write 1-to-1 unit tests in `tests/unit/auto-tokens.test.ts`.
  - **Commit:** `feat(tokens): add CSS token value classifier and scale merger in src/core/auto-tokens.ts`

- [ ] **Chunk 2: Workspace Token File Discovery (`discoverWorkspaceTokens`) in `src/core/auto-tokens.ts` + Unit Tests**
  - **Files:** `src/core/auto-tokens.ts`, `tests/unit/auto-tokens.test.ts`
  - **Action:**
    - Add `parseW3cOrStyleDictionaryTokens()`, `parseTailwindThemeCss()`, and `discoverWorkspaceTokens(cwd)` to scan safe workspace directories (skipping `BLOCKLIST_DIRECTORIES`) for `*.tokens.json`, Style Dictionary JSON files, and CSS `@theme { ... }` blocks.
    - Add 1-to-1 unit tests in `tests/unit/auto-tokens.test.ts` with temporary fixture files.
  - **Commit:** `feat(tokens): auto-discover W3C .tokens.json, Style Dictionary, and Tailwind v4 @theme files`

- [ ] **Chunk 3: Live Browser `:root` Custom Property Scraper (`extractRootCssVariables`) + Chromium Tests**
  - **Files:** `src/core/auto-tokens.ts`, `tests/unit/auto-tokens.test.ts`
  - **Action:**
    - Add `extractRootCssVariables(page)` to scrape `--*` custom properties from `:root` stylesheets and `getComputedStyle(document.documentElement)` in Playwright Chromium and normalize them into an `ITokenScaleConfig`.
    - Add live Chromium tests in `tests/unit/auto-tokens.test.ts`.
  - **Commit:** `feat(tokens): scrape live :root CSS custom properties in Chromium for --auto-tokens`

- [ ] **Chunk 4: CLI (`--auto-tokens`), Config (`autoTokens`), Check Dispatcher & MCP Integration**
  - **Files:** `src/commands/check.ts`, `src/index.ts`, `src/commands/mcp.ts`, `tests/unit/check.test.ts`, `tests/unit/cli.test.ts`
  - **Action:**
    - Wire `--auto-tokens` in `src/index.ts`, `autoTokens?: boolean` in `IUirigConfig` / `ICheckCommandOptions` (`src/commands/check.ts`), and `autoTokens` in `src/commands/mcp.ts`.
    - Ensure explicit `tokensPath` takes precedence over `--auto-tokens`, while `--auto-tokens` with no `tokensPath` populates `suggestedToken` in `contrast`/`dark-mode` and runs `tokens` drift checks.
    - Add unit & integration tests verifying precedence and zero-config `suggestedToken` output.
  - **Commit:** `feat(cli): wire --auto-tokens flag across check, standalone engines, and MCP`

- [ ] **Chunk 5: Docs Sync (`README.md`, `AGENTS.md`) & Final Verification**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_10.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:**
    - Document `--auto-tokens` in `README.md` and `AGENTS.md`.
    - Mark all chunks `[x]` complete in `.uirig/docs/IMPLEMENT_ISSUE_10.md` and update `.uirig/docs/NEXT_PROMPT.md`.
  - **Commit:** `docs: document --auto-tokens zero-config design token discovery (#10)`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#10`)
- [ ] Running `uirig check --auto-tokens` on a page with `:root` CSS variables populates `suggestedToken` recommendations with zero config files.
- [ ] Auto-detects Tailwind v4 `@theme` variables and standard W3C `.tokens.json` / Style Dictionary files if present in the repo.
- [ ] Explicit `tokensPath` configuration continues to take precedence over auto-discovered tokens.
- [ ] All unit/Chromium tests, typechecks, and builds pass, and docs are synced.
