/**
 * src/core/cls.ts
 * Cumulative Layout Shift Monitor Core (uirig cls).
 * Implements Google's W3C Core Web Vitals session-window scoring algorithm
 * (1-second gap / 5-second max window cap + user-input exclusion) and evaluates
 * layout stability against `clsMaxLimit`.
 */

import type { Page } from 'playwright';

/**
 * Default maximum Cumulative Layout Shift (CLS) score allowed before failing the build.
 * Matches Google's "Good" Core Web Vitals threshold and `uirig.config.json`.
 */
export const DEFAULT_CLS_MAX_LIMIT = 0.1;

/**
 * Maximum allowed gap (in milliseconds) between two consecutive layout shifts
 * for them to remain inside the same CLS session window.
 */
export const SESSION_WINDOW_MAX_GAP_MS = 1000;

/**
 * Maximum total duration (in milliseconds) of a single CLS session window
 * before a new window must begin.
 */
export const SESSION_WINDOW_MAX_DURATION_MS = 5000;

/**
 * Normalized snapshot of a single browser `layout-shift` PerformanceEntry.
 */
export interface ILayoutShiftSample {
  /** Layout shift score (`impactFraction * distanceFraction`) computed by Chromium. */
  value: number;
  /** High-resolution timestamp (`entry.startTime` in ms) when the shift occurred. */
  startTime: number;
  /** True if the shift occurred within 500ms of a discrete user input (click/keydown). */
  hadRecentInput: boolean;
  /** CSS selectors or Shadow DOM breadcrumbs of the elements that shifted. */
  affectedSelectors: string[];
}

/**
 * Diagnostic violation returned when the maximum CLS session window breaches `clsMaxLimit`.
 * Triggers POSIX exit code 2 during CI/CD verification.
 */
export interface IClsViolation {
  /** Highest session-window CLS score recorded during the page lifecycle (rounded to 4 decimals). */
  measuredClsScore: number;
  /** Configured maximum CLS budget from `uirig.config.json` (default 0.1). */
  clsMaxLimit: number;
  /** Total number of unexpected layout shift events observed in the worst session window. */
  shiftCountInWorstWindow: number;
  /** Deduplicated list of CSS selectors/Shadow DOM paths that shifted during the worst window. */
  offendingSelectors: string[];
}

/**
 * Result summary returned by `evaluateClsSamples` and `collectPageCls`.
 */
export interface IClsEvaluationResult {
  /** Maximum session-window CLS score across all recorded shifts (0 if stable). */
  maxSessionCls: number;
  /** Non-null violation object if `maxSessionCls > clsMaxLimit`; otherwise `null`. */
  violation: IClsViolation | null;
}

/**
 * Computes Google's W3C session-window CLS score from a list of raw `layout-shift`
 * samples and checks whether the worst window breaches `clsMaxLimit`.
 *
 * Session Window Rules (per web.dev/articles/cls):
 * 1. Discard any shift where `hadRecentInput === true`.
 * 2. Sort remaining unexpected shifts chronologically by `startTime`.
 * 3. Start a window on the first shift; keep adding subsequent shifts while:
 *      (current.startTime - previous.startTime < 1000ms) AND
 *      (current.startTime - windowStart.startTime < 5000ms)
 * 4. The page CLS score is the maximum sum across all session windows.
 *
 * @param samples - Raw layout shift samples captured from the browser.
 * @param clsMaxLimit - Maximum allowed CLS budget (default 0.1).
 * @returns The computed `maxSessionCls` score and an `IClsViolation` if over budget.
 */
