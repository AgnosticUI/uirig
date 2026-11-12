/**
 * src/commands/check.ts
 * Isolated Parallel Context Dispatcher (uirig check).
 * Launches a single Playwright Chromium instance and orchestrates 3 isolated
 * BrowserContext sessions concurrently (`Promise.all`) per target URL/viewport
 * so read-only audits (`tokens`, `contrast`), mutated DOM fuzzing (`stress`),
 * and pre-navigation `PerformanceObserver` monitoring (`cls`) execute without
 * cross-tool pollution or multiple browser startup overhead.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { chromium, type Browser } from 'playwright';
import { crawlPageTokens, type ITokenScaleConfig, type ITokenViolation } from '../core/tokens.js';
import { auditPageContrast, type IContrastViolation } from '../core/matrix.js';
import { runGeometricStressAudit, type IGeometricViolation } from '../core/adversary.js';
import { prepareClsObserver, collectPageCls, type IClsEvaluationResult } from '../core/cls.js';
import { formatTelemetryLog, paint } from '../utils/formatter.js';

/**
 * Deterministic POSIX exit codes enforced by `uirig check`:
 * - `0`: All token, contrast, geometric stress, and CLS checks passed.
 * - `1`: Configuration/token load error, design token drift, or WCAG contrast failure (< 4.5:1).
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
}

export interface IUirigConfig {
  $schema?: string;
  targetUrls: string[];
  tokensPath: string;
  thresholdBudgets: IThresholdBudgets;
  viewports: IViewportConfig[];
}

export interface ICheckCommandOptions {
  configPath?: string;
  json?: boolean;
  headless?: boolean;
  /** Optional inline token scale override (useful for programmatic calls & tests). */
  tokenScaleOverride?: ITokenScaleConfig;
}

export interface IViewportAuditReport {
  url: string;
  viewport: IViewportConfig;
  tokenViolations: ITokenViolation[];
  contrastViolations: IContrastViolation[];
  stressViolations: IGeometricViolation[];
  clsEvaluation: IClsEvaluationResult;
}

