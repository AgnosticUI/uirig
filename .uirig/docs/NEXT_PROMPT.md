# Session Continuity: Publish `v0.3.0` to npm & GitHub

## Current Context
- **Repository:** `AgnosticUI/uirig`
- **Active Branch:** `main` (`package.json`, `package-lock.json`, and `src/commands/mcp.ts` are bumped to `0.3.0`)
- **Release Status:** **READY TO PUBLISH `v0.3.0`** — All feature PRs and playground polish issues ([`#44`](https://github.com), [`#45`](https://github.com), [`#46`](https://github.com)) are merged into `main`.

## What Is Merged on `main` (Complete `v0.3.0` Scope)
- [x] **Computed AX Tree Snapshot ([#19](https://github.com)):** Native Chromium CDP `Accessibility.getFullAXTree` (`ax_empty_name`, `ax_hidden_focus`)
- [x] **Universal `<a2ui-surface>` Attribution & Multi-Theme Matrix ([#31](https://github.com)):** `<a2ui-surface>` / `[data-a2ui-surface]` attribution + `--themes`
- [x] **Support Center Studio Eval Gate & Self-Healing Demo ([#32](https://github.com)):** Always-On Detection + Opt-In 2-turn A2UI v1.0 `updateComponents` convergence loop
- [x] **Framework Source-Map & `file:line` Attribution ([#9](https://github.com)):** Base64 VLQ Source Map v3 decoder, `data-source-loc`, and CDP `CSS.getMatchedStylesForNode`
- [x] **Deterministic Auto-Fix Patch Generation ([#13](https://github.com)):** `unifiedDiff` in `--json` mode and opt-in `--fix` disk patching + re-verification
- [x] **Incremental Git-Diff Component Scoping ([#14](https://github.com)):** `--changed`, `--base=<ref>`, server-rendered templates, and `changedPaths` (`include` / `exclude`)
- [x] **MCP Server Parity & Native A2UI Tools ([#37](https://github.com)):** Full `themes`, `changed`, `baseRef`, `fix`, `cwd` parity + `uirig_a2ui_delta` & `uirig_discover_tokens`
- [x] **Google Modern Web Guidance Workflow & Draft 2020-12 Schema ([#30](https://github.com)):** Updated `README.md`, `DEFAULT_UIRIG_SKILL_MD`, and `https://json-schema.org`
- [x] **[#44](https://github.com) — Clean Up Playground Signal-to-Noise & Add CSS Source-Map Attribution:** Eliminated Section 1 touch-target noise, bound Section 3 to AgnosticUI `--ag-*` tokens, and moved `#contrast-token-trap` into source-mapped `playground/src/traps.css`.
- [x] **[#45](https://github.com) — Upgrade Playground Terminal DX (`playground/src/check.ts`):** Added `sourceFile:lineNumber`, `hostComponent`, `a2ui` component IDs, `suggestedToken`, remediation hints, dark-mode violation lines, `unifiedDiff` preview, and a **Try Next** footer to `formatSpotCheckSummary()`.
- [x] **[#46](https://github.com) — Guided Playground Walkthrough in `README.md`:** Expanded `### 5. Local Development & Playground` with a 3-step hands-on walkthrough (`npm run playground:dev`, `--json` / `--themes` / `--fix` against `http://localhost:5173`, and live-reload self-healing).

## Next Session Tasks (Publish `v0.3.0`)
1. **Run Final Verification & Publish `v0.3.0` to npm:**
   ```bash
   npm run release
   npm run release:publish
   npm dist-tag add @rlevin/uirig@0.3.0 latest
   npm dist-tag add @rlevin/uirig@0.3.0 next
   npm dist-tag ls @rlevin/uirig
   ```
2. **Create the `v0.3.0` GitHub Release:**
   ```bash
   gh release create v0.3.0 --repo AgnosticUI/uirig --title "v0.3.0" --generate-notes
   ```
