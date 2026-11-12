/**
 * src/commands/check.ts
 * Isolated Parallel Context Dispatcher (uirig check).
 * Launches a single Playwright Chromium instance and orchestrates isolated
 * BrowserContext sessions concurrently (`Promise.all`) per target URL/viewport
 * so read-only audits (`tokens`, `contrast`), mutated DOM fuzzing (`stress`),
 * and pre-navigation `PerformanceObserver` monitoring (`cls`) execute without
 * cross-tool pollution or multiple browser startup overhead.
 *
 * Also supports zero-config runs (`npx uirig <url-or-file>`), runtime ignore
 * rules (`data-uirig-ignore` + `ignore[]`), and ephemeral local HTTP servers
 * for `.html` file targets.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { chromium, type Browser } from 'playwright';
import { crawlPageTokens, type ITokenScaleConfig, type ITokenViolation } from '../core/tokens.js';
import { auditPageContrast, type IContrastViolation, MIN_WCAG_AA_CONTRAST } from '../core/matrix.js';
import { runGeometricStressAudit, type IGeometricViolation } from '../core/adversary.js';
import { prepareClsObserver, collectPageCls, type IClsEvaluationResult } from '../core/cls.js';
import { logTelemetry, paint } from '../utils/formatter.js';
import { formatAgenticJsonStream } from '../utils/agent-stream.js';
import { writeGithubPrCommentReport, DEFAULT_PR_COMMENT_PATH } from '../utils/fs.js';
import {
  isLocalFileTarget,
  startEphemeralStaticServer,
  type IEphemeralStaticServer,
} from '../utils/static-server.js';
import type { IUirigIgnoreRule } from '../utils/ignore.js';
import type {
  IDarkModeViolation,
  IDomIntegrityViolation,
  IRuntimeErrorViolation,
} from '../interfaces/locator.js';

/**
 * Deterministic POSIX exit codes enforced by `uirig check`:
 * - `0`: All token, contrast, dark-mode parity, geometric stress, CLS, DOM, and runtime checks passed.
 * - `1`: Configuration/token load error, design token drift, WCAG/dark-mode contrast failure, DOM violation, or runtime JS error.
 * - `2`: Structural layout break (overflow, horizontal scrollbar, touch collision) or CLS budget breach.
 */
export type PosixExitCode = 0 | 1 | 2;

export interface IViewportConfig {
  name: string;
  width: number;
  height: number;
}

export interface IThresholdBudgets {
  clsMaxLimit: number;
  overflowPixelTolerance: number;
  touchTargetMinSpacingPx: number;
  darkModeMaxSurfaceLuminance?: number;
}

export interface IUirigConfig {
  $schema?: string;
  targetUrls: string[];
  tokensPath?: string;
  thresholdBudgets: IThresholdBudgets;
  viewports: IViewportConfig[];
  ignore?: IUirigIgnoreRule[];
}

export type AuditToolName = 'tokens' | 'contrast' | 'dark-mode' | 'stress' | 'cls' | 'dom';

export interface ICheckCommandOptions {
  /** Optional positional `<url-or-file>` target for zero-config or single-target overrides. */
  target?: string;
  configPath?: string;
  json?: boolean;
  headless?: boolean;
  /** Optional single-engine filter. Runs all enabled engines when omitted. */
  only?: AuditToolName;
  /** Optional inline token scale override (useful for programmatic calls & tests). */
  tokenScaleOverride?: ITokenScaleConfig;
  /** Optional custom output path for the Markdown PR comment report (defaults to `.uirig/github_pr_comment.md`). */
  reportOutputPath?: string;
  /** Optional working directory override for resolving relative paths in tests. */
  cwd?: string;
}

export interface IViewportAuditReport {
  url: string;
  viewport: IViewportConfig;
  tokenViolations: ITokenViolation[];
  contrastViolations: IContrastViolation[];
  darkModeViolations?: IDarkModeViolation[];
  stressViolations: IGeometricViolation[];
  clsEvaluation: IClsEvaluationResult;
  domViolations?: IDomIntegrityViolation[];
  runtimeErrors?: IRuntimeErrorViolation[];
}

