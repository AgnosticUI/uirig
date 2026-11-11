# uirig

**The zero-config, framework-blind UI quality gate for CI/CD pipelines.**

`uirig` is a local CLI that connects directly to running web viewports inside isolated headless browser contexts to audit your interfaces against design token drift, illegible contrast failures, cumulative layout shifts, and responsive container breaks.

## 1. Unified Command Reference

### uirig init
*   **Syntax:** `uirig init`
*   **Description:** Scaffolds the localized `.uirig/` tracking paths and drops the primary single configuration profile file `uirig.config.json` into the root path directory.

### uirig check
*   **Syntax:** `uirig check [--config=<path>] [--reporter=github] [--json]`
*   **Description:** Executes the core suite. When `--json` is appended, suppresses terminal tables and streams raw machine-readable JSON error tokens to stdout so agents can parse and fix layouts natively.