export function evaluateClsSamples(
  samples: ILayoutShiftSample[],
  clsMaxLimit: number = DEFAULT_CLS_MAX_LIMIT
): IClsEvaluationResult {
  // Step 1: Exclude intentional user-driven shifts and zero-value entries
  const unexpectedShifts = samples
    .filter((entry) => !entry.hadRecentInput && entry.value > 0)
    .sort((a, b) => a.startTime - b.startTime);

  if (unexpectedShifts.length === 0) {
    return {
      maxSessionCls: 0,
      violation: null,
    };
  }

  // Step 2: Group shifts into bounded session windows (1s gap / 5s total cap)
  let maxWindowScore = 0;
  let worstWindowShifts: ILayoutShiftSample[] = [];

  let currentWindowScore = 0;
  let currentWindowShifts: ILayoutShiftSample[] = [];
  let windowStartTime = 0;
  let previousShiftTime = 0;

  for (const shift of unexpectedShifts) {
    const isFirstInWindow = currentWindowShifts.length === 0;
    const gapFromPrevious = shift.startTime - previousShiftTime;
    const durationFromStart = shift.startTime - windowStartTime;

    const fitsInCurrentWindow =
      !isFirstInWindow &&
      gapFromPrevious < SESSION_WINDOW_MAX_GAP_MS &&
      durationFromStart < SESSION_WINDOW_MAX_DURATION_MS;

    if (fitsInCurrentWindow) {
      currentWindowScore += shift.value;
      currentWindowShifts.push(shift);
    } else {
      // Close out the previous window if it beat our running maximum
      if (currentWindowScore > maxWindowScore) {
        maxWindowScore = currentWindowScore;
        worstWindowShifts = currentWindowShifts;
      }

      // Open a fresh session window anchored at this shift
      windowStartTime = shift.startTime;
      currentWindowScore = shift.value;
      currentWindowShifts = [shift];
    }

    previousShiftTime = shift.startTime;
  }

  // Finalize the trailing window after the loop completes
  if (currentWindowScore > maxWindowScore) {
    maxWindowScore = currentWindowScore;
    worstWindowShifts = currentWindowShifts;
  }

  // Round to 4 decimal places to match Chrome DevTools / Lighthouse precision
  const roundedMaxCls = Math.round(maxWindowScore * 10000) / 10000;

  if (roundedMaxCls > clsMaxLimit) {
    const uniqueSelectors = Array.from(
      new Set(worstWindowShifts.flatMap((s) => s.affectedSelectors))
    );

    return {
      maxSessionCls: roundedMaxCls,
      violation: {
        measuredClsScore: roundedMaxCls,
        clsMaxLimit,
        shiftCountInWorstWindow: worstWindowShifts.length,
        offendingSelectors: uniqueSelectors,
      },
    };
  }

  return {
    maxSessionCls: roundedMaxCls,
    violation: null,
  };
}

/**
 * Registers a native `PerformanceObserver` for `layout-shift` entries inside
 * the Playwright Page via both `page.addInitScript()` (for `page.goto()`) and
 * `page.evaluate()` (for `page.setContent()`).
 *
 * CRITICAL LIFECYCLE CONTRACT:
 * Call `await prepareClsObserver(page)` BEFORE calling `page.goto(...)` or `page.setContent(...)`
 * so the observer is attached before first paint and never misses early shifts.
 *
 * @param page - An active Playwright Page instance prior to navigation/content injection.
 */
export async function prepareClsObserver(page: Page): Promise<void> {
  console.log('[cls:monitor] Injecting pre-navigation layout-shift PerformanceObserver...');

  const installObserverFn = () => {
    const win = window as unknown as {
      __uirigClsRawEntries?: PerformanceEntry[];
      __uirigClsObserver?: PerformanceObserver;
    };

    // Avoid attaching duplicate observers if both addInitScript and evaluate run on the same window
    if (win.__uirigClsObserver) {
      return;
    }

    win.__uirigClsRawEntries = [];

    if (typeof PerformanceObserver !== 'undefined') {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          win.__uirigClsRawEntries?.push(entry);
        }
      });

      // `buffered: true` ensures any shifts queued just before observer creation are also captured
      observer.observe({ type: 'layout-shift', buffered: true });
      win.__uirigClsObserver = observer;
    }
  };

  // 1. Register for full page navigations (`page.goto`)
  await page.addInitScript(installObserverFn);

  // 2. Also register immediately on the current page context (`page.setContent`)
  await page.evaluate(installObserverFn);
}


