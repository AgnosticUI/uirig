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
  $schema: 'https://json-schema.org',
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
 * Teaches AI coding agents (Claude Code, Cursor, Codex) how to execute
 * `uirig` after UI edits and self-correct violations without context bloat.
 */
export const DEFAULT_UIRIG_SKILL_MD = `---
name: uirig-ui-verification
description: First-line-of-defense live-viewport UI quality gate for design tokens, light/dark contrast parity, geometric stress overflow, CLS, and DOM markup integrity.
---

# \`uirig\`: Deterministic UI Verification Gate

Run \`uirig\` after modifying HTML, CSS, Web Components, or UI templates to verify rendered quality in a real headless browser before running heavier audits (\`axe-core\`, Lighthouse).

## Closed-Loop Self-Healing Workflow

1. **Execute the deterministic JSON verification gate:**
   - Using \`uirig.config.json\` (when dev server is running):
     \`\`\`bash
     npx uirig check --json
     \`\`\`
   - Or directly against a URL or standalone \`.html\` file (zero-config mode):
     \`\`\`bash
     npx uirig http://localhost:5173 --json
     npx uirig ./dist/index.html --json
     \`\`\`
2. **Inspect \`stdout\` JSON & POSIX Exit Code:**
   - \`0\` (\`status: "pass"\`): All 6 engines (\`tokens\`, \`contrast\`, \`dark-mode\`, \`stress\`, \`cls\`, \`dom\`) and runtime JS checks passed. Task is complete.
   - \`1\`: Design token drift (\`tokens\`), light/dark WCAG contrast failure (\`contrast\`, \`dark-mode\`), DOM/ARIA/hygiene violation (\`dom\`), or uncaught runtime JS error.
   - \`2\`: Structural layout break (\`stress\`: container overflow, \`100vw\` scrollbar bleed, squished avatar, \`<24px\` tap target) or CLS budget breach (\`cls\`).
3. **Patch & Re-Verify:**
   - Iterate over deduplicated entries in \`violations[]\`.
   - Use \`hostComponent\`, \`offendingSelectorPath\`, \`suggestedToken\`, and \`remediationAdvice\` to patch source CSS or component templates.
   - Prefer \`suggestedToken\` CSS custom properties over hardcoded values whenever provided.
   - Re-run \`npx uirig check --json\` (or \`npx uirig <target> --json\`) until \`exitCode\` is \`0\`.
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
