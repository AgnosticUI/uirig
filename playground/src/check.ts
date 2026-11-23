/**
 * playground/src/check.ts
 * End-to-end live check runner executing all 6 core `uirig` validation engines
 * (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom` AX-tree) plus v0.3.0
 * `<a2ui-surface>` attribution, source-map `file:line` resolution, and `unifiedDiff`
 * synthesis against the live Vite + AgnosticUI Lit sandbox.
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
  runDarkModeAudit,
  DEFAULT_DARK_MODE_MAX_SURFACE_LUMINANCE,
} from '../../src/core/dark-mode.js';
import {
  runGeometricStressAudit,
  type IGeometricViolation,
} from '../../src/core/adversary.js';
import {
  prepareClsObserver,
  collectPageCls,
  type IClsEvaluationResult,
} from '../../src/core/cls.js';
import { runDomIntegrityAudit } from '../../src/core/dom.js';
import { resolveA2uiAttributionsForSelectors } from '../../src/utils/a2ui-attribution.js';
import { resolveViolationSourceLocations } from '../../src/core/source-map.js';
import { computeDeterministicAutoFix } from '../../src/core/autofix.js';
import type {
  IA2uiAttribution,
  IDarkModeViolation,
  IDomIntegrityViolation,
  ISourceLocation,
} from '../../src/interfaces/locator.js';
import { formatTelemetryLog, paint } from '../../src/utils/formatter.js';

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
    domViolations?: IDomIntegrityViolation[];
  };
  darkMode: {
    activeThemeAttr: string | null;
    contrastViolations: IContrastViolation[];
    darkModeViolations?: IDarkModeViolation[];
  };
  v030Diagnostics?: {
    a2uiAttributions: Record<string, IA2uiAttribution | null>;
    sourceLocations: Record<string, ISourceLocation | null>;
    generatedUnifiedDiffs: Array<string>;
  };
}

export interface ISpotCheckRunOptions {
  headless?: boolean;
  slowMoMs?: number;
  existingUrl?: string;
}

function getDomRemediationHint(rule: IDomIntegrityViolation['rule']): string {
  switch (rule) {
    case 'unlabeled_control':
      return 'Add aria-label or visible text';
    case 'ax_empty_name':
      return 'Ensure non-empty accessible name in AX tree';
    case 'unsafe_uri':
      return 'Replace javascript: URI with href="#" or <button>';
    case 'dangling_aria_ref':
      return 'Fix broken aria-labelledby / aria-describedby ID';
    case 'orphaned_slot_content':
      return 'Match element slot attribute to Web Component <slot name>';
    default:
      return 'Fix DOM/AX accessibility attribute';
  }
}

function getStressRemediationHint(type: IGeometricViolation['violationType']): string {
  switch (type) {
    case 'container_overflow':
      return 'Allow wrapping or increase container width';
    case 'undersized_touch_target':
      return 'Increase clickable box to >= 24x24px';
    case 'touch_target_collision':
      return 'Add >= 24px gap between interactive controls';
    case 'horizontal_scrollbar':
      return 'Prevent horizontal viewport overflow';
    default:
      return 'Fix layout geometry under +30% text expansion';
  }
}

function formatViolationContext(options: {
  sourceLocation?: ISourceLocation | null;
  hostComponent?: string | null;
  a2ui?: IA2uiAttribution | null;
  suggestedToken?: string | null;
  hint?: string | null;
}): string {
  const parts: string[] = [];
  if (options.sourceLocation?.sourceFile && options.sourceLocation.lineNumber !== null) {
    parts.push(`${options.sourceLocation.sourceFile}:${options.sourceLocation.lineNumber}`);
  }
  if (options.hostComponent) {
    parts.push(`in <${options.hostComponent}>`);
  }
  if (options.a2ui) {
    const surface = options.a2ui.surfaceId ?? 'surface';
    const comp = options.a2ui.a2uiComponentId ?? options.a2ui.a2uiComponentType ?? 'component';
    parts.push(`a2ui: ${surface}/${comp}`);
  }
  if (options.suggestedToken) {
    parts.push(`-> ${options.suggestedToken}`);
  }
  if (options.hint) {
    parts.push(`hint: ${options.hint}`);
  }
  return parts.length > 0 ? ` [${paint(parts.join(' | '), 'cyan')}]` : '';
}

export function formatSpotCheckSummary(report: ISpotCheckReport): string {
  const formatCountBadge = (count: number): string =>
    count > 0 ? paint(`${count} FAIL`, 'bold', 'red') : paint('0 PASS', 'bold', 'green');

  const divider = paint(
    '====================================================================',
    'cyan'
  );
  const title = paint(
    '  uirig Live 6-Tool + v0.3.0 Check Report (AgnosticUI Lit Sandbox)',
    'bold',
    'cyan'
  );

  const domViolations = report.lightMode.domViolations ?? [];
  const darkModeViolations = report.darkMode.darkModeViolations ?? [];
  const a2uiMap = report.v030Diagnostics?.a2uiAttributions ?? {};
  const sourceMap = report.v030Diagnostics?.sourceLocations ?? {};
  const diffs = report.v030Diagnostics?.generatedUnifiedDiffs ?? [];
  const a2uiMatchedCount = Object.values(a2uiMap).filter(Boolean).length;
  const sourceMappedCount = Object.values(sourceMap).filter(Boolean).length;

  const lines: string[] = [
    '',
    divider,
    title,
    divider,
    `${paint('1. [tokens]', 'bold', 'magenta')}    Design Token Violations : ${formatCountBadge(
      report.lightMode.tokenViolations.length
    )}`,
    ...report.lightMode.tokenViolations.map((v) => {
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
      });
      return `   ${paint('•', 'red')} ${paint(v.selector, 'yellow')} (${paint(
        v.property,
        'cyan'
      )}: ${paint(v.actualValue, 'bold', 'red')})${
        v.inShadowDom ? paint(' [ShadowDOM]', 'magenta') : ''
      }${ctx}`;
    }),
    `${paint('2. [contrast]', 'bold', 'cyan')}  Light Mode Violations   : ${formatCountBadge(
      report.lightMode.contrastViolations.length
    )}`,
    ...report.lightMode.contrastViolations.map((v) => {
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
        suggestedToken: v.suggestedToken ?? null,
        hint: 'Increase contrast >= 4.5:1',
      });
      return `   ${paint('•', 'red')} ${paint(v.selector, 'yellow')} (${paint(
        `${v.contrastRatio}:1 < 4.5:1`,
        'bold',
        'red'
      )} | ${paint(`${v.foregroundRgb} on ${v.backgroundRgb}`, 'white')})${ctx}`;
    }),
    `${paint('3. [dark-mode]', 'bold', 'cyan')} Dark Mode (${paint(
      report.darkMode.activeThemeAttr ?? 'none',
      'magenta'
    )}) Parity  : ${formatCountBadge(
      report.darkMode.contrastViolations.length + darkModeViolations.length
    )}`,
    ...report.darkMode.contrastViolations.map((v) => {
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
        suggestedToken: v.suggestedToken ?? null,
        hint: 'Ensure dark theme token contrast >= 4.5:1',
      });
      return `   ${paint('•', 'red')} ${paint(v.selector, 'yellow')} (${paint(
        `${v.contrastRatio}:1 < 4.5:1`,
        'bold',
        'red'
      )} | ${paint(`${v.foregroundRgb} on ${v.backgroundRgb}`, 'white')})${ctx}`;
    }),
    ...darkModeViolations.map((v) => {
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
        suggestedToken: v.suggestedToken ?? null,
        hint: 'Bind dark surface to semantic --ag-background-* token',
      });
      return `   ${paint('•', 'red')} [${paint(v.violationType, 'cyan')}] ${paint(
        v.selector,
        'yellow'
      )} (${paint(v.backgroundRgb, 'bold', 'red')})${ctx}`;
    }),
    `${paint('4. [stress]', 'bold', 'yellow')}    Geometric Overflow Hits : ${formatCountBadge(
      report.lightMode.stressViolations.length
    )}`,
    ...report.lightMode.stressViolations.map((v) => {
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
        hint: getStressRemediationHint(v.violationType),
      });
      return `   ${paint('•', 'red')} [${paint(v.violationType, 'cyan')}] ${paint(
        v.selector,
        'yellow'
      )}${v.relatedSelector ? ` -> ${paint(v.relatedSelector, 'yellow')}` : ''} (${paint(
        `+${v.measuredLeakPixels}px`,
        'bold',
        'red'
      )})${ctx}`;
    }),
    `${paint('5. [cls]', 'bold', 'blue')}       Max Session CLS Score   : ${paint(
      String(report.lightMode.clsEvaluation.maxSessionCls),
      'bold',
      report.lightMode.clsEvaluation.violation ? 'red' : 'green'
    )} ${paint('(budget: 0.1)', 'cyan')} -> ${
      report.lightMode.clsEvaluation.violation
        ? paint('FAIL (Shift Detected)', 'bold', 'red')
        : paint('PASS', 'bold', 'green')
    }`,
    `${paint('6. [dom+ax]', 'bold', 'magenta')}    DOM & Computed AX Hits  : ${formatCountBadge(
      domViolations.length
    )}`,
    ...domViolations.map((v) => {
      const ctx = formatViolationContext({
        sourceLocation: sourceMap[v.selector] ?? null,
        hostComponent: v.hostComponent,
        a2ui: a2uiMap[v.selector] ?? null,
        hint: getDomRemediationHint(v.rule),
      });
      return `   ${paint('•', 'red')} [${paint(v.rule, 'cyan')}] ${paint(v.selector, 'yellow')}: ${
        v.detail
      }${ctx}`;
    }),
    `${paint('7. [v0.3.0]', 'bold', 'green')}    A2UI / Source-Map / Diff: ${paint(
      `${a2uiMatchedCount} A2UI`,
      'cyan'
    )} | ${paint(`${sourceMappedCount} file:line`, 'cyan')} | ${paint(
      `${diffs.length} unifiedDiff`,
      'cyan'
    )}`,
    ...diffs.flatMap((diff) =>
      diff.split('\n').map((diffLine) => `     ${paint(diffLine, 'cyan')}`)
    ),
    divider,
    paint(
      'Try Next (Sections 2 & 3 above are intentional adversarial traps):',
      'bold',
      'cyan'
    ),
    '  • JSON report + source-map attribution : npm run uirig -- check http://localhost:5173 --json',
    '  • Multi-theme light/dark parity matrix : npm run uirig -- check http://localhost:5173 --themes light,dark',
    '  • Preview/apply deterministic auto-fix : npm run uirig -- check http://localhost:5173 --fix',
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
  const workspaceCwd = process.cwd();

  let server: ViteDevServer | null = null;
  let browser: Browser | null = null;

  try {
    let targetUrl = options.existingUrl;

    if (!targetUrl) {
      const playgroundRoot = resolve(workspaceCwd, 'playground');
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

    console.log(
      formatTelemetryLog(
        'check:playground',
        `Auditing live playground at ${paint(targetUrl, 'cyan')} (headless=${headless})...`
      )
    );

    browser = await chromium.launch({ headless, slowMo });

    // 1. Context A: Read-only Tokens + Contrast + DOM/AX + A2UI + Source-Map + Dark Mode Check
    const readOnlyContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const readOnlyPage = await readOnlyContext.newPage();
    await readOnlyPage.goto(targetUrl, { waitUntil: 'networkidle' });

    const tokenViolations = await crawlPageTokens(readOnlyPage, AGNOSTIC_SPOTCHECK_SCALE);
    const lightContrastViolations = await auditPageContrast(readOnlyPage);
    const domViolations = await runDomIntegrityAudit(readOnlyPage, {
      navigationResponse: null,
    });

    const candidateSelectors = [
      ...tokenViolations.map((v) => v.selector),
      ...lightContrastViolations.map((v) => v.selector),
      ...domViolations.map((v) => v.selector),
    ];
    const [a2uiMap, sourceMap] = await Promise.all([
      resolveA2uiAttributionsForSelectors(readOnlyPage, candidateSelectors),
      resolveViolationSourceLocations(readOnlyPage, candidateSelectors, workspaceCwd),
    ]);
    const a2uiAttributions = Object.fromEntries(a2uiMap.entries());
    const sourceLocations = Object.fromEntries(sourceMap.entries());

    const generatedUnifiedDiffs = new Array<string>();
    for (const domV of domViolations) {
      const loc = sourceLocations[domV.selector] ?? null;
      const fix = computeDeterministicAutoFix(
        {
          engine: 'dom',
          violationType: domV.rule,
          sourceFile: loc?.sourceFile ?? null,
          lineNumber: loc?.lineNumber ?? null,
          measuredDelta: domV.detail,
        },
        workspaceCwd
      );
      if (fix) {
        generatedUnifiedDiffs.push(fix.unifiedDiff);
      }
    }

    // Toggle to Dark Mode (`data-theme="dark"`) via #theme-toggle and re-audit contrast & dark-mode parity
    await readOnlyPage.click('#theme-toggle');
    const activeThemeAttr = await readOnlyPage.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    const darkContrastViolations = await auditPageContrast(readOnlyPage);
    const darkModeViolations = await runDarkModeAudit(readOnlyPage, {
      maxSurfaceLuminance: DEFAULT_DARK_MODE_MAX_SURFACE_LUMINANCE,
      allowedColors: AGNOSTIC_SPOTCHECK_SCALE.colors,
    });
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
        domViolations,
      },
      darkMode: {
        activeThemeAttr,
        contrastViolations: darkContrastViolations,
        darkModeViolations,
      },
      v030Diagnostics: {
        a2uiAttributions,
        sourceLocations,
        generatedUnifiedDiffs,
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
      console.error('[check:playground] Fatal error during live inspection:', err);
      process.exitCode = 1;
    });
}