export interface ICheckExecutionReport {
  timestamp: string;
  configPath: string;
  exitCode: PosixExitCode;
  results: IViewportAuditReport[];
  summary: {
    totalViewportsAudited: number;
    totalTokenViolations: number;
    totalContrastViolations: number;
    totalStressViolations: number;
    totalClsViolations: number;
  };
}

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
  console.log(
    formatTelemetryLog('check:config', `Loading configuration from ${paint(configPath, 'cyan')}...`)
  );

  if (!existsSync(configPath)) {
    throw new Error(
      `ERR_CONFIG_MISSING: Configuration file not found at ${configPath}. Run 'uirig init' first.`
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

  if (typeof candidate.tokensPath !== 'string' || candidate.tokensPath.trim().length === 0) {
    throw new Error(
      `ERR_CONFIG_SCHEMA: 'tokensPath' must be a valid file path string in ${configPath}.`
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

  return {
    $schema: candidate.$schema,
    targetUrls: candidate.targetUrls,
    tokensPath: candidate.tokensPath,
    thresholdBudgets: {
      clsMaxLimit: budgets.clsMaxLimit,
      overflowPixelTolerance: budgets.overflowPixelTolerance,
      touchTargetMinSpacingPx: budgets.touchTargetMinSpacingPx,
    },
    viewports: candidate.viewports,
  };
}

/**
 * Loads and validates the approved design token scale JSON referenced by `tokensPath`.
 * Resolves relative paths against the directory containing `uirig.config.json`.
 */
export function loadTokenScale(tokensPath: string, configFilePath: string): ITokenScaleConfig {
  const resolvedTokensPath = resolve(dirname(configFilePath), tokensPath);
  console.log(
    formatTelemetryLog(
      'check:tokens',
      `Loading design token scale from ${paint(resolvedTokensPath, 'cyan')}...`
    )
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
 * POSIX exit code for CI/CD pipelines (`0` = pass, `1` = token/contrast, `2` = stress/CLS).
 */
export function evaluatePosixExitCode(results: IViewportAuditReport[]): PosixExitCode {
  let hasStructuralOrClsFailure = false;
  let hasTokenOrContrastFailure = false;

  for (const report of results) {
    if (report.stressViolations.length > 0 || report.clsEvaluation.violation !== null) {
      hasStructuralOrClsFailure = true;
    }
    if (report.tokenViolations.length > 0 || report.contrastViolations.length > 0) {
      hasTokenOrContrastFailure = true;
    }
  }

  if (hasStructuralOrClsFailure) {
    return 2;
  }
  if (hasTokenOrContrastFailure) {
    return 1;
  }
  return 0;
}
/**
 * Audits a single `(url, viewport)` target across 3 isolated Playwright `BrowserContext`
 * sessions running concurrently (`Promise.all`) inside one shared Chromium browser:
 *
 * - **Context 1 (Read-Only):** Runs `crawlPageTokens()` + `auditPageContrast()` without DOM mutation.
 * - **Context 2 (Mutated Fuzzing):** Runs `runGeometricStressAudit()` (+30% pseudo-localization).
 * - **Context 3 (CLS Monitor):** Installs `prepareClsObserver()` prior to `page.goto()` and runs `collectPageCls()`.
 */
export async function auditViewportInParallel(
  browser: Browser,
  url: string,
  viewport: IViewportConfig,
  tokenScale: ITokenScaleConfig,
  budgets: IThresholdBudgets
): Promise<IViewportAuditReport> {
  const viewportSize = { width: viewport.width, height: viewport.height };
  console.log(
    formatTelemetryLog(
      'check:dispatch',
      `Spawning 3 isolated contexts for ${paint(url, 'cyan')} @ ${paint(
        `${viewport.name} (${viewport.width}x${viewport.height})`,
        'bold',
        'green'
      )}...`
    )
  );

  // Track 1: Read-Only Audits (`tokens` + `contrast`)
  const runReadOnlyTrack = async (): Promise<{
    tokenViolations: ITokenViolation[];
    contrastViolations: IContrastViolation[];
  }> => {
    const context = await browser.newContext({ viewport: viewportSize });
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const tokenViolations = await crawlPageTokens(page, tokenScale);
      const contrastViolations = await auditPageContrast(page);
      return { tokenViolations, contrastViolations };
    } finally {
      await context.close();
    }
  };

  // Track 2: Mutated DOM Fuzzing (`stress`)
  const runStressTrack = async (): Promise<IGeometricViolation[]> => {
    const context = await browser.newContext({ viewport: viewportSize });
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      return await runGeometricStressAudit(page, {
        overflowPixelTolerance: budgets.overflowPixelTolerance,
        touchTargetMinSpacingPx: budgets.touchTargetMinSpacingPx,
      });
    } finally {
      await context.close();
    }
  };

  // Track 3: Pre-Navigation Layout Shift Monitor (`cls`)
  const runClsTrack = async (): Promise<IClsEvaluationResult> => {
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
    stressViolations,
    clsEvaluation,
  };
}

/**
 * Main orchestration entry point for `uirig check`.
 * Loads configuration, launches a single Chromium browser binary, runs all configured
 * `(url, viewport)` targets through `auditViewportInParallel()`, computes aggregate counts
 * and POSIX exit code (`0`, `1`, or `2`), and guarantees browser teardown.
 */
export async function executeCheckCommand(
  options: ICheckCommandOptions = {}
): Promise<ICheckExecutionReport> {
  const resolvedConfigPath = resolve(
    process.cwd(),
    options.configPath ?? 'uirig.config.json'
  );
  const previousJsonMode = process.env.UIRIG_JSON_MODE;

  if (options.json) {
    process.env.UIRIG_JSON_MODE = '1';
  }

  let browser: Browser | null = null;

  try {
    const config = loadUirigConfig(resolvedConfigPath);
    const tokenScale =
      options.tokenScaleOverride ?? loadTokenScale(config.tokensPath, resolvedConfigPath);

    const headless = options.headless ?? true;
    console.log(
      formatTelemetryLog(
        'check:browser',
        `Launching single Chromium instance (headless=${String(headless)})...`
      )
    );
    browser = await chromium.launch({ headless });

    const results: IViewportAuditReport[] = [];

    for (const url of config.targetUrls) {
      for (const viewport of config.viewports) {
        const viewportReport = await auditViewportInParallel(
          browser,
          url,
          viewport,
          tokenScale,
          config.thresholdBudgets
        );
        results.push(viewportReport);
      }
    }

    const exitCode = evaluatePosixExitCode(results);

    const summary = {
      totalViewportsAudited: results.length,
      totalTokenViolations: results.reduce((sum, r) => sum + r.tokenViolations.length, 0),
      totalContrastViolations: results.reduce((sum, r) => sum + r.contrastViolations.length, 0),
      totalStressViolations: results.reduce((sum, r) => sum + r.stressViolations.length, 0),
      totalClsViolations: results.reduce(
        (sum, r) => sum + (r.clsEvaluation.violation ? 1 : 0),
        0
      ),
    };

    const exitBadge =
      exitCode === 0
        ? paint('0 (PASS)', 'bold', 'green')
        : paint(`${exitCode} (FAIL)`, 'bold', 'red');
    console.log(
      formatTelemetryLog('check:complete', `Audit finished. POSIX Exit Code: ${exitBadge}`)
    );

    return {
      timestamp: new Date().toISOString(),
      configPath: resolvedConfigPath,
      exitCode,
      results,
      summary,
    };
  } finally {
    if (browser) {
      await browser.close();
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
