# LinkedIn

𝘂𝗶𝗿𝗶𝗴 𝗶𝘀 𝗹𝗶𝘃𝗲: 𝗧𝗵𝗲 𝗳𝗶𝗿𝘀𝘁 𝗹𝗶𝗻𝗲 𝗼𝗳 𝗱𝗲𝗳𝗲𝗻𝘀𝗲 𝗳𝗼𝗿 𝗔𝗜-𝗴𝗲𝗻𝗲𝗿𝗮𝘁𝗲𝗱 𝗨𝗜𝘀 𝗮𝗻𝗱 𝗪𝗲𝗯 𝗖𝗼𝗺𝗽𝗼𝗻𝗲𝗻𝘁𝘀

AI coding agents, AGENTS.md files, and Figma MCP servers give LLMs great context on how to build UI. But, context alone doesn't guarantee render quality.

uirig acts as a fast, zero-config guardrail: auditing live running viewports inside isolated headless Chromium contexts to catch design drift and layout breaks without brittle screenshot diffs (before you ever run a heavy axe-core audit or Lighthouse profile).

Run it immediately against any URL or standalone HTML file with zero setup:
npx uirig http://localhost:5173

▸ 𝘀𝗵𝗮𝗱𝗼𝘄-𝗽𝗶𝗲𝗿𝗰𝗶𝗻𝗴 𝘁𝗼𝗸𝗲𝗻 𝗮𝘂𝗱𝗶𝘁𝘀 (𝘂𝗶𝗿𝗶𝗴 𝘁𝗼𝗸𝗲𝗻𝘀)
Recursively walks Light DOM and open ShadowRoot trees to flag hardcoded colors, spacing, font sizes, and radii outside your design token scale (attributing failures directly to the host custom element).

▸ 𝗿𝗲𝗻𝗱𝗲𝗿𝗲𝗱 𝗹𝘂𝗺𝗶𝗻𝗮𝗻𝗰𝗲 & 𝗱𝗮𝗿𝗸-𝗺𝗼𝗱𝗲 𝗽𝗮𝗿𝗶𝘁𝘆 (𝘂𝗶𝗿𝗶𝗴 𝗰𝗼𝗻𝘁𝗿𝗮𝘀𝘁 & 𝗱𝗮𝗿𝗸-𝗺𝗼𝗱𝗲)
Composites ancestor alpha layers (Porter-Duff Source-Over), verifies WCAG 2.1 contrast (>= 4.5:1), catches surfaces stranded in light mode when dark theme toggles, and suggests the nearest passing design token.

▸ +𝟯𝟬% 𝘁𝗲𝘅𝘁-𝗲𝘅𝗽𝗮𝗻𝘀𝗶𝗼𝗻 & 𝗴𝗲𝗼𝗺𝗲𝘁𝗿𝘆 𝗳𝘂𝘇𝘇𝗲𝗿 (𝘂𝗶𝗿𝗶𝗴 𝘀𝘁𝗿𝗲𝘀𝘀)
Injects +30% longer text and long space-free strings (like emails and URLs) to catch container overflow, 100vw scrollbar bleed, squished flex avatars, and <24px tap targets.

▸ 𝘀𝗲𝘀𝘀𝗶𝗼𝗻-𝘄𝗶𝗻𝗱𝗼𝘄 𝗖𝗟𝗦 𝗺𝗼𝗻𝗶𝘁𝗼𝗿 (𝘂𝗶𝗿𝗶𝗴 𝗰𝗹𝘀)
Enforces W3C 1s/5s session-window Cumulative Layout Shift budgets across live page loads, catching unexpected layout jumps before users ever see them.

▸ 𝗱𝗼𝗺 & 𝗺𝗮𝗿𝗸𝘂𝗽 𝗶𝗻𝘁𝗲𝗴𝗿𝗶𝘁𝘆 𝗴𝗮𝘁𝗲 (𝘂𝗶𝗿𝗶𝗴 𝗱𝗼𝗺)
Catches the structural hallucinations AI agents make most:
  ◦ dangling aria-labelledby IDs
  ◦ unlabeled icon buttons
  ◦ broken images
  ◦ unsafe javascript: URIs
  ◦ hidden prompt-injection traps

▸ 𝗰𝗹𝗼𝘀𝗲𝗱-𝗹𝗼𝗼𝗽 𝗔𝗜 𝗵𝗮𝗿𝗻𝗲𝘀𝘀 𝗶𝗻𝘁𝗲𝗴𝗿𝗮𝘁𝗶𝗼𝗻
Agents like Claude Code, Cursor, and Codex can self-heal UI regressions before a human ever opens a browser using --json mode, which streams deduplicated violations with hostComponent attribution, suggestedToken fixes, and POSIX exit codes (0, 1, 2) to stdout.

#DesignSystems #FrontendEngineering #WebComponents #Playwright #AIEngineering #ContextEngineering #DevTools #Accessibility #OpenSource
