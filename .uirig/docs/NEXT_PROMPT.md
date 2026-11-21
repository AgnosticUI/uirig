# Session Continuity Handoff Prompt (`AgnosticUI/uirig#8`)

Copy and paste this prompt into a fresh session to resume seamlessly:

---

> We are implementing **Issue #8 (`uirig mcp` — Native MCP Server Mode)** in `AgnosticUI/uirig`.
>
> **Current State:**
> - Plan & progress checklist live in `.uirig/docs/IMPLEMENT_ISSUE_8.md`.
> - Review `.uirig/docs/IMPLEMENT_ISSUE_8.md` to see which checkboxes `[x]` are complete and which `[ ]` chunk is next.
>
> **Working Rules:**
> 1. Work iteratively **one chunk at a time** following strict TDD: write failing test -> run Vitest to see red -> implement minimal SUT code -> watch Vitest go green -> update checkboxes in `.uirig/docs/IMPLEMENT_ISSUE_8.md` -> `git commit`.
> 2. Explain the code clearly using ASCII/Mermaid diagrams where helpful.
> 3. Whenever you need to inspect files, output a single bash snippet that redirects to `~/Downloads/cat.txt`.
>
> Let's inspect `.uirig/docs/IMPLEMENT_ISSUE_8.md` and the files for the next unchecked chunk.
