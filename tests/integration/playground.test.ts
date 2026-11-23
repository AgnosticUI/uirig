/**
 * tests/integration/playground.test.ts
 * End-to-end integration test executing all 6 core `uirig` validation engines
 * plus v0.3.0 A2UI attribution, source-map `file:line`, and `unifiedDiff` spot checks
 * against the live Vite + AgnosticUI Lit sandbox in Chromium.
 *
 * Supports `UIRIG_HEADED=1` (via `npm run playground:test:headed`) for visual
 * slow-motion browser execution and full terminal report printing.
 */

import { describe, it, expect } from 'vitest';
import {
  runLivePlaygroundSpotCheck,
  formatSpotCheckSummary,
} from '../../playground/src/check.js';

describe('::: PHASE 4 + v0.3.0: LIVE 6-TOOL AGNOSTICUI PLAYGROUND VERIFICATION :::', () => {
  it(
    '==> Should verify Shadow DOM piercing, token drift, contrast traps, overflow stress, CLS shifts, dark mode, A2UI attribution, source-map file:line, and unifiedDiff',
    async () => {
      const isHeaded = process.env.UIRIG_HEADED === '1';
      console.log(
        `\n::: RUNNING LIVE 6-TOOL END-TO-END PLAYWRIGHT VERIFICATION (headed=${isHeaded}) :::`
      );

      const report = await runLivePlaygroundSpotCheck(isHeaded ? 5173 : 0, {
        headless: !isHeaded,
        slowMoMs: isHeaded ? 450 : 0,
      });

      const summary = formatSpotCheckSummary(report);
      if (isHeaded) {
        console.log(summary);
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

      // 5. v0.3.0 `<a2ui-surface>` attribution, DOM/AX defects, source-map `file:line`, and `unifiedDiff`
      const domViolations = report.lightMode.domViolations ?? [];
      const closeBtnDom = domViolations.find((v) =>
        v.selector.includes('a2ui-unlabeled-close-btn')
      );
      expect(closeBtnDom).toBeDefined();
      expect(report.v030Diagnostics?.a2uiAttributions[closeBtnDom!.selector]).toMatchObject({
        surfaceId: 'playground-support-ticket',
        a2uiComponentId: 'close-ticket-btn',
        a2uiComponentType: 'IconButton',
        catalogId: 'agnosticui-v1',
      });

      const unsafeLinkDom = domViolations.find((v) =>
        v.selector.includes('a2ui-source-mapped-link')
      );
      expect(unsafeLinkDom).toBeDefined();
      expect(report.v030Diagnostics?.sourceLocations[unsafeLinkDom!.selector]).toMatchObject({
        sourceFile: 'playground/index.html',
        lineNumber: 225,
      });
      expect((report.v030Diagnostics?.generatedUnifiedDiffs.length ?? 0)).toBeGreaterThanOrEqual(1);
      expect(report.v030Diagnostics?.generatedUnifiedDiffs.at(0)).toContain('href="#"');

      // 6. Verify enhanced terminal DX summary output on live report
      expect(summary).toContain('playground-support-ticket/close-ticket-btn');
      expect(summary).toContain('playground/index.html:225');
      expect(summary).toContain('--- a/playground/index.html');
      expect(summary).toContain('Try Next (Sections 2 & 3 above are intentional adversarial traps):');

      console.log(
        '[+] Verified all 6 engines + v0.3.0 A2UI/source-map/unifiedDiff end-to-end against live AgnosticUI Web Components!'
      );
    },
    60000
  );
});
