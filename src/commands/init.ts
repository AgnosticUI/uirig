/**
 * src/commands/init.ts
 * CLI command controller initializing workspace sandbox structures.
 * Scaffolds:
 * 1. `uirig.config.json` (unified configuration & threshold budgets)
 * 2. `.uirig/session.json` (immutable SHA-256 transaction ledger)
 * 3. `.uirig/SKILL.md` (agent-ready self-healing verification loop instructions)
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { atomicWriteFile } from '../utils/fs.js';
import { logTelemetry, paint } from '../utils/formatter.js';

export const DEFAULT_UIRIG_CONFIG = {
  $schema: 'https://json-schema.org',
  targetUrls: ['http://localhost:3000'],
  tokensPath: './config/default_tokens.json',
  thresholdBudgets: {
    clsMaxLimit: 0.1,
    overflowPixelTolerance: 2,
    touchTargetMinSpacingPx: 24,
  },
  viewports: [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'desktop', width: 1440, height: 900 },
  ],
};

/**
 * Agent-ready skill manual emitted to `.uirig/SKILL.md` on `uirig init`.
 * Teaches AI coding agents (Claude Code, Cursor, Codex) how to execute
 * `uirig check --json` after UI edits and self-correct violations without context bloat.
 */
export const DEFAULT_UIRIG_SKILL_MD = `---
name: uirig-ui-verification
description: Deterministic live-viewport UI quality gate for design tokens, WCAG 2.1 contrast, +30% text-expansion stress overflow, and Cumulative Layout Shift (CLS).
---

# \`uirig\` — Deterministic UI Verification Gate

Run \`uirig\` after modifying HTML, CSS, Web Components, or UI templates to verify rendered quality in a real headless browser without screenshot diffs.

## Closed-Loop Self-Healing Workflow

1. **Ensure the local dev server is running** on the URL(s) configured in \`uirig.config.json\` (\`targetUrls\`).
2. **Execute the deterministic JSON verification gate:**
   \`\`\`bash
   npx uirig check --json
   \`\`\`
3. **Inspect \`stdout\` JSON & POSIX Exit Code:**
   - \`0\` (\`passed: true\`): All 4 engines (\`tokens\`, \`contrast\`, \`stress\`, \`cls\`) passed. Task is complete.
   - \`1\`: Design token drift (\`token_drift\`) or WCAG 2.1 contrast failure (\`contrast_drop\` < 4.5:1).
   - \`2\`: Structural layout break (\`container_overflow\`, \`horizontal_scrollbar\`, \`touch_target_collision\`) or CLS budget breach (\`cls_breach\`).
4. **Patch & Re-Verify:**
   - Iterate over \`violations[]\` in the JSON output.
   - Use \`selector\`, \`inShadowDom\`, \`measuredDelta\`, and \`remediationAdvice\` to fix each defect in source CSS/components.
   - Re-run \`npx uirig check --json\` until \`exitCode\` is \`0\`.
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

  // 1. Scaffold uirig.config.json with default layout tolerances if absent
  if (!existsSync(configPath)) {
    atomicWriteFile(configPath, JSON.stringify(DEFAULT_UIRIG_CONFIG, null, 2));
    logTelemetry('init:config', `Generated configuration footprint: ${paint('uirig.config.json', 'cyan')}`);
  }

  // 2. Scaffold .uirig/session.json pristine tracking state ledger if absent
  if (!existsSync(ledgerPath)) {
    const initialLedger = {
      $schema: 'https://json-schema.org',
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

  // 3. Scaffold .uirig/SKILL.md so AI coding agents have immediate self-healing instructions
  if (!existsSync(skillPath)) {
    atomicWriteFile(skillPath, DEFAULT_UIRIG_SKILL_MD);
    logTelemetry('init:skill', `Generated AI agent skill manual: ${paint('.uirig/SKILL.md', 'cyan')}`);
  }

  logTelemetry('init:complete', 'Workspace runtime environment successfully bootstrapped.');
}