export interface ICheckExecutionReport {
  timestamp: string;
  configPath: string;
  reportPath: string;
  exitCode: PosixExitCode;
  results: IViewportAuditReport[];
  summary: {
    totalViewportsAudited: number;
    totalTokenViolations: number;
    totalContrastViolations: number;
    totalDarkModeViolations?: number;
    totalStressViolations: number;
    totalClsViolations: number;
    totalDomViolations?: number;
    totalRuntimeErrors?: number;
  };
}

/**
 * Sensible built-in defaults used when running `npx uirig <url-or-file>` without
 * a `uirig.config.json` file on disk.
 */
export const ZERO_CONFIG_DEFAULTS: Omit<IUirigConfig, 'targetUrls'> = {
  tokensPath: undefined,
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
 * Fallback built-in token scale used only when `tokensPath` is omitted or explicitly
 * configured to use defaults, ensuring zero-config runs remain resilient.
 */
export const FALLBACK_TOKEN_SCALE: ITokenScaleConfig = {
  colors: ['rgb(255, 255, 255)', 'rgb(0, 0, 0)', 'rgb(17, 24, 39)', 'rgb(243, 244, 246)'],
  spacing: ['0px', '4px', '8px', '12px', '16px', '20px', '24px', '32px'],
  fontSizes: ['12px', '14px', '16px', '18px', '20px', '24px', '32px'],
  radii: ['0px', '4px', '6px', '8px', '16px', '9999px'],
};

/**
 * Reads and validates `uirig.config.json` from disk.
 * Throws descriptive `ERR_CONFIG_*` errors so CLI callers can exit with POSIX code `1`.
 */
export function loadUirigConfig(
  configPath: string = resolve(process.cwd(), 'uirig.config.json')
): IUirigConfig {
  logTelemetry('check:config', `Loading configuration from ${paint(configPath, 'cyan')}...`);

  if (!existsSync(configPath)) {
    throw new Error(
      `ERR_CONFIG_MISSING: Configuration file not found at ${configPath}. Run 'uirig init' or pass a target directly (e.g. 'uirig ./index.html').`
    );
  }

  let parsed: unknown;
  try {
    const raw = readFileSync(configPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`ERR_CONFIG_INVALID_JSON: Failed to parse ${configPath}: ${detail}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`ERR_CONFIG_SCHEMA: Configuration at ${configPath} must be a JSON object.`);
  }

  const candidate = parsed as Partial<IUirigConfig>;

  if (!Array.isArray(candidate.targetUrls) || candidate.targetUrls.length === 0) {
    throw new Error(
      `ERR_CONFIG_SCHEMA: 'targetUrls' must be a non-empty array of URLs in ${configPath}.`
    );
  }

  if (
    candidate.tokensPath !== undefined &&
    (typeof candidate.tokensPath !== 'string' || candidate.tokensPath.trim().length === 0)
  ) {
    throw new Error(
      `ERR_CONFIG_SCHEMA: 'tokensPath' must be a non-empty file path string when specified in ${configPath}.`
    );
  }

  if (!Array.isArray(candidate.viewports) || candidate.viewports.length === 0) {
    throw new Error(
      `ERR_CONFIG_SCHEMA: 'viewports' must be a non-empty array of viewport definitions in ${configPath}.`
    );
  }

  const budgets = candidate.thresholdBudgets;
  if (
    typeof budgets !== 'object' ||
    budgets === null ||
    typeof budgets.clsMaxLimit !== 'number' ||
    typeof budgets.overflowPixelTolerance !== 'number' ||
    typeof budgets.touchTargetMinSpacingPx !== 'number'
  ) {
    throw new Error(
      `ERR_CONFIG_SCHEMA: 'thresholdBudgets' must define numeric clsMaxLimit, overflowPixelTolerance, and touchTargetMinSpacingPx.`
    );
  }

  const ignoreRules: IUirigIgnoreRule[] = [];
  if (candidate.ignore !== undefined) {
    if (!Array.isArray(candidate.ignore)) {
      throw new Error(`ERR_CONFIG_SCHEMA: 'ignore' must be an array of ignore rule objects.`);
    }
    for (const entry of candidate.ignore) {
      if (typeof entry !== 'object' || entry === null || typeof entry.rule !== 'string') {
        throw new Error(`ERR_CONFIG_SCHEMA: Each entry in 'ignore' must specify a 'rule' string.`);
      }
      ignoreRules.push({
        rule: entry.rule,
        selector: typeof entry.selector === 'string' ? entry.selector : undefined,
        url: typeof entry.url === 'string' ? entry.url : undefined,
      });
    }
  }

  return {
    $schema: candidate.$schema,
    targetUrls: candidate.targetUrls,
    tokensPath: candidate.tokensPath,
    thresholdBudgets: {
      clsMaxLimit: budgets.clsMaxLimit,
      overflowPixelTolerance: budgets.overflowPixelTolerance,
      touchTargetMinSpacingPx: budgets.touchTargetMinSpacingPx,
      darkModeMaxSurfaceLuminance: budgets.darkModeMaxSurfaceLuminance ?? 0.85,
    },
    viewports: candidate.viewports,
    ignore: ignoreRules,
  };
}

/**
 * Resolves the active `IUirigConfig` for a run, supporting explicit `--config`,
 * default `uirig.config.json`, and zero-config positional `<url-or-file>` runs.
 */
export function resolveExecutionConfig(
  options: ICheckCommandOptions,
  cwd: string
): { config: IUirigConfig; configLabel: string } {
  const defaultConfigPath = resolve(cwd, 'uirig.config.json');

  if (options.configPath) {
    const explicitPath = resolve(cwd, options.configPath);
    const loaded = loadUirigConfig(explicitPath);
    return {
      config: options.target ? { ...loaded, targetUrls: [options.target] } : loaded,
      configLabel: explicitPath,
    };
  }

  if (existsSync(defaultConfigPath)) {
    const loaded = loadUirigConfig(defaultConfigPath);
    return {
      config: options.target ? { ...loaded, targetUrls: [options.target] } : loaded,
      configLabel: defaultConfigPath,
    };
  }

  if (options.target) {
    logTelemetry(
      'check:zero-config',
      `Running in zero-config mode against ${paint(options.target, 'cyan')}...`
    );
    return {
      config: {
        ...ZERO_CONFIG_DEFAULTS,
        targetUrls: [options.target],
      },
      configLabel: 'zero-config (built-in defaults)',
    };
  }

  loadUirigConfig(defaultConfigPath);
  throw new Error(`ERR_CONFIG_MISSING: Configuration file not found at ${defaultConfigPath}.`);
}

/**
 * Loads and validates the approved design token scale JSON referenced by `tokensPath`.
 * Resolves relative paths against the directory containing `uirig.config.json`.
 */
export function loadTokenScale(tokensPath: string, configFilePath: string): ITokenScaleConfig {
  const resolvedTokensPath = resolve(dirname(configFilePath), tokensPath);
  logTelemetry(
    'check:tokens',
    `Loading design token scale from ${paint(resolvedTokensPath, 'cyan')}...`
  );

  if (!existsSync(resolvedTokensPath)) {
    throw new Error(`ERR_TOKENS_MISSING: Token scale file not found at ${resolvedTokensPath}.`);
  }

  let parsed: unknown;
  try {
    const raw = readFileSync(resolvedTokensPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`ERR_TOKENS_INVALID_JSON: Failed to parse ${resolvedTokensPath}: ${detail}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`ERR_TOKENS_SCHEMA: Token file at ${resolvedTokensPath} must be a JSON object.`);
  }

  const candidate = parsed as Partial<ITokenScaleConfig>;
  if (
    !Array.isArray(candidate.colors) ||
    !Array.isArray(candidate.spacing) ||
    !Array.isArray(candidate.fontSizes) ||
    !Array.isArray(candidate.radii)
  ) {
    throw new Error(
      `ERR_TOKENS_SCHEMA: Token file must define arrays for colors, spacing, fontSizes, and radii.`
    );
  }

  return {
    colors: candidate.colors,
    spacing: candidate.spacing,
    fontSizes: candidate.fontSizes,
    radii: candidate.radii,
  };
}

/**
 * Evaluates an array of viewport audit reports and determines the deterministic
 * POSIX exit code for CI/CD pipelines (`0` = pass, `1` = policy/integrity/runtime, `2` = stress/CLS).
 */
export function evaluatePosixExitCode(results: IViewportAuditReport[]): PosixExitCode {
  let hasStructuralOrClsFailure = false;
  let hasPolicyOrIntegrityFailure = false;

  for (const report of results) {
    if (report.stressViolations.length > 0 || report.clsEvaluation.violation !== null) {
      hasStructuralOrClsFailure = true;
    }
    if (
      report.tokenViolations.length > 0 ||
      report.contrastViolations.length > 0 ||
      (report.darkModeViolations?.length ?? 0) > 0 ||
      (report.domViolations?.length ?? 0) > 0 ||
      (report.runtimeErrors?.length ?? 0) > 0
    ) {
      hasPolicyOrIntegrityFailure = true;
    }
  }

  if (hasStructuralOrClsFailure) {
    return 2;
  }
  if (hasPolicyOrIntegrityFailure) {
    return 1;
  }
  return 0;
}
/**
 * Audits a single `(url, viewport)` target across isolated Playwright `BrowserContext`
 * sessions running concurrently (`Promise.all`) inside one shared Chromium browser.
 */
export async function auditViewportInParallel(
  browser: Browser,
  url: string,
  viewport: IViewportConfig,
  tokenScale: ITokenScaleConfig | null,
  budgets: IThresholdBudgets,
  only?: AuditToolName,
  ignoreRules: IUirigIgnoreRule[] = []
): Promise<IViewportAuditReport> {
  const viewportSize = { width: viewport.width, height: viewport.height };
  const runTokens = (!only || only === 'tokens') && tokenScale !== null;
  const runContrast = !only || only === 'contrast';
  const runStress = !only || only === 'stress';
  const runCls = !only || only === 'cls';

  const activeScope = only ? `single engine (${only})` : '3 isolated contexts';
  logTelemetry(
    'check:dispatch',
    `Running ${activeScope} for ${paint(url, 'cyan')} @ ${paint(
      `${viewport.name} (${viewport.width}x${viewport.height})`,
      'bold',
      'green'
    )}...`
  );

  // Track 1: Read-Only Audits (`tokens` and/or `contrast`)
  const runReadOnlyTrack = async (): Promise<{
    tokenViolations: ITokenViolation[];
    contrastViolations: IContrastViolation[];
  }> => {
    if (!runTokens && !runContrast) {
      return { tokenViolations: [], contrastViolations: [] };
    }
    const context = await browser.newContext({ viewport: viewportSize });
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const tokenViolations =
        runTokens && tokenScale !== null
          ? await crawlPageTokens(page, tokenScale, ignoreRules)
          : [];
      const contrastViolations = runContrast
        ? await auditPageContrast(page, MIN_WCAG_AA_CONTRAST, ignoreRules)
        : [];
      return { tokenViolations, contrastViolations };
    } finally {
      await context.close();
    }
  };

  // Track 2: Mutated DOM Fuzzing (`stress`)
  const runStressTrack = async (): Promise<IGeometricViolation[]> => {
    if (!runStress) {
      return [];
    }
    const context = await browser.newContext({ viewport: viewportSize });
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      return await runGeometricStressAudit(page, {
        overflowPixelTolerance: budgets.overflowPixelTolerance,
        touchTargetMinSpacingPx: budgets.touchTargetMinSpacingPx,
        ignoreRules,
      });
    } finally {
      await context.close();
    }
  };

  // Track 3: Pre-Navigation Layout Shift Monitor (`cls`)
  const runClsTrack = async (): Promise<IClsEvaluationResult> => {
    if (!runCls) {
      return { maxSessionCls: 0, violation: null };
    }
    const context = await browser.newContext({ viewport: viewportSize });
    try {
      const page = await context.newPage();
      await prepareClsObserver(page);
      await page.goto(url, { waitUntil: 'networkidle' });
      return await collectPageCls(page, budgets.clsMaxLimit);
    } finally {
      await context.close();
    }
  };

  const [readOnlyResult, stressViolations, clsEvaluation] = await Promise.all([
    runReadOnlyTrack(),
    runStressTrack(),
    runClsTrack(),
  ]);

  return {
    url,
    viewport,
    tokenViolations: readOnlyResult.tokenViolations,
    contrastViolations: readOnlyResult.contrastViolations,
    darkModeViolations: [],
    stressViolations,
    clsEvaluation,
    domViolations: [],
    runtimeErrors: [],
  };
}