/**
 * Waits for web fonts and async layout activity to settle, flushes any queued
 * `PerformanceObserver` records via `takeRecords()`, extracts Shadow-DOM-aware
 * selectors for shifted elements, and evaluates the session-window CLS score
 * against `clsMaxLimit`.
 *
 * @param page - An active Playwright Page instance after navigation/rendering.
 * @param clsMaxLimit - Maximum allowed CLS budget from `uirig.config.json` (default 0.1).
 * @param settleDelayMs - Optional settle wait in ms for late async banners/fonts (default 350ms).
 * @returns The computed `maxSessionCls` score and an `IClsViolation` if over budget.
 */
export async function collectPageCls(
  page: Page,
  clsMaxLimit: number = DEFAULT_CLS_MAX_LIMIT,
  settleDelayMs: number = 350
): Promise<IClsEvaluationResult> {
  console.log(`[cls:monitor] Waiting ${settleDelayMs}ms for fonts & async layout shifts to settle...`);

  // Allow late-injected banners, async hydration, and web fonts to complete initial layout
  await page.waitForTimeout(settleDelayMs);

  const samples = await page.evaluate(async (): Promise<ILayoutShiftSample[]> => {
    // Wait for web fonts to finish loading so font-swap shifts are included
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Yield two animation frames so Chromium commits any pending layout shift entries
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    interface IBrowserLayoutShiftAttribution {
      node?: Node | null;
    }

    interface IBrowserLayoutShiftEntry extends PerformanceEntry {
      value: number;
      hadRecentInput: boolean;
      sources?: IBrowserLayoutShiftAttribution[];
    }

    const win = window as unknown as {
      __uirigClsRawEntries?: IBrowserLayoutShiftEntry[];
      __uirigClsObserver?: PerformanceObserver;
    };

    // Flush any synchronous records still sitting in the observer queue
    if (win.__uirigClsObserver) {
      const flushed = win.__uirigClsObserver.takeRecords() as IBrowserLayoutShiftEntry[];
      win.__uirigClsRawEntries?.push(...flushed);
    }

    // Fallback: if prepareClsObserver was not called prior to navigation, read the performance buffer
    const rawEntries: IBrowserLayoutShiftEntry[] =
      win.__uirigClsRawEntries && win.__uirigClsRawEntries.length > 0
        ? win.__uirigClsRawEntries
        : (performance.getEntriesByType('layout-shift') as IBrowserLayoutShiftEntry[]);

    function formatElementLabel(el: Element): string {
      const tagName = el.tagName.toLowerCase();
      if (el.id) {
        return `${tagName}#${el.id}`;
      }
      if (typeof el.className === 'string' && el.className.trim().length > 0) {
        const classList = el.className.trim().split(/\s+/).join('.');
        return `${tagName}.${classList}`;
      }
      return tagName;
    }

    // Build a Shadow-DOM-aware breadcrumb path (e.g. 'uirig-hero >> shadow-root >> div.content')
    function buildShadowAwareSelector(node: Node | null | undefined): string | null {
      if (!node) {
        return null;
      }

      const targetEl = node instanceof Element ? node : node.parentElement;
      if (!targetEl) {
        return null;
      }

      const segments: string[] = [formatElementLabel(targetEl)];
      let rootNode = targetEl.getRootNode();

      while (rootNode instanceof ShadowRoot) {
        const hostEl = rootNode.host;
        segments.unshift(`${formatElementLabel(hostEl)} >> shadow-root`);
        rootNode = hostEl.getRootNode();
      }

      return segments.join(' >> ');
    }

    return rawEntries.map((entry) => {
      const selectors: string[] = [];
      if (Array.isArray(entry.sources)) {
        for (const source of entry.sources) {
          const formatted = buildShadowAwareSelector(source.node);
          if (formatted && !selectors.includes(formatted)) {
            selectors.push(formatted);
          }
        }
      }

      return {
        value: entry.value,
        startTime: entry.startTime,
        hadRecentInput: entry.hadRecentInput,
        affectedSelectors: selectors,
      };
    });
  });

  console.log(`[cls:monitor] Collected ${samples.length} raw layout-shift entries from browser.`);
  const evaluation = evaluateClsSamples(samples, clsMaxLimit);
  console.log(
    `[cls:monitor] Evaluation complete. Max session CLS: ${evaluation.maxSessionCls} (budget: ${clsMaxLimit})`
  );

  return evaluation;
}
