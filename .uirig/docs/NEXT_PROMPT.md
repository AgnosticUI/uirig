# Session Continuity: Guided Playground Walkthrough (`#46`) -> `v0.3.0` npm Release

## Current Context
- **Repository:** `AgnosticUI/uirig`
- **Active Branch:** `main` (`package.json`, `package-lock.json`, and `src/commands/mcp.ts` are bumped to `0.3.0`)
- **Release Status:** **PAUSED before `npm publish`** — `npm run release` (dry-run) succeeded, and we intentionally halted `npm run release:publish` to polish the interactive playground (`playground/`) and its documentation first. Once [`#46`](https://github.com) is merged into `main`, proceed directly to `npm run release:publish` + `npm dist-tag` verification!

## What Is Already Merged on `main` (Ready for `v0.3.0`)
- [x] **Computed AX Tree Snapshot ([#19](https://github.com)):** Native Chromium CDP `Accessibility.getFullAXTree` (`ax_empty_name`, `ax_hidden_focus`)
- [x] **Universal `<a2ui-surface>` Attribution & Multi-Theme Matrix ([#31](https://github.com)):** `<a2ui-surface>` / `[data-a2ui-surface]` attribution + `--themes`
- [x] **Support Center Studio Eval Gate & Self-Healing Demo ([#32](https://github.com)):** Always-On Detection + Opt-In 2-turn A2UI v1.0 `updateComponents` convergence loop
- [x] **Framework Source-Map & `file:line` Attribution ([#9](https://github.com)):** Base64 VLQ Source Map v3 decoder, `data-source-loc`, and CDP `CSS.getMatchedStylesForNode`
- [x] **Deterministic Auto-Fix Patch Generation ([#13](https://github.com)):** `unifiedDiff` in `--json` mode and opt-in `--fix` disk patching + re-verification
- [x] **Incremental Git-Diff Component Scoping ([#14](https://github.com)):** `--changed`, `--base=<ref>`, server-rendered templates, and `changedPaths` (`include` / `exclude`)
- [x] **MCP Server Parity & Native A2UI Tools ([#37](https://github.com)):** Full `themes`, `changed`, `baseRef`, `fix`, `cwd` parity + `uirig_a2ui_delta` & `uirig_discover_tokens`
- [x] **Google Modern Web Guidance Workflow & Draft 2020-12 Schema ([#30](https://github.com)):** Updated `README.md`, `DEFAULT_UIRIG_SKILL_MD`, and `https://json-schema.org`
- [x] **Initial Playground v0.3.0 Fixtures:** Added Section 3 (`#a2ui-ax-traps`) to `playground/index.html` and 6-engine + v0.3.0 checks to `playground/src/check.ts`
- [x] **[#44](https://github.com) — Clean Up Playground Signal-to-Noise & Add CSS Source-Map Attribution:** Eliminated Section 1 touch-target noise, bound Section 3 (`#a2ui-unlabeled-close-btn` and `#a2ui-source-mapped-link`) to AgnosticUI `--ag-*` tokens, and moved `#contrast-token-trap` into source-mapped `playground/src/traps.css`.
- [x] **[#45](https://github.com) — Upgrade Playground Terminal DX (`playground/src/check.ts`):** Added `sourceFile:lineNumber`, `hostComponent`, `a2ui` component IDs, `suggestedToken`, remediation hints, dark-mode violation lines, `unifiedDiff` preview, and a **Try Next** footer to `formatSpotCheckSummary()`.

## Next Session Tasks (In Order)
1. **[#46](https://github.com) — Guided Playground Walkthrough in `README.md`:**
   - Expand `### 5. Local Development & Playground` in `README.md` with a 3-step hands-on walkthrough (`npm run playground:dev`, running `--json` / `--fix` against `http://localhost:5173`, and live-reload fixing).
2. **Publish `v0.3.0` to npm & GitHub:**
   - Once [`#46`](https://github.com) is merged into `main`, run:
     ```bash
     npm run release
     npm run release:publish
     npm dist-tag add @rlevin/uirig@0.3.0 latest
     npm dist-tag add @rlevin/uirig@0.3.0 next
     npm dist-tag ls @rlevin/uirig
     ```
   - Create the `v0.3.0` GitHub Release (`gh release create v0.3.0 --repo AgnosticUI/uirig ...`).
