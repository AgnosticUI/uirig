/**
 * playground/src/cls-trap.ts
 * Deterministic Cumulative Layout Shift (CLS) trap injector for the isolated
 * AgnosticUI spot-checking sandbox.
 *
 * Kept separate from `playground/src/main.ts` so Node/Vitest unit tests can
 * import and test this helper directly without pulling in browser-only Lit
 * custom element registrations or CSS side-effect imports.
 */

/**
 * Injects an un-sized late-loading banner into `#cls-trap-slot` after initial paint
 * to deliberately trigger a measurable Cumulative Layout Shift (CLS) event.
 *
 * Uses AgnosticUI semantic warning and spacing tokens (`--ag-warning-background`,
 * `--ag-warning-text`, `--ag-space-4`, `--ag-radius-lg`) so the injected element
 * remains theme-reactive and token-compliant while still inducing a vertical shift.
 *
 * @param doc - Target Document instance (defaults to global `document`).
 * @param delayMs - Delay after initial animation frame before injecting the banner (default 120ms).
 */
export function scheduleClsTrapInjection(
  doc: Document = document,
  delayMs: number = 120
): void {
  const slot = doc.getElementById('cls-trap-slot');
  if (!slot) {
    console.warn('[playground:cls-trap] #cls-trap-slot not found; skipping CLS trap injection.');
    return;
  }

  // Wait for first paint frame, then inject an un-sized block above <main> to shift content downward
  const triggerInjection = () => {
    setTimeout(() => {
      const banner = doc.createElement('div');
      banner.id = 'late-unsized-banner';
      banner.style.height = '140px';
      banner.style.padding = 'var(--ag-space-4)';
      banner.style.marginBottom = 'var(--ag-space-4)';
      banner.style.backgroundColor = 'var(--ag-warning-background)';
      banner.style.color = 'var(--ag-warning-text)';
      banner.style.borderRadius = 'var(--ag-radius-lg)';
      banner.textContent =
        'Trap C: Late-injected un-sized promo banner causing vertical Cumulative Layout Shift.';
      slot.appendChild(banner);
      console.log('[playground:cls-trap] Injected #late-unsized-banner to trigger layout shift.');
    }, delayMs);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => triggerInjection());
  } else {
    triggerInjection();
  }
}
