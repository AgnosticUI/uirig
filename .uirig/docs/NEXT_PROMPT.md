# Session Continuity: Playground DX Polish -> `v0.3.0` npm Release

## Current Context
- **Repository:** `AgnosticUI/uirig`
- **Active Branch:** `main` (clean working tree; `package.json`, `package-lock.json`, and `src/commands/mcp.ts` are bumped to `0.3.0`)
- **Release Status:** **PAUSED before `npm publish`** — `npm run release` (dry-run) succeeded, and we intentionally halted `npm run release:publish` to polish the interactive playground (`playground/`) and its documentation first. Once the 3 playground DX issues below are merged into `main`, proceed directly to `npm run release:publish` + `npm dist-tag` verification!

## What Is Already Merged on `main` (Ready for `v0.3.0`)
- [x] **Computed AX Tree Snapshot (`#19`):** Native Chromium CDP `Accessibility.getFullAXTree` (`ax_empty_name`, `ax_hidden_focus`)
- [x] **Universal `<a2ui-surface>` Attribution & Multi-Theme Matrix (`#31`):** `<a2ui-surface>` / `[data-a2ui-surface]` attribution + `--themes`
- [x] **Support Center Studio Eval Gate & Self-Healing Demo (`#32`):** Always-On Detection + Opt-In 2-turn A2UI v1.0 `updateComponents` convergence loop
- [x] **Framework Source-Map & `file:line` Attribution (`#9`):** Base64 VLQ Source Map v3 decoder, `data-source-loc`, and CDP `CSS.getMatchedStylesForNode`
- [x] **Deterministic Auto-Fix Patch Generation (`#13`):** `unifiedDiff` in `--json` mode and opt-in `--fix` disk patching + re-verification
- [x] **Incremental Git-Diff Component Scoping (`#14`):** `--changed`, `--base=<ref>`, server-rendered templates, and `changedPaths` (`include` / `exclude`)
- [x] **MCP Server Parity & Native A2UI Tools (`#37`):** Full `themes`, `changed`, `baseRef`, `fix`, `cwd` parity + `uirig_a2ui_delta` & `uirig_discover_tokens`
- [x] **Google Modern Web Guidance Workflow & Draft 2020-12 Schema (`#30`):** Updated `README.md`, `DEFAULT_UIRIG_SKILL_MD`, and `https://json-schema.org`
- [x] **Initial Playground v0.3.0 Fixtures:** Added Section 3 (`#a2ui-ax-traps`) to `playground/index.html` and 6-engine + v0.3.0 checks to `playground/src/check.ts`

## Next Session Tasks (In Order)
1. **Issue A — Clean Up Playground Signal-to-Noise & Add CSS Source-Map Attribution (`playground/index.html`):**
   - Increase spacing in Section 1 (`#baseline-card`) so `<ag-input>` and `<ag-button>` have **0** touch-target collisions under `stress`.
   - Style Section 3 (`#a2ui-unlabeled-close-btn` and `#a2ui-source-mapped-link`) with AgnosticUI CSS variables so they do not emit 12 accidental UA-default token errors.
   - Move `#contrast-token-trap` styles into a source-mapped stylesheet (or source-mapped rule) so real CSS `sourceFile:lineNumber` resolves in live runs.
2. **Issue B — Upgrade Playground Terminal DX (`playground/src/check.ts`):**
   - Show `sourceFile:lineNumber`, `hostComponent`, `a2ui` component IDs, `suggestedToken`, dark-mode violation details, and the actual `unifiedDiff` snippet in `formatSpotCheckSummary()`.
   - Add a **Try Next** footer above `[playground:dev] Watching for file edits...` explaining that Sections 2 & 3 are deliberate traps and showing 3 copy-pasteable CLI commands (`--json`, `--themes`, `--fix`) to run against `http://localhost:5173`.
   - Update `tests/unit/playground-fixtures.test.ts` and `tests/integration/playground.test.ts`.
3. **Issue C — Guided Playground Walkthrough in `README.md`:**
   - Expand `### 5. Local Development & Playground` in `README.md` with a 3-step hands-on walkthrough (`npm run playground:dev`, running `--json` / `--fix` against `http://localhost:5173`, and live-reload fixing).
4. **Publish `v0.3.0` to npm & GitHub:**
   - Once Issues A–C are merged into `main`, run:
     ```bash
     npm run release
     npm run release:publish
     npm dist-tag add @rlevin/uirig@0.3.0 latest
     npm dist-tag add @rlevin/uirig@0.3.0 next
     npm dist-tag ls @rlevin/uirig
     ```
   - Create the `v0.3.0` GitHub Release (`gh release create v0.3.0 --repo AgnosticUI/uirig ...`).
