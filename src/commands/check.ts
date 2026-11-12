/**
 * src/commands/check.ts
 * Isolated Parallel Context Dispatcher (uirig check).
 * Orchestrates concurrent headless browser validation runs across all 4 core engines
 * (`tokens`, `contrast`, `stress`, `cls`) and maps violations to POSIX exit codes.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import type { ITokenScaleConfig, ITokenViolation } from '../core/tokens.js';
import type { IContrastViolation } from '../core/matrix.js';
import type { IGeometricViolation } from '../core/adversary.js';
import type { IClsEvaluationResult } from '../core/cls.js';
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
 *
 * @param configPath - Path to `uirig.config.json` (defaults to `./uirig.config.json`).
 * @returns Validated `IUirigConfig` object.
 */
export function loadUirigConfig(
  configPath: string = resolve(process.cwd(), 'uirig.config.json')
): IUirigConfig {
  console.log(formatTelemetryLog('check:config', `Loading configuration from ${paint(configPath, 'cyan')}...`));

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
    throw new Error(`ERR_CONFIG_SCHEMA: 'tokensPath' must be a valid file path string in ${configPath}.`);
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
 *
 * @param tokensPath - Relative or absolute path to the token scale JSON file.
 * @param configFilePath - Path to `uirig.config.json` used as the base directory for relative resolution.
 * @returns Validated `ITokenScaleConfig`.
 */
export function loadTokenScale(tokensPath: string, configFilePath: string): ITokenScaleConfig {
  const resolvedTokensPath = resolve(dirname(configFilePath), tokensPath);
  console.log(
    formatTelemetryLog('check:tokens', `Loading design token scale from ${paint(resolvedTokensPath, 'cyan')}...`)
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
 * POSIX exit code for CI/CD pipelines:
 * - Returns `2` if any viewport recorded geometric stress violations OR a CLS budget breach.
 * - Returns `1` if any viewport recorded WCAG contrast violations OR design token drift.
 * - Returns `0` if every viewport passed all 4 checks cleanly.
 *
 * @param results - Completed per-viewport audit reports.
 * @returns Deterministic POSIX exit code (`0`, `1`, or `2`).
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
