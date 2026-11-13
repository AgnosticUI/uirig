/**
 * src/core/dark-mode.ts
 * Dark-Mode Theme Parity & Luminance Inversion Gate (uirig dark-mode).
 * Emulates dark color scheme (`prefers-color-scheme: dark` + `data-theme="dark"`),
 * re-audits WCAG 2.1 text contrast across Light DOM and open ShadowRoots, and flags
 * large layout surfaces stranded at bright light luminance (`> darkModeMaxSurfaceLuminance`),
 * with optional `--selectors` subtree scoping.
 */

import type { Page } from 'playwright';
import {
  auditPageContrast,
  compositeBackgroundStack,
  MIN_WCAG_AA_CONTRAST,
} from './matrix.js';
import type { IDarkModeViolation } from '../interfaces/locator.js';
import { logTelemetry, paint } from '../utils/formatter.js';
import { isElementIgnoredInBrowser, type IUirigIgnoreRule } from '../utils/ignore.js';
import { isElementInSelectorScope } from '../utils/scope.js';
import {
  createBrowserDomWalker,
  extractHostComponentFromSelector,
} from '../utils/dom-walker.js';
import Color from 'colorjs.io';

export const DEFAULT_DARK_MODE_MAX_SURFACE_LUMINANCE = 0.85;
export const MIN_SURFACE_AUDIT_WIDTH_PX = 120;
export const MIN_SURFACE_AUDIT_HEIGHT_PX = 60;

export interface ISurfaceLuminanceSnapshot {
  selector: string;
  hostComponent?: string | null;
  backgroundLayers: string[];
  width: number;
  height: number;
  inShadowDom: boolean;
}

export interface IDarkModeAuditOptions {
  /** Maximum allowed WCAG relative luminance (0..1) for large surfaces in dark mode (default 0.85). */
  maxSurfaceLuminance?: number;
  /** Minimum WCAG 2.1 contrast ratio required for text in dark mode (default 4.5). */
  minContrastRatio?: number;
  /** Optional runtime ignore rules from `uirig.config.json`. */
  ignoreRules?: IUirigIgnoreRule[];
  /** Optional approved color tokens from `tokensPath` used to compute `suggestedToken` fixes. */
  allowedColors?: string[];
  /** Optional CSS selectors limiting the dark-mode audit to matching subtrees. */
  selectors?: string[];
}

/**
 * Picks the darkest compliant surface token from `allowedColors` whose relative luminance
 * stays at or below `maxSurfaceLuminance`.
 */
export function findNearestDarkSurfaceToken(
  allowedColors: string[] = [],
  maxSurfaceLuminance: number = DEFAULT_DARK_MODE_MAX_SURFACE_LUMINANCE
): string | undefined {
  let bestToken: string | undefined;
  let lowestLuminance = Number.POSITIVE_INFINITY;

  for (const rawCandidate of allowedColors) {
    try {
      const candidate = new Color(rawCandidate).to('srgb');
      if ((candidate.alpha ?? 1) < 1) {
        continue;
      }
      if (candidate.luminance <= maxSurfaceLuminance && candidate.luminance < lowestLuminance) {
        lowestLuminance = candidate.luminance;
        bestToken = rawCandidate;
      }
    } catch {
      // Ignore unparseable token entries
    }
  }

  return bestToken;
}

/**
 * Pure evaluator that composites a surface's ancestor background stack and checks
 * whether its WCAG relative luminance exceeds `maxSurfaceLuminance` in dark mode.
 */
export function evaluateDarkModeSurfaceEntry(
  entry: ISurfaceLuminanceSnapshot,
  maxSurfaceLuminance: number = DEFAULT_DARK_MODE_MAX_SURFACE_LUMINANCE,
  allowedColors: string[] = []
): IDarkModeViolation | null {
  if (entry.width <= MIN_SURFACE_AUDIT_WIDTH_PX || entry.height <= MIN_SURFACE_AUDIT_HEIGHT_PX) {
    return null;
  }

  const resolvedBg = compositeBackgroundStack(entry.backgroundLayers);
  const luminance = Math.round(resolvedBg.luminance * 1000) / 1000;

  if (luminance > maxSurfaceLuminance) {
    const [rawR, rawG, rawB] = resolvedBg.to('srgb').coords;
    const r255 = Math.round(Math.min(1, Math.max(0, rawR ?? 0)) * 255);
    const g255 = Math.round(Math.min(1, Math.max(0, rawG ?? 0)) * 255);
    const b255 = Math.round(Math.min(1, Math.max(0, rawB ?? 0)) * 255);
    const hostComponent =
      entry.hostComponent !== undefined
        ? entry.hostComponent
        : extractHostComponentFromSelector(entry.selector);
    const suggestedToken = findNearestDarkSurfaceToken(allowedColors, maxSurfaceLuminance);

    return {
      violationType: 'stranded_light_surface',
      selector: entry.selector,
      hostComponent,
      backgroundRgb: `rgb(${r255}, ${g255}, ${b255})`,
      relativeLuminance: luminance,
      ...(suggestedToken ? { suggestedToken } : {}),
      inShadowDom: entry.inShadowDom,
    };
  }

  return null;
}
/**
 * Emulates dark mode on an isolated Playwright `Page` (`colorScheme: 'dark'` + `[data-theme="dark"]`),
 * runs rendered contrast checks, and audits large layout surfaces across Light & Shadow DOM
 * for stranded bright-light backgrounds (optionally scoped to `options.selectors`).
 */
