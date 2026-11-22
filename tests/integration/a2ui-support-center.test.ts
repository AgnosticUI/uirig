/**
 * tests/integration/a2ui-support-center.test.ts
 * Integration specs for AgnosticUI Support Center Studio Eval Gate & Self-Healing Demo (Issue #32).
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { executeCheckCommand } from '../../src/commands/check.js';
import { formatAgenticJsonStream, type IAgenticJsonStreamPayload } from '../../src/utils/agent-stream.js';
import {
  buildA2uiUpdateComponentsDelta,
  createBrokenSupportCenterSurfaceFixture,
  renderSupportCenterSurfaceHtml,
  runA2uiSelfHealingLoop,
} from '../../src/utils/a2ui-self-heal.js';

describe('::: ISSUE #32 (CHUNKS 1–2): SUPPORT CENTER EVAL GATE & SELF-HEALING DEMO :::', () => {
  it('==> Should detect Support Center <a2ui-surface> defects across Light/Dark themes and mobile/desktop viewports (Mode 1: Always-On Detection)', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-support-center-gate-'));

    try {
      const initialSurface = createBrokenSupportCenterSurfaceFixture();
      const htmlPath = join(tempDir, 'support-center.html');
      writeFileSync(htmlPath, renderSupportCenterSurfaceHtml(initialSurface), 'utf8');

      const report = await executeCheckCommand({
        target: './support-center.html',
        cwd: tempDir,
        selectors: ['a2ui-surface'],
        themes: ['light', 'dark'],
        viewportsOverride: [
          { name: 'mobile', width: 375, height: 812 },
          { name: 'desktop', width: 1440, height: 900 },
        ],
        headless: true,
        silentStdout: true,
        reportOutputPath: join(tempDir, '.uirig', 'github_pr_comment.md'),
      });

      expect(report.results).toHaveLength(4);
      expect(report.exitCode).toBe(1);

      const payload = JSON.parse(formatAgenticJsonStream(report)) as IAgenticJsonStreamPayload;
      expect(payload.passed).toBe(false);

      const closeBtnViolation = payload.violations.find(
        (v) => v.a2ui?.a2uiComponentId === 'close_drawer_btn'
      );
      expect(closeBtnViolation).toBeDefined();
      expect(['unlabeled_control', 'ax_empty_name']).toContain(closeBtnViolation?.violationType);
      expect(closeBtnViolation?.a2ui?.surfaceId).toBe('support-ticket');
      expect(closeBtnViolation?.a2ui?.a2uiComponentType).toBe('IconButton');

      const badgeViolation = payload.violations.find(
        (v) => v.a2ui?.a2uiComponentId === 'escalation_status_badge'
      );
      expect(badgeViolation).toBeDefined();
      expect(badgeViolation?.violationType).toBe('contrast_drop');
      expect(badgeViolation?.viewport).toContain('[theme: dark]');

      const delta = buildA2uiUpdateComponentsDelta('support-ticket', payload.violations);
      expect(delta).toEqual({
        updateComponents: {
          surfaceId: 'support-ticket',
          components: [
            { id: 'escalation_status_badge', contrastSafe: true },
            { id: 'close_drawer_btn', ariaLabel: 'Close Drawer Btn' },
          ],
        },
      });
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('==> Should converge Support Center <a2ui-surface> to exitCode 0 within <= 2 turns across enterprise-light/enterprise-dark skins (Mode 2: Opt-In Self-Healing)', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-support-center-heal-'));

    try {
      const initialState = createBrokenSupportCenterSurfaceFixture();
      const result = await runA2uiSelfHealingLoop({
        initialState,
        cwd: tempDir,
        maxTurns: 2,
        themes: ['enterprise-light', 'enterprise-dark'],
        viewports: [
          { name: 'mobile', width: 375, height: 812 },
          { name: 'desktop', width: 1440, height: 900 },
        ],
      });

      expect(result.converged).toBe(true);
      expect(result.turnsUsed).toBe(2);
      expect(result.finalExitCode).toBe(0);
      expect(result.trace).toHaveLength(2);

      // Turn 1 caught the defects and emitted the updateComponents delta
      expect(result.trace.at(0)?.exitCode).toBe(1);
      expect(result.trace.at(0)?.appliedDelta?.updateComponents.surfaceId).toBe('support-ticket');

      // Turn 2 verified 0 remaining violations across enterprise-light/enterprise-dark and mobile/desktop viewports
      expect(result.trace.at(1)?.exitCode).toBe(0);
      expect(result.trace.at(1)?.violationCount).toBe(0);
      expect(result.trace.at(1)?.appliedDelta).toBeNull();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
