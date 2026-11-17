# Implementation Plan: Issue #15 — Token-Budgeted & Priority-Ranked Output (`--top` / `--max-tokens`)

- **Issue:** `AgnosticUI/uirig#15` — `Token-Budgeted & Priority-Ranked Output (--top / --max-tokens)`
- **Pillar:** Pillar 2: Token & AI Cost Savers (`pillar: token-efficiency`, `cli`)
- **Status:** Planned (Chunk 0 — No code written yet)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Rank deduplicated violations by **structural blast radius** and support capping serialized output via `--top <n>` and `--max-tokens <budget>` so AI coding agents receive only the highest-impact, highest-signal defects without suffering "lost-in-the-middle" prompt degradation or malformed JSON truncation.

### Target CLI & JSON Contract
- **CLI flags (supported on `check`, standalone subcommands, and `uirig <url-or-file>`):**
  - `--top=<n>` / `--top <n>` (positive integer, e.g., `--top=5`)
  - `--max-tokens=<budget>` / `--max-tokens <budget>` (positive integer, e.g., `--max-tokens=1200`)
- **JSON stream output (`IAgenticJsonStreamPayload` in `src/utils/agent-stream.ts`):**
  - `violations` is always deterministically sorted by structural priority (even when `--top` / `--max-tokens` are omitted).
  - When truncation occurs (`truncatedCount > 0`), include top-level metadata:
    - `totalViolations`: total deduplicated violations before capping
    - `truncatedCount`: number of lower-priority violations omitted
- **Human console output (`formatConsoleAuditReport` / `executeCheckCommand`):**
  - When `--top` or `--max-tokens` caps output, print a clear truncation notice (e.g., `Showing top 5 of 24 deduplicated violations (19 omitted; re-run without --top/--max-tokens to inspect all).`).