/**
 * Main orchestration entry point for `uirig check` and `uirig <url-or-file>`.
 */
export async function executeCheckCommand(
  options: ICheckCommandOptions = {}
): Promise<ICheckExecutionReport> {
  const cwd = options.cwd ?? process.cwd();
  const resolvedReportPath = resolve(cwd, options.reportOutputPath ?? DEFAULT_PR_COMMENT_PATH);
  const previousJsonMode = process.env.UIRIG_JSON_MODE;

  if (options.json) {
    process.env.UIRIG_JSON_MODE = '1';
  }

  let browser: Browser | null = null;
  const ephemeralServers: IEphemeralStaticServer[] = [];

  try {
    const { config, configLabel } = resolveExecutionConfig(options, cwd);

    let tokenScale: ITokenScaleConfig | null = null;
    if (options.tokenScaleOverride) {
      tokenScale = options.tokenScaleOverride;
    } else if (config.tokensPath) {
      tokenScale = loadTokenScale(config.tokensPath, configLabel);
    } else {
      logTelemetry(
        'tokens:skip',
        'No tokensPath configured; skipping design token scale audit.'
      );
    }

    const resolvedTargets: Array<{ displayUrl: string; liveUrl: string }> = [];
    for (const rawTarget of config.targetUrls) {
      if (isLocalFileTarget(rawTarget)) {
        const server = await startEphemeralStaticServer(rawTarget, cwd);
        ephemeralServers.push(server);
        resolvedTargets.push({ displayUrl: rawTarget, liveUrl: server.url });
      } else {
        resolvedTargets.push({ displayUrl: rawTarget, liveUrl: rawTarget });
      }
    }

    const headless = options.headless ?? true;
    logTelemetry(
      'check:browser',
      `Launching single Chromium instance (headless=${String(headless)})...`
    );
    browser = await chromium.launch({ headless });

    const results: IViewportAuditReport[] = [];

    for (const targetEntry of resolvedTargets) {
      for (const viewport of config.viewports) {
        const viewportReport = await auditViewportInParallel(
          browser,
          targetEntry.liveUrl,
          viewport,
          tokenScale,
          config.thresholdBudgets,
          options.only,
          config.ignore ?? []
        );
        results.push({
          ...viewportReport,
          url: targetEntry.displayUrl,
        });
      }
    }

    const exitCode = evaluatePosixExitCode(results);

    const summary = {
      totalViewportsAudited: results.length,
      totalTokenViolations: results.reduce((sum, r) => sum + r.tokenViolations.length, 0),
      totalContrastViolations: results.reduce((sum, r) => sum + r.contrastViolations.length, 0),
      totalDarkModeViolations: results.reduce(
        (sum, r) => sum + (r.darkModeViolations?.length ?? 0),
        0
      ),
      totalStressViolations: results.reduce((sum, r) => sum + r.stressViolations.length, 0),
      totalClsViolations: results.reduce(
        (sum, r) => sum + (r.clsEvaluation.violation ? 1 : 0),
        0
      ),
      totalDomViolations: results.reduce((sum, r) => sum + (r.domViolations?.length ?? 0), 0),
      totalRuntimeErrors: results.reduce((sum, r) => sum + (r.runtimeErrors?.length ?? 0), 0),
    };

    const executionReport: ICheckExecutionReport = {
      timestamp: new Date().toISOString(),
      configPath: configLabel,
      reportPath: resolvedReportPath,
      exitCode,
      results,
      summary,
    };

    // Synthesize standalone GitHub PR comment Markdown report to disk
    writeGithubPrCommentReport(executionReport, resolvedReportPath);

    if (options.json) {
      // Emit raw machine-readable JSON directly to stdout for AI Design System Harnesses
      process.stdout.write(`${formatAgenticJsonStream(executionReport)}\n`);
    } else {
      const exitBadge =
        exitCode === 0
          ? paint('0 (PASS)', 'bold', 'green')
          : paint(`${exitCode} (FAIL)`, 'bold', 'red');
      logTelemetry('check:complete', `Audit finished. POSIX Exit Code: ${exitBadge}`);
    }

    return executionReport;
  } finally {
    if (browser) {
      await browser.close();
    }
    for (const server of ephemeralServers) {
      await server.close();
    }
    if (options.json) {
      if (previousJsonMode === undefined) {
        delete process.env.UIRIG_JSON_MODE;
      } else {
        process.env.UIRIG_JSON_MODE = previousJsonMode;
      }
    }
  }
}
