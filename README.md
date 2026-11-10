# uirig

**The zero-config, framework-blind UI quality gate for CI/CD pipelines.**

`uirig` is a local CLI that connects directly to running web viewports inside isolated headless browser contexts to audit your interfaces against design token drift, illegible contrast failures, cumulative layout shifts, and responsive container breaks.

## 1. Unified Command Reference

### uirig init
*   **Syntax:** `uirig init`
*   **Description:** Scaffolds the localized `.uirig/` tracking paths and drops the primary single configuration profile file `uirig.config.json` into the root path directory.

### uirig check
*   **Syntax:** `uirig check [--config=<path>] [--reporter=github]`
*   **Description:** The primary composite execution command. Boots one single Playwright engine instance and runs the token compliance audits, accessibility contrast checks, layout stability observers, and geometric text expansion fuzzers concurrently across separate isolated browser contexts. Built-in layout and shift tolerance thresholds filter out anti-aliasing artifacts and font-rendering shifts to guarantee 100% rust-proof, non-flaky execution.
*   **Output:** Emits clean typographic pass/fail status tables to terminal consoles, and outputs a complete markdown report file to `.uirig/github_pr_comment.md` ready for pull-request integration loops.
