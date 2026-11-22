/**
 * src/commands/init.ts
 * CLI command controller initializing workspace sandbox structures.
 * Scaffolds:
 * 1. `uirig.config.json` (unified configuration, threshold budgets & ignore rules)
 * 2. `.uirig/session.json` (immutable SHA-256 transaction ledger)
 * 3. `.uirig/SKILL.md` (agent-ready self-healing verification loop instructions)
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { atomicWriteFile } from '../utils/fs.js';
import { logTelemetry, paint } from '../utils/formatter.js';

export const DEFAULT_UIRIG_CONFIG = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  targetUrls: ['http://localhost:3000'],
  tokensPath: './config/default_tokens.json',
  thresholdBudgets: {
    clsMaxLimit: 0.1,
    overflowPixelTolerance: 2,
    touchTargetMinSpacingPx: 24,
    darkModeMaxSurfaceLuminance: 0.85,
  },
  viewports: [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'desktop', width: 1440, height: 900 },
  ],
  ignore: [],
};

/**
 * Agent-ready skill manual emitted to `.uirig/SKILL.md` on `uirig init`.
 * Teaches AI coding agents (Claude Code, Cursor, Codex) how to pair static
 * Google Modern Web Guidance (Agent Skill + CLI) with live `uirig` runtime verification.
 */
export const DEFAULT_UIRIG_SKILL_MD = `---
name: uirig-ui-verification
description: First-line-of-defense live-viewport UI quality gate for design tokens, light/dark contrast parity, geometric stress overflow, CLS, and DOM/AX integrity.
---

# \`uirig\` (\`@rlevin/uirig\`): Deterministic UI Verification Gate

Run \`uirig\` after modifying HTML, CSS, Web Components, or UI templates to verify rendered quality in a real headless browser before running heavier audits (\`axe-core\`, Lighthouse).

## Closed-Loop Agent Workflow

1. **Static Authoring & Refactoring with Google Modern Web Guidance (Agent Skill + CLI):**
   - When the **Google Modern Web Guidance** skill/CLI (\`npx modern-web-guidance\`) is installed, query it before authoring new UI patterns (\`search\` / \`retrieve\`) or run \`legacy-scan\` when modernizing existing source files so code targets project Baseline standards.
2. **Live Runtime Verification with \`uirig\` (MCP Server + CLI — Mandatory Gate):**
   - Run the deterministic JSON verification gate using \`uirig.config.json\` or directly against a URL / standalone \`.html\` file:
     \`\`\`bash
     npx @rlevin/uirig check --json
     npx @rlevin/uirig http://localhost:3000 --auto-tokens --group-by-root --spatial-brief --top=5 --json
     npx @rlevin/uirig ./dist/index.html --json
     \`\`\`
   *(Replace \`http://localhost:3000\` with your dev server URL, e.g. \`http://localhost:5173\`. If \`@rlevin/uirig\` is already installed in \`node_modules\`, \`npx uirig ...\` works interchangeably.)*
3. **Inspect \`stdout\` JSON & POSIX Exit Code:**
   - \`0\` (\`"passed": true\`): All 6 engines (\`tokens\`, \`contrast\`, \`dark-mode\`, \`stress\`, \`cls\`, \`dom\`) and runtime JS checks passed. Task is complete.
   - \`1\`: Design token drift (\`tokens\`), light/dark WCAG contrast failure (\`contrast\`, \`dark-mode\`), DOM/ARIA/computed AX tree (\`ax_empty_name\`, \`ax_hidden_focus\`) violation (\`dom\`), or uncaught runtime JS error.
   - \`2\`: Structural layout break (\`stress\`: container overflow, \`100vw\` scrollbar bleed, squished avatar, \`<24px\` tap target) or CLS budget breach (\`cls\`).
4. **Patch & Re-Verify:**
   - Inspect \`violations[]\` using \`hostComponent\`, \`a2ui\`, \`sourceFile\` / \`lineNumber\`, \`unifiedDiff\`, \`selector\`, \`suggestedToken\`, and \`remediationAdvice\`.
   - Prefer \`suggestedToken\` CSS custom properties over hardcoded values, and re-run \`uirig\` until \`exitCode\` is \`0\`.
`;

/**
 * Bootstraps the local `uirig` workspace configuration, session ledger, and `.uirig/SKILL.md`.
 * Safe to run repeatedly: existing files are never overwritten.
 *
 * @param targetDir - Root workspace directory (defaults to `process.cwd()`).
 */
export async function executeInitCommand(targetDir: string = process.cwd()): Promise<void> {
  logTelemetry('init:boot', 'Initializing uirig workspace runtime boundaries...');

  const configPath = resolve(targetDir, 'uirig.config.json');
  const ledgerPath = resolve(targetDir, '.uirig/session.json');
  const skillPath = resolve(targetDir, '.uirig/SKILL.md');

  if (!existsSync(configPath)) {
    atomicWriteFile(configPath, JSON.stringify(DEFAULT_UIRIG_CONFIG, null, 2));
    logTelemetry('init:config', `Generated configuration footprint: ${paint('uirig.config.json', 'cyan')}`);
  }

  if (!existsSync(ledgerPath)) {
    const initialLedger = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      sessionId: randomUUID(),
      meta: {
        platform: 'agnostic-telemetry',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      history: [],
    };

    atomicWriteFile(ledgerPath, JSON.stringify(initialLedger, null, 2));
    logTelemetry('init:ledger', `Generated transaction ledger: ${paint('.uirig/session.json', 'cyan')}`);
  }

  if (!existsSync(skillPath)) {
    atomicWriteFile(skillPath, DEFAULT_UIRIG_SKILL_MD);
    logTelemetry('init:skill', `Generated AI agent skill manual: ${paint('.uirig/SKILL.md', 'cyan')}`);
  }

  logTelemetry('init:complete', 'Workspace runtime environment successfully bootstrapped.');
}
