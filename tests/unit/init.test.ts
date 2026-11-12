/**
 * tests/unit/init.test.ts
 * 1-to-1 unit tests for `src/commands/init.ts`.
 * Verifies:
 * 1. Scaffolding of `uirig.config.json`, `.uirig/session.json`, and `.uirig/SKILL.md`.
 * 2. Content integrity of `DEFAULT_UIRIG_CONFIG` (including dark-mode budget and ignore rules)
 *    and `.uirig/SKILL.md` (6-engine suite, zero-config CLI, Shadow host & token remediation).
 * 3. Idempotent behavior (re-running `uirig init` does not overwrite existing files).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  executeInitCommand,
  DEFAULT_UIRIG_CONFIG,
  DEFAULT_UIRIG_SKILL_MD,
} from '../../src/commands/init.js';

describe('init.ts — Workspace & Agent Skill Scaffolder', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'uirig-init-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates uirig.config.json, .uirig/session.json, and .uirig/SKILL.md on first run', async () => {
    console.log('\n--- START TEST: Fresh Workspace Scaffolding (Config + Ledger + SKILL.md) ---');
    const configPath = join(tempDir, 'uirig.config.json');
    const ledgerPath = join(tempDir, '.uirig', 'session.json');
    const skillPath = join(tempDir, '.uirig', 'SKILL.md');

    expect(existsSync(configPath)).toBe(false);
    expect(existsSync(ledgerPath)).toBe(false);
    expect(existsSync(skillPath)).toBe(false);

    await executeInitCommand(tempDir);

    expect(existsSync(configPath)).toBe(true);
    expect(existsSync(ledgerPath)).toBe(true);
    expect(existsSync(skillPath)).toBe(true);

    const parsedConfig = JSON.parse(readFileSync(configPath, 'utf8')) as typeof DEFAULT_UIRIG_CONFIG;
    expect(parsedConfig.thresholdBudgets.overflowPixelTolerance).toBe(
      DEFAULT_UIRIG_CONFIG.thresholdBudgets.overflowPixelTolerance
    );
    expect(parsedConfig.thresholdBudgets.clsMaxLimit).toBe(
      DEFAULT_UIRIG_CONFIG.thresholdBudgets.clsMaxLimit
    );
    expect(parsedConfig.thresholdBudgets.darkModeMaxSurfaceLuminance).toBe(0.85);
    expect(parsedConfig.ignore).toEqual([]);

    const skillContent = readFileSync(skillPath, 'utf8');
    expect(skillContent).toBe(DEFAULT_UIRIG_SKILL_MD);
    expect(skillContent).toContain('npx uirig check --json');
    expect(skillContent).toContain('npx uirig ./dist/index.html --json');
    expect(skillContent).toContain('dark-mode');
    expect(skillContent).toContain('dom');
    expect(skillContent).toContain('hostComponent');
    expect(skillContent).toContain('suggestedToken');
    expect(skillContent).toContain('remediationAdvice');
  });

  it('preserves existing uirig.config.json and .uirig/SKILL.md when re-run (idempotency)', async () => {
    console.log('\n--- START TEST: Idempotent Re-Run Protection ---');
    const configPath = join(tempDir, 'uirig.config.json');
    const skillPath = join(tempDir, '.uirig', 'SKILL.md');

    await executeInitCommand(tempDir);

    // Simulate team customizations to both config and SKILL.md
    writeFileSync(configPath, '{"custom": true}', 'utf8');
    writeFileSync(skillPath, '# Custom Project Agent Skill\n', 'utf8');

    await executeInitCommand(tempDir);

    expect(readFileSync(configPath, 'utf8')).toBe('{"custom": true}');
    expect(readFileSync(skillPath, 'utf8')).toBe('# Custom Project Agent Skill\n');
  });
});
