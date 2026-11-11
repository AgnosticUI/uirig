/**
 * playground/src/spot-check.ts
 * End-to-end live spot-check runner executing all 4 core `uirig` validation engines
 * (`crawlPageTokens`, `auditPageContrast`, `runGeometricStressAudit`, `collectPageCls`)
 * against the live Vite + AgnosticUI Lit sandbox in both Light Mode and Dark Mode.
 */

import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
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
 * Lightweight zero-dependency ANSI terminal color palette for crisp visual scanning.
 * Automatically honors the standard `NO_COLOR` environment variable.
 */
const ANSI_CODES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const;

type AnsiStyle = keyof typeof ANSI_CODES;

function paint(text: string, ...styles: AnsiStyle[]): string {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
    return text;
  }
  const prefix = styles.map((s) => ANSI_CODES[s]).join('');
  return `${prefix}${text}${ANSI_CODES.reset}`;
}

export const AGNOSTIC_SPOTCHECK_SCALE: ITokenScaleConfig = {
  colors: [
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

export interface ISpotCheckRunOptions {
  headless?: boolean;
  slowMoMs?: number;
  existingUrl?: string;
}

export function formatSpotCheckSummary(report: ISpotCheckReport): string {
  const formatCountBadge = (count: number): string =>
    count > 0 ? paint(`${count} FAIL`, 'bold', 'red') : paint('0 PASS', 'bold', 'green');

  const divider = paint(
    '====================================================================',
    'cyan'
  );
  const title = paint(
    '  uirig Live 4-Tool Spot-Check Report (AgnosticUI Lit Sandbox)',
    'bold',
    'cyan'
  );

  const lines: string[] = [
    '',
    divider,
    title,
    divider,
    `${paint('1. [tokens]', 'bold', 'magenta')}   Design Token Violations : ${formatCountBadge(
      report.lightMode.tokenViolations.length
    )}`,
    ...report.lightMode.tokenViolations.map(
      (v) =>
        `   ${paint('•', 'red')} ${paint(v.selector, 'yellow')} (${paint(
          v.property,
          'cyan'
        )}: ${paint(v.actualValue, 'bold', 'red')})${
          v.inShadowDom ? paint(' [ShadowDOM]', 'magenta') : ''
        }`
    ),
    `${paint('2. [contrast]', 'bold', 'magenta')} Light Mode Violations   : ${formatCountBadge(
      report.lightMode.contrastViolations.length
    )}`,
    ...report.lightMode.contrastViolations.map(
      (v) =>
        `   ${paint('•', 'red')} ${paint(v.selector, 'yellow')} (${paint(
          `${v.contrastRatio}:1 < 4.5:1`,
          'bold',
          'red'
        )} | ${paint(`${v.foregroundRgb} on ${v.backgroundRgb}`, 'dim')})`
    ),
    `   ${paint('[contrast]', 'bold', 'magenta')} Dark Mode (${paint(
      report.darkMode.activeThemeAttr ?? 'none',
      'cyan'
    )}) Violations : ${formatCountBadge(report.darkMode.contrastViolations.length)}`,
    ...report.darkMode.contrastViolations.map(
      (v) =>
        `   ${paint('•', 'red')} ${paint(v.selector, 'yellow')} (${paint(
          `${v.contrastRatio}:1 < 4.5:1`,
          'bold',
          'red'
        )} | ${paint(`${v.foregroundRgb} on ${v.backgroundRgb}`, 'dim')})`
    ),
    `${paint('3. [stress]', 'bold', 'magenta')}   Geometric Overflow Hits : ${formatCountBadge(
      report.lightMode.stressViolations.length
    )}`,
    ...report.lightMode.stressViolations.map(
      (v) =>
        `   ${paint('•', 'red')} [${paint(v.violationType, 'cyan')}] ${paint(
          v.selector,
          'yellow'
        )}${v.relatedSelector ? ` -> ${paint(v.relatedSelector, 'yellow')}` : ''} (${paint(
          `+${v.measuredLeakPixels}px`,
          'bold',
          'red'
        )})`
    ),
    `${paint('4. [cls]', 'bold', 'magenta')}      Max Session CLS Score   : ${paint(
      String(report.lightMode.clsEvaluation.maxSessionCls),
      'bold',
      report.lightMode.clsEvaluation.violation ? 'red' : 'green'
    )} ${paint('(budget: 0.1)', 'dim')} -> ${
      report.lightMode.clsEvaluation.violation
        ? paint('FAIL (Shift Detected)', 'bold', 'red')
        : paint('PASS', 'bold', 'green')
    }`,
    divider,
    '',
  ];

  return lines.join('\n');
}
export async function runLivePlaygroundSpotCheck(
  port: number = 5173,
  options: ISpotCheckRunOptions = {}
): Promise<ISpotCheckReport> {
  const headless = options.headless ?? true;
  const slowMo = options.slowMoMs ?? 0;

  let server: ViteDevServer | null = null;
  let browser: Browser | null = null;

  try {
    let targetUrl = options.existingUrl;

    if (!targetUrl) {
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
      targetUrl = `http://localhost:${activePort}`;
    }

    console.log(`[spot-check] Auditing live playground at ${targetUrl} (headless=${headless})...`);
    browser = await chromium.launch({ headless, slowMo });

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

const isDirectExecution =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const isHeaded = process.argv.includes('--headed');
  runLivePlaygroundSpotCheck(5173, {
    headless: !isHeaded,
    slowMoMs: isHeaded ? 450 : 0,
  })
    .then((report) => {
      console.log(formatSpotCheckSummary(report));
    })
    .catch((err: unknown) => {
      console.error('[spot-check] Fatal error during live inspection:', err);
      process.exitCode = 1;
    });
}