export async function runDarkModeAudit(
  page: Page,
  options: IDarkModeAuditOptions = {}
): Promise<IDarkModeViolation[]> {
  const maxSurfaceLuminance =
    options.maxSurfaceLuminance ?? DEFAULT_DARK_MODE_MAX_SURFACE_LUMINANCE;
  const minContrastRatio = options.minContrastRatio ?? MIN_WCAG_AA_CONTRAST;
  const ignoreRules = options.ignoreRules ?? [];
  const allowedColors = options.allowedColors ?? [];
  const selectors = options.selectors;

  logTelemetry(
    'dark-mode:audit',
    `Emulating dark theme & auditing contrast + surface luminance (max luminance: ${paint(
      String(maxSurfaceLuminance),
      'bold',
      'cyan'
    )})...`
  );

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });

  const violations: IDarkModeViolation[] = [];

  // 1. Re-run WCAG 2.1 contrast audit under dark mode using rule name `'dark-mode'`
  const contrastFailures = await auditPageContrast(
    page,
    minContrastRatio,
    ignoreRules,
    'dark-mode',
    allowedColors,
    selectors
  );
  for (const failure of contrastFailures) {
    violations.push({
      violationType: 'dark_mode_contrast_drop',
      selector: failure.selector,
      hostComponent: failure.hostComponent,
      foregroundRgb: failure.foregroundRgb,
      backgroundRgb: failure.backgroundRgb,
      contrastRatio: failure.contrastRatio,
      ...(failure.suggestedToken ? { suggestedToken: failure.suggestedToken } : {}),
      inShadowDom: failure.inShadowDom,
    });
  }

  // 2. Crawl large visible surfaces with explicit non-transparent backgrounds across Light & Shadow DOM
  const surfaceSnapshots = await page.evaluate(
    ({
      rules,
      activeSelectors,
      walkerFactorySrc,
      ignoreHelperSrc,
      scopeHelperSrc,
    }: {
      rules: IUirigIgnoreRule[];
      activeSelectors?: string[];
      walkerFactorySrc: string;
      ignoreHelperSrc: string;
      scopeHelperSrc: string;
    }): ISurfaceLuminanceSnapshot[] => {
      const buildWalker = new Function(
        `return (${walkerFactorySrc});`
      )() as typeof createBrowserDomWalker;
      const walker = buildWalker(
        window.location.href,
        rules,
        ignoreHelperSrc,
        activeSelectors,
        scopeHelperSrc
      );
      const surfaces: ISurfaceLuminanceSnapshot[] = [];

      function collectAncestorBackgroundLayers(el: Element): string[] {
        const bottomUpLayers: string[] = [];
        let current: Element | null = el;

        while (current) {
          const bg = window.getComputedStyle(current).backgroundColor;
          if (bg) {
            bottomUpLayers.push(bg);
          }
          if (current.parentElement) {
            current = current.parentElement;
          } else {
            const rootNode = current.getRootNode();
            current = rootNode instanceof ShadowRoot ? rootNode.host : null;
          }
        }
        return bottomUpLayers.reverse();
      }

      walker.walkElements((currentNode, meta) => {
        if (currentNode.tagName === 'BODY') {
          return;
        }
        const computed = window.getComputedStyle(currentNode);
        if (
          computed.display === 'none' ||
          computed.visibility === 'hidden' ||
          walker.isIgnored(currentNode, 'dark-mode')
        ) {
          return;
        }

        const bg = computed.backgroundColor.toLowerCase().trim();
        const isTransparent = !bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
        if (isTransparent) {
          return;
        }

        const rect = currentNode.getBoundingClientRect();
        if (rect.width > 120 && rect.height > 60) {
          surfaces.push({
            selector: meta.selector,
            hostComponent: meta.hostComponent,
            backgroundLayers: collectAncestorBackgroundLayers(currentNode),
            width: rect.width,
            height: rect.height,
            inShadowDom: meta.inShadowDom,
          });
        }
      });

      return surfaces;
    },
    {
      rules: ignoreRules,
      activeSelectors: selectors,
      walkerFactorySrc: createBrowserDomWalker.toString(),
      ignoreHelperSrc: isElementIgnoredInBrowser.toString(),
      scopeHelperSrc: isElementInSelectorScope.toString(),
    }
  );

  for (const surface of surfaceSnapshots) {
    const surfaceViolation = evaluateDarkModeSurfaceEntry(
      surface,
      maxSurfaceLuminance,
      allowedColors
    );
    if (surfaceViolation) {
      violations.push(surfaceViolation);
    }
  }

  const countBadge =
    violations.length > 0
      ? paint(String(violations.length), 'bold', 'red')
      : paint('0', 'bold', 'green');
  logTelemetry('dark-mode:audit', `Dark-mode parity audit complete. Violations detected: ${countBadge}`);

  return violations;
}
