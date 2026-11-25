/**
 * src/commands/check.ts
 * Isolated Parallel Context Dispatcher (uirig check).
 * Launches a single Playwright Chromium instance (or reuses an injected WarmBrowserPool)
 * and orchestrates isolated BrowserContext sessions concurrently (`Promise.all`) per target
 * URL/viewport so read-only audits (`tokens`, `contrast`, `dom`, `sweep`), dark-mode parity
 * (`dark-mode`), mutated DOM fuzzing (`stress`), and pre-navigation `PerformanceObserver`
 * monitoring (`cls`) execute without cross-tool pollution or multiple browser startup overhead.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { chromium, type Browser } from 'playwright';
import { crawlPageTokens, type ITokenScaleConfig, type ITokenViolation } from '../core/tokens.js';
import {
  discoverWorkspaceTokens,
  extractRootCssVariables,
  mergeTokenScales,
  parseCssCustomPropertyTokens,
  parseW3cOrStyleDictionaryTokens,
} from '../core/auto-tokens.js';
import { auditPageContrast, type IContrastViolation, MIN_WCAG_AA_CONTRAST } from '../core/matrix.js';
import { runGeometricStressAudit, type IGeometricViolation } from '../core/adversary.js';
import {
  DEFAULT_SWEEP_SPEC,
  parseSweepRange,
  runBreakpointSweepAudit,
  type IBreakpointSweepViolation,
} from '../core/sweep.js';
import { prepareClsObserver, collectPageCls, type IClsEvaluationResult } from '../core/cls.js';
import { type WarmBrowserPool } from '../core/browser-pool.js';
import {
  applyDeterministicAutoFixes,
  computeDeterministicAutoFix,
  type IDeterministicAutoFix,
} from '../core/autofix.js';
import { logTelemetry, paint } from '../utils/formatter.js';
import { formatConsoleAuditReport } from '../utils/console-report.js';
import {
  formatAgenticJsonStream,
  normalizeViewportViolations,
} from '../utils/agent-stream.js';
import { writeGithubPrCommentReport, DEFAULT_PR_COMMENT_PATH } from '../utils/fs.js';
import { collectSpatialNodes, formatSpatialBrief } from '../utils/spatial-brief.js';
import { runDomIntegrityAudit } from '../core/dom.js';
import {
  runDarkModeAudit,
  DEFAULT_DARK_MODE_MAX_SURFACE_LUMINANCE,
} from '../core/dark-mode.js';
import {
  isLocalFileTarget,
  startEphemeralStaticServer,
  validateHttpTargetUrl,
  type IEphemeralStaticServer,
} from '../utils/static-server.js';
import {
  countMatchedSelectorsInBrowser,
  validateSelectorsInBrowser,
} from '../utils/scope.js';
import {
  resolveChangedComponentSelectors,
  type IChangedPathsConfig,
} from '../core/git-diff.js';
import type { IUirigIgnoreRule } from '../utils/ignore.js';
import { resolveA2uiAttributionsForSelectors } from '../utils/a2ui-attribution.js';
import { resolveViolationSourceLocations } from '../core/source-map.js';
import type {
  IA2uiAttribution,
  IDarkModeViolation,
  IDomIntegrityViolation,
  IRuntimeErrorViolation,
  ISourceLocation,
} from '../interfaces/locator.js';

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
  targetUrls: Array<string>;
  tokensPath?: string | Array<string>;
  autoTokens?: boolean;
  themes?: Array<string>;
  sweep?: string | boolean;
  scope?: Array<string>;
  exclude?: Array<string>;
  changedPaths?: IChangedPathsConfig;
  thresholdBudgets: IThresholdBudgets;
  viewports: Array<IViewportConfig>;
  ignore?: Array<IUirigIgnoreRule>;
}

export type AuditToolName = 'tokens' | 'contrast' | 'dark-mode' | 'stress' | 'cls' | 'dom' | 'sweep';

export interface ICheckCommandOptions {
  target?: string;
  configPath?: string;
  tokensPath?: string | Array<string>;
  json?: boolean;
  headless?: boolean;
  verbose?: boolean;
  spatialBrief?: boolean;
  groupByRoot?: boolean;
  top?: number;
  maxTokens?: number;
  scope?: Array<string>;
  selectors?: Array<string>;
  exclude?: Array<string>;
  changed?: boolean;
  baseRef?: string;
  changedPaths?: IChangedPathsConfig;
  only?: AuditToolName;
  autoTokens?: boolean;
  themes?: Array<string>;
  sweep?: string | boolean;
  fix?: boolean;
  tokenScaleOverride?: ITokenScaleConfig;
  viewportsOverride?: Array<IViewportConfig>;
  browserPool?: WarmBrowserPool;
  silentStdout?: boolean;
  reportOutputPath?: string;
  cwd?: string;
}

export interface IViewportAuditReport {
  url: string;
  viewport: IViewportConfig;
  theme?: string;
  scopedSelectors?: Array<string>;
  excludedSelectors?: Array<string>;
  matchedSelectorCount?: number;
  spatialBrief?: string;
  a2uiAttributions?: Record<string, IA2uiAttribution | null>;
  sourceLocations?: Record<string, ISourceLocation | null>;
  tokenViolations: Array<ITokenViolation>;
  contrastViolations: Array<IContrastViolation>;
  darkModeViolations?: Array<IDarkModeViolation>;
  stressViolations: Array<IGeometricViolation>;
  sweepViolations?: Array<IBreakpointSweepViolation>;
  clsEvaluation: IClsEvaluationResult;
  domViolations?: Array<IDomIntegrityViolation>;
  runtimeErrors?: Array<IRuntimeErrorViolation>;
}

export interface ICheckExecutionReport {
  timestamp: string;
  configPath: string;
  reportPath: string;
  exitCode: PosixExitCode;
  results: Array<IViewportAuditReport>;
  summary: {
    totalViewportsAudited: number;
    totalTokenViolations: number;
    totalContrastViolations: number;
    totalDarkModeViolations?: number;
    totalStressViolations: number;
    totalSweepViolations?: number;
    totalClsViolations: number;
    totalDomViolations?: number;
    totalRuntimeErrors?: number;
  };
}

export const ZERO_CONFIG_DEFAULTS: Omit<IUirigConfig, 'targetUrls'> = {
  tokensPath: undefined,
  autoTokens: false,
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
  ignore: new Array<IUirigIgnoreRule>(),
};

export const FALLBACK_TOKEN_SCALE: ITokenScaleConfig = {
  colors: ['rgb(255, 255, 255)', 'rgb(0, 0, 0)', 'rgb(17, 24, 39)', 'rgb(243, 244, 246)'],
  spacing: ['0px', '4px', '8px', '12px', '16px', '20px', '24px', '32px'],
  fontSizes: ['12px', '14px', '16px', '18px', '20px', '24px', '32px'],
  radii: ['0px', '4px', '6px', '8px', '16px', '9999px'],
};

export function loadUirigConfig(
  configPath: string = resolve(process.cwd(), 'uirig.config.json')
): IUirigConfig {
  logTelemetry('check:config', 'Loading configuration from ' + paint(configPath, 'cyan') + '...');

  if (!existsSync(configPath)) {
    throw new Error(
      'ERR_CONFIG_MISSING: Configuration file not found at ' +
        configPath +
        ". Run 'uirig init' or pass a target directly (e.g. 'uirig ./index.html')."
    );
  }

  let parsed: unknown;
  try {
    const raw = readFileSync(configPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error('ERR_CONFIG_INVALID_JSON: Failed to parse ' + configPath + ': ' + detail);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('ERR_CONFIG_SCHEMA: Configuration at ' + configPath + ' must be a JSON object.');
  }

  const candidate = parsed as Partial<IUirigConfig>;

  if (!Array.isArray(candidate.targetUrls) || candidate.targetUrls.length === 0) {
    throw new Error(
      "ERR_CONFIG_SCHEMA: 'targetUrls' must be a non-empty array of URLs in " + configPath + '.'
    );
  }

  if (candidate.tokensPath !== undefined) {
    const isValidSingle =
      typeof candidate.tokensPath === 'string' && candidate.tokensPath.trim().length > 0;
    const isValidArray =
      Array.isArray(candidate.tokensPath) &&
      candidate.tokensPath.length > 0 &&
      candidate.tokensPath.every((p) => typeof p === 'string' && p.trim().length > 0);
    if (!isValidSingle && !isValidArray) {
      throw new Error(
        "ERR_CONFIG_SCHEMA: 'tokensPath' must be a non-empty file path string or non-empty array of file path strings when specified in " +
          configPath +
          '.'
      );
    }
  }

  if (!Array.isArray(candidate.viewports) || candidate.viewports.length === 0) {
    throw new Error(
      "ERR_CONFIG_SCHEMA: 'viewports' must be a non-empty array of viewport definitions in " +
        configPath +
        '.'
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
      "ERR_CONFIG_SCHEMA: 'thresholdBudgets' must define numeric clsMaxLimit, overflowPixelTolerance, and touchTargetMinSpacingPx."
    );
  }

  const ignoreRules = new Array<IUirigIgnoreRule>();
  if (candidate.ignore !== undefined) {
    if (!Array.isArray(candidate.ignore)) {
      throw new Error("ERR_CONFIG_SCHEMA: 'ignore' must be an array of ignore rule objects.");
    }
    for (const entry of candidate.ignore) {
      if (typeof entry !== 'object' || entry === null || typeof entry.rule !== 'string') {
        throw new Error("ERR_CONFIG_SCHEMA: Each entry in 'ignore' must specify a 'rule' string.");
      }
      ignoreRules.push({
        rule: entry.rule,
        selector: typeof entry.selector === 'string' ? entry.selector : undefined,
        url: typeof entry.url === 'string' ? entry.url : undefined,
      });
    }
  }

  const configThemes = Array.isArray(candidate.themes)
    ? candidate.themes.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : undefined;

  let configScope: Array<string> | undefined;
  if (candidate.scope !== undefined) {
    if (
      !Array.isArray(candidate.scope) ||
      !candidate.scope.every((s) => typeof s === 'string' && s.trim().length > 0)
    ) {
      throw new Error(
        "ERR_CONFIG_SCHEMA: 'scope' must be an array of non-empty CSS selector strings."
      );
    }
    if (candidate.scope.length > 0) {
      configScope = candidate.scope.map((s) => s.trim());
    }
  }

  let configExclude: Array<string> | undefined;
  if (candidate.exclude !== undefined) {
    if (
      !Array.isArray(candidate.exclude) ||
      !candidate.exclude.every((s) => typeof s === 'string' && s.trim().length > 0)
    ) {
      throw new Error(
        "ERR_CONFIG_SCHEMA: 'exclude' must be an array of non-empty CSS selector strings."
      );
    }
    if (candidate.exclude.length > 0) {
      configExclude = candidate.exclude.map((s) => s.trim());
    }
  }

  const rawChangedPaths = candidate.changedPaths;
  let parsedChangedPaths: IChangedPathsConfig | undefined;
  if (rawChangedPaths !== undefined) {
    if (typeof rawChangedPaths !== 'object' || rawChangedPaths === null) {
      throw new Error(
        "ERR_CONFIG_SCHEMA: 'changedPaths' must be an object with optional 'include' and 'exclude' string arrays."
      );
    }
    const include = Array.isArray(rawChangedPaths.include)
      ? rawChangedPaths.include.filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
      : undefined;
    const exclude = Array.isArray(rawChangedPaths.exclude)
      ? rawChangedPaths.exclude.filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
      : undefined;
    if ((include && include.length > 0) || (exclude && exclude.length > 0)) {
      parsedChangedPaths = {
        ...(include && include.length > 0 ? { include } : {}),
        ...(exclude && exclude.length > 0 ? { exclude } : {}),
      };
    }
  }

  const parsedSweep =
    typeof candidate.sweep === 'string' && candidate.sweep.trim().length > 0
      ? candidate.sweep.trim()
      : candidate.sweep === true
        ? true
        : undefined;

  return {
    $schema: candidate.$schema,
    targetUrls: candidate.targetUrls,
    tokensPath: candidate.tokensPath,
    autoTokens: candidate.autoTokens === true,
    ...(configThemes && configThemes.length > 0 ? { themes: configThemes } : {}),
    ...(parsedSweep !== undefined ? { sweep: parsedSweep } : {}),
    ...(configScope ? { scope: configScope } : {}),
    ...(configExclude ? { exclude: configExclude } : {}),
    ...(parsedChangedPaths ? { changedPaths: parsedChangedPaths } : {}),
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
      'Running in zero-config mode against ' + paint(options.target, 'cyan') + '...'
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
  throw new Error('ERR_CONFIG_MISSING: Configuration file not found at ' + defaultConfigPath + '.');
}
const TOKEN_FORMAT_REMEDIATION_GUIDE =
  'Supported formats for tokensPath / --tokens-path: ' +
  '(1) W3C Design Tokens JSON (nested objects with "$value" leaves), ' +
  '(2) Style Dictionary JSON (nested objects with "value" leaves), ' +
  '(3) Flat scale JSON ({ "colors": [...], "spacing": [...], "fontSizes": [...], "radii": [...] }), or ' +
  '(4) CSS custom properties stylesheet (.css with :root { --*: ... } or @theme { --*: ... }). ' +
  'Alternatively, omit tokensPath and pass --auto-tokens to auto-discover tokens automatically.';

function hasAnyNormalizedTokens(scale: ITokenScaleConfig): boolean {
  return (
    scale.colors.length > 0 ||
    scale.spacing.length > 0 ||
    scale.fontSizes.length > 0 ||
    scale.radii.length > 0
  );
}

export function loadTokenScale(
  tokensPath: string | Array<string>,
  basePathForResolution: string
): ITokenScaleConfig {
  const pathList = Array.isArray(tokensPath) ? tokensPath : [tokensPath];
  if (pathList.length === 0 || pathList.some((p) => p.trim().length === 0)) {
    throw new Error(
      'ERR_TOKENS_SCHEMA: tokensPath must contain at least one non-empty file path. ' +
        TOKEN_FORMAT_REMEDIATION_GUIDE
    );
  }

  const baseDir =
    basePathForResolution.endsWith('.json')
      ? dirname(basePathForResolution)
      : basePathForResolution;

  const scales = new Array<ITokenScaleConfig>();
  const cssContents = new Array<string>();

  for (const singlePath of pathList) {
    const resolvedTokensPath = resolve(baseDir, singlePath.trim());
    logTelemetry(
      'check:tokens',
      'Loading design token scale from ' + paint(resolvedTokensPath, 'cyan') + '...'
    );

    if (!existsSync(resolvedTokensPath)) {
      throw new Error(
        'ERR_TOKENS_MISSING: Token scale file not found at ' +
          resolvedTokensPath +
          '. Check the path in tokensPath / --tokens-path, or pass --auto-tokens.'
      );
    }

    let raw: string;
    try {
      raw = readFileSync(resolvedTokensPath, 'utf8');
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error('ERR_TOKENS_MISSING: Unable to read ' + resolvedTokensPath + ': ' + detail);
    }

    if (resolvedTokensPath.toLowerCase().endsWith('.css')) {
      cssContents.push(raw);
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        'ERR_TOKENS_INVALID_JSON: Failed to parse ' +
          resolvedTokensPath +
          ': ' +
          detail +
          '. ' +
          TOKEN_FORMAT_REMEDIATION_GUIDE
      );
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(
        'ERR_TOKENS_SCHEMA: Token file at ' +
          resolvedTokensPath +
          ' must be a JSON object. ' +
          TOKEN_FORMAT_REMEDIATION_GUIDE
      );
    }

    const candidate = parsed as Partial<ITokenScaleConfig>;
    const hasFlatArrayShape =
      Array.isArray(candidate.colors) ||
      Array.isArray(candidate.spacing) ||
      Array.isArray(candidate.fontSizes) ||
      Array.isArray(candidate.radii);

    if (hasFlatArrayShape) {
      if (
        !Array.isArray(candidate.colors) ||
        !Array.isArray(candidate.spacing) ||
        !Array.isArray(candidate.fontSizes) ||
        !Array.isArray(candidate.radii) ||
        !candidate.colors.every((v) => typeof v === 'string') ||
        !candidate.spacing.every((v) => typeof v === 'string') ||
        !candidate.fontSizes.every((v) => typeof v === 'string') ||
        !candidate.radii.every((v) => typeof v === 'string')
      ) {
        throw new Error(
          'ERR_TOKENS_SCHEMA: Flat token scale JSON at ' +
            resolvedTokensPath +
            ' must define string arrays for all four keys: colors, spacing, fontSizes, and radii. ' +
            TOKEN_FORMAT_REMEDIATION_GUIDE
        );
      }
      scales.push({
        colors: candidate.colors,
        spacing: candidate.spacing,
        fontSizes: candidate.fontSizes,
        radii: candidate.radii,
      });
      continue;
    }

    const dictionaryScale = parseW3cOrStyleDictionaryTokens(raw);
    if (!hasAnyNormalizedTokens(dictionaryScale)) {
      throw new Error(
        'ERR_TOKENS_SCHEMA: Token file at ' +
          resolvedTokensPath +
          ' did not match flat scale arrays or W3C ($value) / Style Dictionary (value) token entries. ' +
          TOKEN_FORMAT_REMEDIATION_GUIDE
      );
    }
    scales.push(dictionaryScale);
  }
  if (cssContents.length > 0) {
    const cssScale = parseCssCustomPropertyTokens(cssContents.join('\n'));
    if (!hasAnyNormalizedTokens(cssScale)) {
      throw new Error(
        'ERR_TOKENS_SCHEMA: No valid CSS custom properties (--*) with color or length values were found in the specified CSS file(s). ' +
          TOKEN_FORMAT_REMEDIATION_GUIDE
      );
    }
    scales.push(cssScale);
  }

  const firstScale = scales.at(0);
  if (pathList.length === 1 && scales.length === 1 && firstScale !== undefined) {
    return firstScale;
  }

  return mergeTokenScales(...scales);
}

export function evaluatePosixExitCode(results: Array<IViewportAuditReport>): PosixExitCode {
  let hasStructuralOrClsFailure = false;
  let hasPolicyOrIntegrityFailure = false;

  for (const report of results) {
    if (
      report.stressViolations.length > 0 ||
      (report.sweepViolations?.length ?? 0) > 0 ||
      report.clsEvaluation.violation !== null
    ) {
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

export async function auditViewportInParallel(
  browser: Browser,
  url: string,
  viewport: IViewportConfig,
  tokenScale: ITokenScaleConfig | null,
  budgets: IThresholdBudgets,
  only?: AuditToolName,
  ignoreRules: Array<IUirigIgnoreRule> = new Array<IUirigIgnoreRule>(),
  isLocalStaticTarget: boolean = false,
  selectors?: Array<string>,
  includeSpatialBrief: boolean = false,
  autoDiscoverRootTokens: boolean = false,
  themeName?: string,
  cwd: string = process.cwd(),
  sweepSpec?: string
): Promise<IViewportAuditReport> {
  const viewportSize = { width: viewport.width, height: viewport.height };
  const isDarkThemeSkin = themeName ? /(?:^|[-_])dark(?:$|[-_])/i.test(themeName) : false;
  const contextOptions = {
    viewport: viewportSize,
    ...(themeName
      ? { colorScheme: (isDarkThemeSkin ? 'dark' : 'light') as 'dark' | 'light' }
      : {}),
  };
  const runContrast = !only || only === 'contrast';
  const runDarkMode = !only || only === 'dark-mode';
  const runStress = !only || only === 'stress';
  const runCls = !only || only === 'cls';
  const runDom = !only || only === 'dom';
  const runSweep = sweepSpec !== undefined && (!only || only === 'sweep');
  const runRuntimeCapture = !only;
  const hasSelectors = Boolean(selectors && selectors.length > 0);

  const activeScope = only ? 'single engine (' + only + ')' : '4 isolated contexts';
  const selectorTag = hasSelectors && selectors ? ' [scope: ' + selectors.join(', ') + ']' : '';
  const themeTag = themeName ? ' [theme: ' + themeName + ']' : '';
  const sweepTag = runSweep && sweepSpec ? ' [sweep: ' + sweepSpec + ']' : '';
  const vpLabel =
    viewport.name + ' (' + viewport.width + 'x' + viewport.height + ')' + themeTag + sweepTag;
  logTelemetry(
    'check:dispatch',
    'Running ' +
      activeScope +
      selectorTag +
      ' for ' +
      paint(url, 'cyan') +
      ' @ ' +
      paint(vpLabel, 'bold', 'green') +
      '...'
  );
  let effectiveTokenScale: ITokenScaleConfig | null = tokenScale;
  if (autoDiscoverRootTokens) {
    const probeContext = await browser.newContext(contextOptions);
    try {
      const probePage = await probeContext.newPage();
      await probePage.goto(url, { waitUntil: 'networkidle' });
      if (themeName) {
        await probePage.evaluate((t: string) => {
          document.documentElement.setAttribute('data-theme', t);
        }, themeName);
      }
      const liveRootTokens = await extractRootCssVariables(probePage);
      effectiveTokenScale = mergeTokenScales(
        tokenScale ?? { colors: [], spacing: [], fontSizes: [], radii: [] },
        liveRootTokens
      );
    } finally {
      await probeContext.close();
    }
  }

  const runTokens = (!only || only === 'tokens') && effectiveTokenScale !== null;

  const runDarkModeTrack = async (): Promise<Array<IDarkModeViolation>> => {
    if (!runDarkMode) {
      return new Array<IDarkModeViolation>();
    }
    const context = await browser.newContext(contextOptions);
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      if (themeName) {
        await page.evaluate((t: string) => {
          document.documentElement.setAttribute('data-theme', t);
        }, themeName);
      }
      return await runDarkModeAudit(page, {
        maxSurfaceLuminance:
          budgets.darkModeMaxSurfaceLuminance ?? DEFAULT_DARK_MODE_MAX_SURFACE_LUMINANCE,
        ignoreRules,
        allowedColors: effectiveTokenScale?.colors ?? new Array<string>(),
        selectors,
      });
    } finally {
      await context.close();
    }
  };

  const runStressTrack = async (): Promise<Array<IGeometricViolation>> => {
    if (!runStress) {
      return new Array<IGeometricViolation>();
    }
    const context = await browser.newContext(contextOptions);
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      if (themeName) {
        await page.evaluate((t: string) => {
          document.documentElement.setAttribute('data-theme', t);
        }, themeName);
      }
      return await runGeometricStressAudit(page, {
        overflowPixelTolerance: budgets.overflowPixelTolerance,
        touchTargetMinSpacingPx: budgets.touchTargetMinSpacingPx,
        ignoreRules,
        selectors,
      });
    } finally {
      await context.close();
    }
  };

  const runClsTrack = async (): Promise<IClsEvaluationResult> => {
    if (!runCls) {
      return { maxSessionCls: 0, violation: null };
    }
    const context = await browser.newContext(contextOptions);
    try {
      const page = await context.newPage();
      await prepareClsObserver(page);
      await page.goto(url, { waitUntil: 'networkidle' });
      if (themeName) {
        await page.evaluate((t: string) => {
          document.documentElement.setAttribute('data-theme', t);
        }, themeName);
      }
      return await collectPageCls(page, budgets.clsMaxLimit);
    } finally {
      await context.close();
    }
  };

  const [darkModeViolations, stressViolations, clsEvaluation] = await Promise.all([
    runDarkModeTrack(),
    runStressTrack(),
    runClsTrack(),
  ]);
  const runReadOnlyTrack = async (): Promise<{
    matchedSelectorCount?: number;
    spatialBrief?: string;
    a2uiAttributions?: Record<string, IA2uiAttribution | null>;
    sourceLocations?: Record<string, ISourceLocation | null>;
    tokenViolations: Array<ITokenViolation>;
    contrastViolations: Array<IContrastViolation>;
    sweepViolations: Array<IBreakpointSweepViolation>;
    domViolations: Array<IDomIntegrityViolation>;
    runtimeErrors: Array<IRuntimeErrorViolation>;
  }> => {
    const hasMutatingViolations =
      darkModeViolations.length > 0 || stressViolations.length > 0;
    if (
      !runTokens &&
      !runContrast &&
      !runDom &&
      !runSweep &&
      !runRuntimeCapture &&
      !hasSelectors &&
      !includeSpatialBrief &&
      !hasMutatingViolations
    ) {
      return {
        tokenViolations: new Array<ITokenViolation>(),
        contrastViolations: new Array<IContrastViolation>(),
        sweepViolations: new Array<IBreakpointSweepViolation>(),
        domViolations: new Array<IDomIntegrityViolation>(),
        runtimeErrors: new Array<IRuntimeErrorViolation>(),
      };
    }
    const context = await browser.newContext(contextOptions);
    try {
      const page = await context.newPage();
      const runtimeErrors = new Array<IRuntimeErrorViolation>();

      if (runRuntimeCapture) {
        page.on('pageerror', (err: Error) => {
          runtimeErrors.push({
            source: 'pageerror',
            message: err.message,
            location: url,
          });
        });
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            const loc = msg.location();
            runtimeErrors.push({
              source: 'console_error',
              message: msg.text(),
              location: loc.url ? loc.url + ':' + loc.lineNumber : url,
            });
          }
        });
      }

      const response = await page.goto(url, { waitUntil: 'networkidle' });
      if (themeName) {
        await page.evaluate((t: string) => {
          document.documentElement.setAttribute('data-theme', t);
        }, themeName);
      }
      let matchedSelectorCount: number | undefined;
      if (hasSelectors && selectors) {
        matchedSelectorCount = await countMatchedSelectorsInBrowser(page, selectors);
        const countBadge =
          matchedSelectorCount === 0
            ? paint('0 (WARNING: selector matched 0 elements!)', 'bold', 'yellow')
            : paint(String(matchedSelectorCount), 'bold', 'cyan');
        logTelemetry('check:scope', 'Selectors matched on page: ' + countBadge);
      }

      let spatialBrief: string | undefined;
      if (includeSpatialBrief) {
        const rawSpatialNodes = await page.evaluate(
          collectSpatialNodes,
          selectors ?? new Array<string>()
        );
        spatialBrief = formatSpatialBrief(rawSpatialNodes);
        logTelemetry(
          'check:spatial-brief',
          'Collected spatial brief (' +
            rawSpatialNodes.length +
            ' raw nodes): ' +
            (spatialBrief || '(none)')
        );
      }

      const tokenViolations =
        runTokens && effectiveTokenScale !== null
          ? await crawlPageTokens(page, effectiveTokenScale, ignoreRules, selectors)
          : new Array<ITokenViolation>();
      const contrastViolations = runContrast
        ? await auditPageContrast(
            page,
            MIN_WCAG_AA_CONTRAST,
            ignoreRules,
            'contrast',
            effectiveTokenScale?.colors ?? new Array<string>(),
            selectors
          )
        : new Array<IContrastViolation>();

      const domViolations = runDom
        ? await runDomIntegrityAudit(page, {
            navigationResponse: isLocalStaticTarget ? null : response,
            ignoreRules,
            selectors,
          })
        : new Array<IDomIntegrityViolation>();

      const sweepViolations =
        runSweep && sweepSpec !== undefined
          ? await runBreakpointSweepAudit(page, {
              sweepSpec,
              viewportHeight: viewport.height,
              overflowPixelTolerance: budgets.overflowPixelTolerance,
              touchTargetMinSpacingPx: budgets.touchTargetMinSpacingPx,
              ignoreRules,
              selectors,
            })
          : new Array<IBreakpointSweepViolation>();

      const candidateSelectors = [
        ...tokenViolations.map((v) => v.selector),
        ...contrastViolations.map((v) => v.selector),
        ...darkModeViolations.map((v) => v.selector),
        ...stressViolations.map((v) => v.selector),
        ...sweepViolations.map((v) => v.selector),
        ...domViolations.map((v) => v.selector),
      ];
      let a2uiAttributions: Record<string, IA2uiAttribution | null> | undefined;
      let sourceLocations: Record<string, ISourceLocation | null> | undefined;
      if (candidateSelectors.length > 0) {
        const [resolvedA2uiMap, resolvedSourceMap] = await Promise.all([
          resolveA2uiAttributionsForSelectors(page, candidateSelectors),
          resolveViolationSourceLocations(page, candidateSelectors, cwd),
        ]);
        a2uiAttributions = Object.fromEntries(resolvedA2uiMap.entries());
        sourceLocations = Object.fromEntries(resolvedSourceMap.entries());
      }

      return {
        matchedSelectorCount,
        spatialBrief,
        a2uiAttributions,
        sourceLocations,
        tokenViolations,
        contrastViolations,
        sweepViolations,
        domViolations,
        runtimeErrors,
      };
    } finally {
      await context.close();
    }
  };

  const readOnlyResult = await runReadOnlyTrack();

  return {
    url,
    viewport,
    ...(themeName ? { theme: themeName } : {}),
    ...(hasSelectors && selectors
      ? {
          scopedSelectors: selectors,
          matchedSelectorCount: readOnlyResult.matchedSelectorCount ?? 0,
        }
      : {}),
    ...(readOnlyResult.spatialBrief !== undefined
      ? { spatialBrief: readOnlyResult.spatialBrief }
      : {}),
    ...(readOnlyResult.a2uiAttributions !== undefined
      ? { a2uiAttributions: readOnlyResult.a2uiAttributions }
      : {}),
    ...(readOnlyResult.sourceLocations !== undefined
      ? { sourceLocations: readOnlyResult.sourceLocations }
      : {}),
    tokenViolations: readOnlyResult.tokenViolations,
    contrastViolations: readOnlyResult.contrastViolations,
    darkModeViolations,
    stressViolations,
    ...(readOnlyResult.sweepViolations.length > 0
      ? { sweepViolations: readOnlyResult.sweepViolations }
      : {}),
    clsEvaluation,
    domViolations: readOnlyResult.domViolations,
    runtimeErrors: readOnlyResult.runtimeErrors,
  };
}
export async function executeCheckCommand(
  options: ICheckCommandOptions = {}
): Promise<ICheckExecutionReport> {
  const cwd = options.cwd ?? process.cwd();
  const resolvedReportPath = resolve(cwd, options.reportOutputPath ?? DEFAULT_PR_COMMENT_PATH);
  const previousJsonMode = process.env.UIRIG_JSON_MODE;

  if (options.json) {
    process.env.UIRIG_JSON_MODE = '1';
  }

  let ownedBrowser: Browser | null = null;
  const ephemeralServers = new Array<IEphemeralStaticServer>();

  try {
    const { config, configLabel } = resolveExecutionConfig(options, cwd);

    const rawSweep = options.sweep !== undefined ? options.sweep : config.sweep;
    const effectiveSweepSpec: string | undefined =
      options.only === 'sweep'
        ? typeof rawSweep === 'string' && rawSweep.trim().length > 0
          ? rawSweep.trim()
          : DEFAULT_SWEEP_SPEC
        : typeof rawSweep === 'string' && rawSweep.trim().length > 0
          ? rawSweep.trim()
          : rawSweep === true
            ? DEFAULT_SWEEP_SPEC
            : undefined;
    if (effectiveSweepSpec !== undefined) {
      parseSweepRange(effectiveSweepSpec);
    }

    let effectiveSelectors: Array<string> | undefined = options.selectors
      ? [...options.selectors]
      : undefined;

    if (options.changed) {
      const effectiveChangedPaths = options.changedPaths ?? config.changedPaths;
      const diffResolution = resolveChangedComponentSelectors(
        cwd,
        options.baseRef,
        effectiveChangedPaths
      );
      if (!diffResolution.isGitRepo) {
        logTelemetry(
          'check:changed',
          'Not inside a Git work tree; running full audit without --changed scoping.'
        );
      } else if (diffResolution.changedUiFiles.length === 0) {
        const refLabel = options.baseRef ? ' against ' + options.baseRef : '';
        const noChangeMessage =
          'No UI/component files changed' + refLabel + '; skipping browser audit (0 violations).';
        logTelemetry('check:changed', noChangeMessage);

        const emptyReport: ICheckExecutionReport = {
          timestamp: new Date().toISOString(),
          configPath: configLabel,
          reportPath: resolvedReportPath,
          exitCode: 0,
          results: new Array<IViewportAuditReport>(),
          summary: {
            totalViewportsAudited: 0,
            totalTokenViolations: 0,
            totalContrastViolations: 0,
            totalDarkModeViolations: 0,
            totalStressViolations: 0,
            totalSweepViolations: 0,
            totalClsViolations: 0,
            totalDomViolations: 0,
            totalRuntimeErrors: 0,
          },
        };

        if (!options.silentStdout) {
          if (options.json) {
            process.stdout.write(
              formatAgenticJsonStream(emptyReport, {
                groupByRoot: options.groupByRoot,
                top: options.top,
                maxTokens: options.maxTokens,
                cwd,
              }) + '\n'
            );
          } else {
            process.stdout.write(paint(noChangeMessage, 'green') + '\n');
          }
        }
        return emptyReport;
      } else if (diffResolution.inferredSelectors.length > 0) {
        const merged = new Set<string>([
          ...(effectiveSelectors ?? new Array<string>()),
          ...diffResolution.inferredSelectors,
        ]);
        effectiveSelectors = Array.from(merged);
        logTelemetry(
          'check:changed',
          'Scoped audit to ' +
            paint(String(effectiveSelectors.length), 'bold', 'cyan') +
            ' changed component selector(s): ' +
            paint(effectiveSelectors.join(', '), 'cyan')
        );
      } else {
        logTelemetry(
          'check:changed',
          'UI files changed (' +
            diffResolution.changedUiFiles.join(', ') +
            ') without custom element tags; running full-page audit.'
        );
      }
    }

    const baseViewports =
      options.viewportsOverride && options.viewportsOverride.length > 0
        ? options.viewportsOverride
        : config.viewports;
    const firstBaseViewport = baseViewports.at(0);
    const activeViewports =
      effectiveSweepSpec !== undefined &&
      !options.viewportsOverride &&
      baseViewports.length > 1 &&
      firstBaseViewport !== undefined
        ? [firstBaseViewport]
        : baseViewports;
    const autoTokensEnabled = Boolean(options.autoTokens ?? config.autoTokens);
    const effectiveTokensPath = options.tokensPath ?? config.tokensPath;
    const tokensResolutionBase = options.tokensPath ? cwd : configLabel;
    const tokenAgnosticEngines = new Set<AuditToolName>(['stress', 'cls', 'dom', 'sweep']);
    const softTokenEngines = new Set<AuditToolName>(['contrast', 'dark-mode']);
    let tokenScale: ITokenScaleConfig | null = null;
    let shouldAutoDiscoverRootTokens = false;

    if (options.tokenScaleOverride) {
      tokenScale = options.tokenScaleOverride;
    } else if (options.only && tokenAgnosticEngines.has(options.only)) {
      logTelemetry(
        'tokens:skip',
        "Skipping token scale load for '" + options.only + "' engine."
      );
    } else if (effectiveTokensPath) {
      try {
        tokenScale = loadTokenScale(effectiveTokensPath, tokensResolutionBase);
      } catch (err: unknown) {
        const isMissingTokens =
          err instanceof Error && err.message.startsWith('ERR_TOKENS_MISSING');
        if (
          isMissingTokens &&
          options.target &&
          options.only &&
          softTokenEngines.has(options.only)
        ) {
          const formattedTokensPath = Array.isArray(effectiveTokensPath)
            ? effectiveTokensPath.join(', ')
            : effectiveTokensPath;
          console.error(
            '[tokens:warn] Missing tokensPath (' +
              formattedTokensPath +
              "); continuing '" +
              options.only +
              "' audit without token suggestions."
          );
          tokenScale = null;
        } else {
          throw err;
        }
      }
    } else if (autoTokensEnabled) {
      logTelemetry(
        'tokens:auto-discover',
        'Auto-discovering design tokens from workspace files and live :root CSS variables...'
      );
      tokenScale = discoverWorkspaceTokens(cwd);
      shouldAutoDiscoverRootTokens = true;
    } else {
      logTelemetry(
        'tokens:skip',
        'No tokensPath configured; skipping design token scale audit.'
      );
    }

    const resolvedTargets = new Array<{ displayUrl: string; liveUrl: string; isLocal: boolean }>();
    for (const rawTarget of config.targetUrls) {
      if (isLocalFileTarget(rawTarget)) {
        const server = await startEphemeralStaticServer(rawTarget, cwd);
        ephemeralServers.push(server);
        resolvedTargets.push({ displayUrl: rawTarget, liveUrl: server.url, isLocal: true });
      } else {
        const urlError = validateHttpTargetUrl(rawTarget);
        if (urlError !== null) {
          throw new Error(urlError);
        }
        resolvedTargets.push({ displayUrl: rawTarget, liveUrl: rawTarget, isLocal: false });
      }
    }

    let browser: Browser;
    if (options.browserPool) {
      logTelemetry('check:browser', 'Acquiring warm Chromium instance from pool...');
      browser = await options.browserPool.acquire();
    } else {
      const headless = options.headless ?? true;
      logTelemetry(
        'check:browser',
        'Launching single Chromium instance (headless=' + String(headless) + ')...'
      );
      ownedBrowser = await chromium.launch({ headless });
      browser = ownedBrowser;
    }

    if (effectiveSelectors && effectiveSelectors.length > 0) {
      const validationContext = await browser.newContext();
      try {
        const validationPage = await validationContext.newPage();
        await validateSelectorsInBrowser(validationPage, effectiveSelectors);
      } finally {
        await validationContext.close();
      }
    }

    const rawThemes =
      options.themes && options.themes.length > 0 ? options.themes : config.themes;
    const activeThemes: Array<string | undefined> =
      rawThemes && rawThemes.length > 0 ? rawThemes : [undefined];

    const runMatrixSweep = async (): Promise<Array<IViewportAuditReport>> => {
      const sweepResults = new Array<IViewportAuditReport>();
      for (const targetEntry of resolvedTargets) {
        for (const viewport of activeViewports) {
          for (const themeName of activeThemes) {
            const viewportReport = await auditViewportInParallel(
              browser,
              targetEntry.liveUrl,
              viewport,
              tokenScale,
              config.thresholdBudgets,
              options.only,
              config.ignore ?? new Array<IUirigIgnoreRule>(),
              targetEntry.isLocal,
              effectiveSelectors,
              Boolean(options.spatialBrief),
              shouldAutoDiscoverRootTokens,
              themeName,
              cwd,
              effectiveSweepSpec
            );
            sweepResults.push({
              ...viewportReport,
              url: targetEntry.displayUrl,
            });
          }
        }
      }
      return sweepResults;
    };

    let results = await runMatrixSweep();
    let appliedFixes = new Array<IDeterministicAutoFix>();

    if (options.fix && evaluatePosixExitCode(results) !== 0) {
      const candidateFixes = new Array<IDeterministicAutoFix>();
      for (const vpReport of results) {
        for (const item of normalizeViewportViolations(vpReport)) {
          const fix = computeDeterministicAutoFix(item, cwd);
          if (fix) {
            candidateFixes.push(fix);
          }
        }
      }

      if (candidateFixes.length > 0) {
        appliedFixes = applyDeterministicAutoFixes(candidateFixes, cwd);
        if (appliedFixes.length > 0) {
          logTelemetry(
            'check:autofix',
            'Applied ' +
              paint(String(appliedFixes.length), 'bold', 'green') +
              ' deterministic fix(es) on disk; running re-verification pass...'
          );
          results = await runMatrixSweep();
        }
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
      totalSweepViolations: results.reduce(
        (sum, r) => sum + (r.sweepViolations?.length ?? 0),
        0
      ),
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

    writeGithubPrCommentReport(executionReport, resolvedReportPath);

    if (!options.silentStdout) {
      if (options.json) {
        const jsonOutput = formatAgenticJsonStream(executionReport, {
          groupByRoot: options.groupByRoot,
          top: options.top,
          maxTokens: options.maxTokens,
          cwd,
        });
        process.stdout.write(jsonOutput + '\n');
      } else {
        if (appliedFixes.length > 0) {
          process.stdout.write(
            paint(
              'Auto-Fix Applied: Patched ' +
                appliedFixes.length +
                ' line(s) across ' +
                new Set(appliedFixes.map((f) => f.sourceFile)).size +
                ' file(s) and re-verified.',
              'green'
            ) + '\n'
          );
        }
        process.stdout.write(
          formatConsoleAuditReport(executionReport, { verbose: options.verbose })
        );
        if (
          options.groupByRoot ||
          options.top !== undefined ||
          options.maxTokens !== undefined
        ) {
          const parsedSummary = JSON.parse(
            formatAgenticJsonStream(executionReport, {
              groupByRoot: options.groupByRoot,
              top: options.top,
              maxTokens: options.maxTokens,
              cwd,
            })
          ) as {
            totalViolations?: number;
            truncatedCount?: number;
            violations: Array<{ childCount?: number }>;
          };
          if (options.groupByRoot) {
            const groupedParents = parsedSummary.violations.filter(
              (v) => v.childCount !== undefined && v.childCount > 1
            );
            if (groupedParents.length > 0) {
              const collapsedChildren = groupedParents.reduce(
                (sum, v) => sum + (v.childCount ?? 0),
                0
              );
              process.stdout.write(
                paint(
                  'Root-Cause Grouping: Collapsed ' +
                    collapsedChildren +
                    ' child violations into ' +
                    groupedParents.length +
                    ' shared parent container(s).',
                  'cyan'
                ) + '\n'
              );
            }
          }
          if (
            parsedSummary.truncatedCount !== undefined &&
            parsedSummary.truncatedCount > 0 &&
            parsedSummary.totalViolations !== undefined
          ) {
            process.stdout.write(
              paint(
                'Output Limit: Showing top ' +
                  parsedSummary.violations.length +
                  ' of ' +
                  parsedSummary.totalViolations +
                  ' violations (' +
                  parsedSummary.truncatedCount +
                  ' omitted; re-run without --top/--max-tokens to inspect all).',
                'yellow'
              ) + '\n'
            );
          }
        }
        if (options.spatialBrief) {
          for (const vpReport of executionReport.results) {
            if (vpReport.spatialBrief !== undefined) {
              const themeTag = vpReport.theme ? ' [theme: ' + vpReport.theme + ']' : '';
              const vpTag = paint(
                vpReport.viewport.name +
                  ' (' +
                  vpReport.viewport.width +
                  'x' +
                  vpReport.viewport.height +
                  ')' +
                  themeTag,
                'bold',
                'cyan'
              );
              process.stdout.write(
                'Spatial Brief [' + vpTag + ']: ' + (vpReport.spatialBrief || '(no visible landmarks)') + '\n'
              );
            }
          }
        }
        const exitBadge =
          exitCode === 0
            ? paint('0 (PASS)', 'bold', 'green')
            : paint(String(exitCode) + ' (FAIL)', 'bold', 'red');
        logTelemetry('check:complete', 'Audit finished. POSIX Exit Code: ' + exitBadge);
      }
    }

    return executionReport;
  } finally {
    if (ownedBrowser) {
      await ownedBrowser.close();
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
