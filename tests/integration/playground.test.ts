/**
 * tests/integration/playground-spotcheck.test.ts
 * End-to-end integration test executing all 4 core `uirig` validation engines
 * against the live Vite + AgnosticUI Lit sandbox in Chromium.
 *
 * Supports `UIRIG_HEADED=1` (via `npm run playground:inspect`) for visual
 * slow-motion browser inspection and full terminal report printing.
 */

import { describe, it, expect } from 'vitest';
import {
  runLivePlaygroundSpotCheck,
  formatSpotCheckSummary,
} from '../../playground/src/check.js';

describe('::: PHASE 4 TASK 4.4: LIVE 4-TOOL AGNOSTICUI SPOT-CHECK VERIFICATION :::', () => {
  it(
    '==> Should verify Shadow DOM piercing, token drift, contrast traps, overflow stress, CLS shifts, and dark mode toggle',
    async () => {
      const isHeaded = process.env.UIRIG_HEADED === '1';
      console.log(
        `\n::: RUNNING LIVE 4-TOOL END-TO-END PLAYWRIGHT SPOT-CHECK (headed=${isHeaded}) :::`
      );

      const report = await runLivePlaygroundSpotCheck(isHeaded ? 5173 : 0, {
        headless: !isHeaded,
        slowMoMs: isHeaded ? 450 : 0,
      });

      if (isHeaded) {
        console.log(formatSpotCheckSummary(report));
      }

      // 1. Token Auditor (`crawlPageTokens`): catches off-scale styles on `#contrast-token-trap`
      const tokenTrapHits = report.lightMode.tokenViolations.filter(
        (v) => v.selector === 'div#contrast-token-trap'
      );
      expect(tokenTrapHits.length).toBeGreaterThanOrEqual(4);
      expect(tokenTrapHits.some((v) => v.property === 'fontSize' && v.actualValue === '13px')).toBe(
        true
      );
      expect(
        tokenTrapHits.some((v) => v.property === 'borderRadius' && v.actualValue === '3px')
      ).toBe(true);

      // 2. Contrast Gate (`auditPageContrast`): catches low-contrast text (< 4.5:1) in Light & Dark modes
      const lightContrastTrap = report.lightMode.contrastViolations.find(
        (v) => v.selector === 'div#contrast-token-trap'
      );
      expect(lightContrastTrap).toBeDefined();
      expect(lightContrastTrap?.contrastRatio).toBeLessThan(4.5);

      expect(report.darkMode.activeThemeAttr).toBe('dark');
      const darkContrastTrap = report.darkMode.contrastViolations.find(
        (v) => v.selector === 'div#contrast-token-trap'
      );
      expect(darkContrastTrap).toBeDefined();
      expect(darkContrastTrap?.contrastRatio).toBeLessThan(4.5);

      // 3. Geometric Stress Rig (`runGeometricStressAudit`): catches overflow inside `#overflow-trap-box`
      const overflowHit = report.lightMode.stressViolations.find(
        (v) =>
          v.violationType === 'container_overflow' &&
          v.selector === 'span#overflow-trap-label' &&
          v.relatedSelector === 'div#overflow-trap-box'
      );
      expect(overflowHit).toBeDefined();
      expect(overflowHit?.measuredLeakPixels).toBeGreaterThan(2);

      // 4. CLS Monitor (`prepareClsObserver` + `collectPageCls`): catches `#late-unsized-banner` shift
      expect(report.lightMode.clsEvaluation.maxSessionCls).toBeGreaterThan(0.1);
      expect(report.lightMode.clsEvaluation.violation).not.toBeNull();

      console.log('[+] Verified all 4 tools end-to-end against live AgnosticUI Web Components!');
    },
    60000
  );
});
