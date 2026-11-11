/**
 * playground/src/theme-toggle.ts
 * Light/Dark theme controller for the isolated AgnosticUI spot-checking sandbox.
 *
 * AgnosticUI Theming Contract:
 * - Light mode (default): `<html>` (`document.documentElement`) has NO `data-theme` attribute,
 *   activating base CSS custom properties from `ag-tokens.css`.
 * - Dark mode: `<html data-theme="dark">` is set, activating dark overrides from
 *   `ag-tokens-dark.css` (`[data-theme="dark"]`).
 */

export type ThemeMode = 'light' | 'dark';

/**
 * Reads the active theme mode from a root `<html>` element.
 *
 * @param rootEl - Target root element (defaults to `document.documentElement`).
 * @returns `'dark'` if `data-theme="dark"` is set; otherwise `'light'`.
 */
export function getActiveThemeMode(rootEl: HTMLElement): ThemeMode {
  return rootEl.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * Explicitly applies `'light'` or `'dark'` mode to the root `<html>` element
 * by either removing or setting `data-theme="dark"`.
 *
 * @param rootEl - Target root element (`document.documentElement`).
 * @param mode - Desired theme mode (`'light'` or `'dark'`).
 * @returns The applied `ThemeMode`.
 */
export function applyThemeMode(rootEl: HTMLElement, mode: ThemeMode): ThemeMode {
  if (mode === 'dark') {
    rootEl.setAttribute('data-theme', 'dark');
  } else {
    rootEl.removeAttribute('data-theme');
  }
  return mode;
}

/**
 * Flips between `'light'` and `'dark'` mode on the given root `<html>` element.
 *
 * @param rootEl - Target root element (`document.documentElement`).
 * @returns The newly active `ThemeMode` after toggling.
 */
export function toggleThemeMode(rootEl: HTMLElement): ThemeMode {
  const currentMode = getActiveThemeMode(rootEl);
  const nextMode: ThemeMode = currentMode === 'dark' ? 'light' : 'dark';
  return applyThemeMode(rootEl, nextMode);
}

/**
 * Synchronizes the `#theme-toggle` button's accessible `aria-pressed` state
 * and visible label text with the current theme mode.
 *
 * @param buttonEl - The `#theme-toggle` button element.
 * @param mode - Current active theme mode.
 */
function syncToggleButtonState(buttonEl: HTMLElement, mode: ThemeMode): void {
  const isDark = mode === 'dark';
  buttonEl.setAttribute('aria-pressed', String(isDark));
  buttonEl.textContent = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
}

/**
 * Attaches the click handler to `#theme-toggle` and synchronizes initial state
 * with `document.documentElement`.
 *
 * @param doc - Document instance (defaults to global `document` for testability).
 * @param buttonId - Element ID of the toggle button (defaults to `'theme-toggle'`).
 * @returns The wired `HTMLElement` button, or `null` if `#theme-toggle` is absent.
 */
export function wireThemeToggleButton(
  doc: Document = document,
  buttonId: string = 'theme-toggle'
): HTMLElement | null {
  const toggleBtn = doc.getElementById(buttonId);
  const rootHtml = doc.documentElement;

  if (!toggleBtn) {
    console.warn(`[playground:theme] Button #${buttonId} not found in DOM; skipping theme toggle wiring.`);
    return null;
  }

  // Sync initial button text and aria-pressed state with current <html> attribute
  const initialMode = getActiveThemeMode(rootHtml);
  syncToggleButtonState(toggleBtn, initialMode);

  toggleBtn.addEventListener('click', () => {
    const updatedMode = toggleThemeMode(rootHtml);
    syncToggleButtonState(toggleBtn, updatedMode);
    console.log(`[playground:theme] Switched theme mode to: ${updatedMode}`);
  });

  console.log(`[playground:theme] Wired #${buttonId} (initial mode: ${initialMode}).`);
  return toggleBtn;
}
