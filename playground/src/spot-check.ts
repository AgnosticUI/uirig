/**
 * playground/src/spot-check.ts
 * End-to-end live spot-check runner executing all 4 core `uirig` validation engines
 * (`crawlPageTokens`, `auditPageContrast`, `runGeometricStressAudit`, `collectPageCls`)
 * against the live Vite + AgnosticUI Lit sandbox in both Light Mode and Dark Mode.
 */

import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { resolve } from 'path';
import {
  crawlPageTokens,
  type ITokenScaleConfig,
  type ITokenViolation,
} from '../../src/core/tokens.js';
import {
  auditPageContrast,
  type IContrastViolation,
} from '../../src/core/matrix.js';
import {
  runGeometricStressAudit,
  type IGeometricViolation,
} from '../../src/core/adversary.js';
import {
  prepareClsObserver,
  collectPageCls,
  type IClsEvaluationResult,
} from '../../src/core/cls.js';

/**
 * Approved token scale matching AgnosticUI's light/dark design tokens (`ag-tokens.css` &
 * `ag-tokens-dark.css`) so compliant components pass while deliberate traps fail.
 */
export const AGNOSTIC_SPOTCHECK_SCALE: ITokenScaleConfig = {
  colors: [
    // Light & dark surface and text tokens
    'rgb(255, 255, 255)',
    'rgb(1, 4, 9)',
    'rgb(17, 24, 39)',
    'rgb(240, 246, 252)',
    'rgb(75, 85, 99)',
    'rgb(209, 215, 224)',
    'rgb(243, 244, 246)',
    'rgb(33, 39, 48)',
    'rgb(229, 231, 235)',
    'rgb(61, 68, 77)',
    'rgb(5, 80, 174)',
    'rgb(17, 88, 199)',
    'rgb(255, 248, 197)',
    'rgb(125, 78, 0)',
    'rgb(52, 26, 0)',
    'rgb(242, 204, 96)',
  ],
  spacing: ['0px', '4px', '8px', '12px', '16px', '20px', '24px', '32px'],
  fontSizes: ['12px', '14px', '16px', '18px', '20px', '24px', '32px'],
  radii: ['0px', '4px', '6px', '8px', '16px', '9999px'],
};

/**
 * Structured telemetry report returned by `runLivePlaygroundSpotCheck`.
 */
export interface ISpotCheckReport {
  lightMode: {
    tokenViolations: ITokenViolation[];
    contrastViolations: IContrastViolation[];
    stressViolations: IGeometricViolation[];
    clsEvaluation: IClsEvaluationResult;
  };
  darkMode: {
    activeThemeAttr: string | null;
    contrastViolations: IContrastViolation[];
  };
}

/**
 * Starts an in-process Vite dev server for `playground/`, launches headless Chromium,
 * and verifies all 4 `uirig` tools end-to-end across Light and Dark modes.
 *
 * @param port - Local port for Vite dev server (default 5173).
 * @returns Structured report of all 4 tool outputs.
 */
export async function runLivePlaygroundSpotCheck(
  port: number = 5173
): Promise<ISpotCheckReport> {
  let server: ViteDevServer | null = null;
  let browser: Browser | null = null;

  try {
    const playgroundRoot = resolve(process.cwd(), 'playground');
    server = await createServer({
      root: playgroundRoot,
      server: { port, strictPort: false },
      logLevel: 'silent',
    });
    await server.listen();

    const resolvedAddress = server.httpServer?.address();
    const activePort =
      typeof resolvedAddress === 'object' && resolvedAddress !== null
        ? resolvedAddress.port
        : port;
    const targetUrl = `http://localhost:${activePort}`;

    console.log(`[spot-check] Vite dev server listening at ${targetUrl}`);
    browser = await chromium.launch({ headless: true });

    // 1. Context A: Read-only Tokens + Contrast + Dark Mode Toggle Check
    const readOnlyContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const readOnlyPage = await readOnlyContext.newPage();
    await readOnlyPage.goto(targetUrl, { waitUntil: 'networkidle' });

    const tokenViolations = await crawlPageTokens(readOnlyPage, AGNOSTIC_SPOTCHECK_SCALE);
    const lightContrastViolations = await auditPageContrast(readOnlyPage);

    // Toggle to Dark Mode (`data-theme="dark"`) via #theme-toggle and re-audit contrast
    await readOnlyPage.click('#theme-toggle');
    const activeThemeAttr = await readOnlyPage.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    const darkContrastViolations = await auditPageContrast(readOnlyPage);
    await readOnlyContext.close();

    // 2. Context B: Mutated Geometric Stress Rig (+30% Pseudo-Localization)
    const stressContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const stressPage = await stressContext.newPage();
    await stressPage.goto(targetUrl, { waitUntil: 'networkidle' });

    const stressViolations = await runGeometricStressAudit(stressPage, {
      overflowPixelTolerance: 2,
      touchTargetMinSpacingPx: 24,
    });
    await stressContext.close();

    // 3. Context C: Pre-Navigation CLS PerformanceObserver Monitor
    const clsContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const clsPage = await clsContext.newPage();
    await prepareClsObserver(clsPage);
    await clsPage.goto(targetUrl, { waitUntil: 'networkidle' });

    const clsEvaluation = await collectPageCls(clsPage, 0.1, 350);
    await clsContext.close();

    console.log('[spot-check] All 4 tools completed live verification successfully.');

    return {
      lightMode: {
        tokenViolations,
        contrastViolations: lightContrastViolations,
        stressViolations,
        clsEvaluation,
      },
      darkMode: {
        activeThemeAttr,
        contrastViolations: darkContrastViolations,
      },
    };
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server) {
      await server.close();
    }
  }
}
