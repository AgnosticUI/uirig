/**
 * tests/unit/theme-toggle.test.ts
 * 1-to-1 unit tests for `playground/src/theme-toggle.ts`.
 * Verifies `data-theme="dark"` attribute toggling, button wiring, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getActiveThemeMode,
  applyThemeMode,
  toggleThemeMode,
  wireThemeToggleButton,
} from '../../playground/src/theme-toggle.js';

/**
 * Lightweight deterministic mock of `HTMLElement` and `Document` so unit tests run
 * fast in Node without requiring a full browser or jsdom dependency.
 */
class MockElement {
  public textContent: string = '';
  private attributes = new Map<string, string>();
  private listeners = new Map<string, Array<() => void>>();

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  public removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  public addEventListener(event: string, handler: () => void): void {
    const existing = this.listeners.get(event) ?? [];
    existing.push(handler);
    this.listeners.set(event, existing);
  }

  public click(): void {
    const handlers = this.listeners.get('click') ?? [];
    for (const handler of handlers) {
      handler();
    }
  }
}

describe('::: PHASE 4 TASK 4.2: PLAYGROUND #THEME-TOGGLE CONTROLLER :::', () => {
  let mockHtml: MockElement;
  let mockButton: MockElement;
  let mockDocument: Document;

  beforeEach(() => {
    mockHtml = new MockElement();
    mockButton = new MockElement();
    mockDocument = {
      documentElement: mockHtml as unknown as HTMLElement,
      getElementById: (id: string) =>
        id === 'theme-toggle' ? (mockButton as unknown as HTMLElement) : null,
    } as unknown as Document;
  });

  it('==> Should default to light mode when data-theme is absent and toggle cleanly to dark and back', () => {
    console.log('\n::: RUNNING UNIT CHECKS: Theme Mode Attribute Toggling :::');

    const rootEl = mockHtml as unknown as HTMLElement;

    // 1. Default state: no `data-theme` attribute => light mode
    expect(getActiveThemeMode(rootEl)).toBe('light');
    expect(rootEl.getAttribute('data-theme')).toBeNull();

    // 2. Toggle once => sets `data-theme="dark"`
    const firstToggle = toggleThemeMode(rootEl);
    expect(firstToggle).toBe('dark');
    expect(rootEl.getAttribute('data-theme')).toBe('dark');
    expect(getActiveThemeMode(rootEl)).toBe('dark');

    // 3. Toggle again => removes `data-theme` attribute to restore AgnosticUI light tokens
    const secondToggle = toggleThemeMode(rootEl);
    expect(secondToggle).toBe('light');
    expect(rootEl.getAttribute('data-theme')).toBeNull();
    expect(getActiveThemeMode(rootEl)).toBe('light');

    console.log('[+] Verified: toggleThemeMode switches data-theme="dark" cleanly.');
  });

  it('==> Should wire #theme-toggle click events and synchronize button label and aria-pressed', () => {
    console.log('\n::: RUNNING UNIT CHECKS: #theme-toggle Button Click Integration :::');

    const wired = wireThemeToggleButton(mockDocument);
    expect(wired).not.toBeNull();

    // Initial state should reflect light mode
    expect(mockButton.getAttribute('aria-pressed')).toBe('false');
    expect(mockButton.textContent).toBe('Switch to Dark Mode');

    // First click switches <html> to dark mode
    mockButton.click();
    expect(mockHtml.getAttribute('data-theme')).toBe('dark');
    expect(mockButton.getAttribute('aria-pressed')).toBe('true');
    expect(mockButton.textContent).toBe('Switch to Light Mode');

    // Second click restores light mode
    mockButton.click();
    expect(mockHtml.getAttribute('data-theme')).toBeNull();
    expect(mockButton.getAttribute('aria-pressed')).toBe('false');
    expect(mockButton.textContent).toBe('Switch to Dark Mode');

    console.log('[+] Verified: #theme-toggle click handler updates DOM and ARIA state.');
  });

  it('==> Should handle missing #theme-toggle element gracefully and respect pre-set dark mode', () => {
    console.log('\n::: RUNNING UNIT CHECKS: Missing Button & Pre-set Dark Mode Edge Cases :::');

    // Edge Case 1: Pre-existing `data-theme="dark"` on <html> before wiring
    applyThemeMode(mockHtml as unknown as HTMLElement, 'dark');
    wireThemeToggleButton(mockDocument);
    expect(mockButton.getAttribute('aria-pressed')).toBe('true');
    expect(mockButton.textContent).toBe('Switch to Light Mode');

    // Edge Case 2: Button does not exist in DOM -> returns null without throwing
    const emptyDoc = {
      documentElement: mockHtml as unknown as HTMLElement,
      getElementById: () => null,
    } as unknown as Document;

    const missingResult = wireThemeToggleButton(emptyDoc);
    expect(missingResult).toBeNull();

    console.log('[+] Verified: Missing button and pre-set dark mode edge cases handled safely.');
  });
});