### Out of Scope
- Cascading ancestor/rule grouping (covered by Issue #11 `--group-by-root`).
- Auto-fix unified diff generation (covered by Issue #13 `--fix` / `jsonPatch`).

---

## 2. Structural Blast-Radius Priority Model

Violations are ranked deterministically using a composite priority score (highest first):

1. **Engine / Structural Blast-Radius Tier (Primary Weight):**
   - `cls` (`cls_breach`) & `runtime` (`pageerror`, `console_error`): **100** (page-wide instability / runtime crash)
   - `stress` (`horizontal_scrollbar`, `container_overflow`, `squished_avatar`, `undersized_touch_target`, spacing collision, `stuck_invisible_element`): **80** (structural geometry break)
   - `contrast` & `dark-mode` (`contrast_drop`, `dark_mode_contrast_drop`, `stranded_light_surface`): **60** (legibility & theme failure)
   - `tokens` (`token_drift`): **40** (design-system drift)
   - `dom` (semantic/ARIA/hygiene defects): **20** (markup hygiene; elevated to **70** for prompt-injection traps)
2. **Occurrence Multiplier (Secondary Tie-Breaker):**
   - Higher `occurrenceCount` (e.g., a pattern affecting 12 cards) sorts ahead of single-instance violations within the same tier.
3. **Deterministic Lexicographical Tie-Breaker:**
   - `(viewport, selector, violationType)` ensures 100% reproducible ordering across runs.

### Token Estimation & Safe JSON Budgeting (`--max-tokens`)
- Uses a deterministic character-to-token heuristic (`Math.ceil(jsonString.length / 4)`) with zero heavy tokenizer dependencies.
- Iteratively packs highest-priority `IAgenticViolation` items into `IAgenticJsonStreamPayload` until adding the next item would exceed `maxTokens`, guaranteeing **100% valid, parseable JSON** every time (always keeping at least 1 top violation if `violations.length > 0` unless `maxTokens` is zero).
---

## 3. Micro-Chunk Execution Breakdown

Each micro-chunk is small, testable, and committed immediately upon passing `npm run build && npm run typecheck:all && npm test`, followed by updating this checklist and `.uirig/docs/NEXT_PROMPT.md`.

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_15.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Save this implementation plan and initialize the session continuity capsule for Issue #15.
  - **Commit:** `docs(plan): add implementation plan and continuity capsule for issue #15 (--top / --max-tokens)`

- **Chunk 1: Pure Priority Ranker & Token-Budget Truncator + Unit Tests**
  - **Files:** `src/utils/violation-budget.ts`, `tests/unit/violation-budget.test.ts`
  - **Action:**
    - Implement `scoreViolationPriority(violation)` and `rankViolationsByBlastRadius(violations)` following the structural blast-radius model (`Layout/CLS & Runtime > Stress > Contrast/Dark-Mode > Token Drift > DOM Hygiene`, plus `occurrenceCount` tie-breaker).
    - Implement `applyViolationBudget(violations, options: { top?: number; maxTokens?: number; basePayloadOverheadChars?: number })` returning `{ violations, totalViolations, truncatedCount }` while guaranteeing valid JSON bounds.
    - Add 1-to-1 unit specs in `tests/unit/violation-budget.test.ts` covering tier ordering, `occurrenceCount` tie-breaking, `--top` capping, `--max-tokens` budgeting, and empty/no-cap pass-throughs.
  - **Commit:** `feat(budget): add structural blast-radius ranker and token-budget truncator with unit tests`

- **Chunk 2: JSON Stream & Console Report Budget Integration**
  - **Files:** `src/utils/agent-stream.ts`, `src/commands/check.ts`, `tests/unit/agent-stream.test.ts`
  - **Action:**
    - Update `formatAgenticJsonStream(report, options?: { top?: number; maxTokens?: number })` to always rank violations by structural blast radius, apply `--top` / `--max-tokens` caps, and emit `totalViolations` + `truncatedCount` on `IAgenticJsonStreamPayload` whenever violations are truncated.
    - Wire `top?: number` and `maxTokens?: number` into `ICheckCommandOptions` and `executeCheckCommand()` in `src/commands/check.ts`, including a concise truncation summary in human console output when capped.
    - Add unit tests in `tests/unit/agent-stream.test.ts` verifying priority sorting, `totalViolations` / `truncatedCount` metadata, and guaranteed valid `JSON.parse()` output under tight `--max-tokens` budgets.
  - **Commit:** `feat(runner): integrate priority ranking and --top / --max-tokens budgets into JSON stream and check command`

- **Chunk 3: CLI Flag Parsing (`--top` / `--max-tokens`), Subcommand `--help` & Unit Tests**
  - **Files:** `src/index.ts`, `tests/unit/index.test.ts`
  - **Action:**
    - Parse `--top=<n>` / `--top <n>` and `--max-tokens=<budget>` / `--max-tokens <budget>` (validating positive integers and returning `unknown` with a clear error message on invalid/negative/non-numeric inputs).
    - Forward `top` and `maxTokens` into `executeCheckCommand()` in `runCli()`.
    - Document `--top=<n>` and `--max-tokens=<budget>` in `SHARED_AUDIT_OPTIONS`, `CLI_HELP_TEXT`, and subcommand examples.
    - Update `tests/unit/index.test.ts` for default `top: undefined, maxTokens: undefined`, valid flag parsing, invalid value rejection, and `--help` output.
  - **Commit:** `feat(cli): expose --top and --max-tokens flags with validation and help docs`

- **Chunk 4: Docs Sync & Next-Issue Capsule Handoff**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_15.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:**
    - Document `--top=<n>` and `--max-tokens=<budget>` in `README.md` and `AGENTS.md`.
    - Mark all chunks `[x]` complete in `.uirig/docs/IMPLEMENT_ISSUE_15.md` and point `.uirig/docs/NEXT_PROMPT.md` to the next roadmap issue (`#11` `--group-by-root` or `#17` Web Component `<slot>` integrity).
  - **Commit:** `docs: document --top and --max-tokens flags and update session continuity capsule`

---

## 4. Acceptance Checklist (from `AgnosticUI/uirig#15`)
- Violations are deterministically ordered from highest structural blast radius to lowest.
- `--top <n>` returns at most `n` violations plus `totalViolations` and `truncatedCount` metadata when truncated.
- `--max-tokens <budget>` keeps serialized JSON output within the estimated token limit without ever producing malformed JSON.
- Invalid flag values (`--top=0`, `--top=-3`, `--max-tokens=abc`) fail fast with POSIX exit code `1` and a clear CLI error message.
- All unit and integration tests pass with zero `any` or `@ts-ignore`.
