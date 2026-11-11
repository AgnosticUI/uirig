/**
 * tests/unit/playground-fixtures.test.ts
 * 1-to-1 unit tests verifying the `playground/` HTML & TypeScript fixture structure,
 * AgnosticUI `--ag-*` token bindings, and deterministic CLS trap injection logic.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { scheduleClsTrapInjection } from '../../playground/src/cls-trap.js';

describe('::: PHASE 4 TASK 4.3: PLAYGROUND BASELINE & ADVERSARIAL FIXTURES :::', () => {
  it('==> Should bind AgnosticUI --ag-* tokens and mount baseline components + adversarial traps in playground/index.html', () => {
    console.log('\n::: RUNNING UNIT CHECKS: Validating playground/index.html Token & Fixture Markup :::');

    const htmlPath = resolve(process.cwd(), 'playground/index.html');
    const htmlSource = readFileSync(htmlPath, 'utf8');

    // Verify AgnosticUI CSS custom properties are used for baseline layout and theming
    expect(htmlSource).toContain('var(--ag-background-primary)');
    expect(htmlSource).toContain('var(--ag-text-primary)');
    expect(htmlSource).toContain('var(--ag-space-4)');
    expect(htmlSource).toContain('var(--ag-space-6)');
    expect(htmlSource).toContain('var(--ag-radius-md)');

    // Verify theme toggle control
    expect(htmlSource).toContain('id="theme-toggle"');

    // Verify compliant AgnosticUI Lit Web Components
    expect(htmlSource).toContain('<ag-card');
    expect(htmlSource).toContain('<ag-input');
    expect(htmlSource).toContain('<ag-button');

    // Verify all three deliberate adversarial trap anchors
    expect(htmlSource).toContain('id="contrast-token-trap"');
    expect(htmlSource).toContain('id="overflow-trap-box"');
    expect(htmlSource).toContain('id="cls-trap-slot"');

    console.log('[+] Verified: playground/index.html binds --ag-* tokens and mounts all fixtures.');
  });

  it('==> Should import ag-tokens.css and ag-tokens-dark.css in playground/src/main.ts', () => {
    console.log('\n::: RUNNING UNIT CHECKS: Validating Light & Dark Token Imports in main.ts :::');

    const mainPath = resolve(process.cwd(), 'playground/src/main.ts');
    const mainSource = readFileSync(mainPath, 'utf8');

    expect(mainSource).toContain('./components/ag/styles/ag-tokens.css');
    expect(mainSource).toContain('./components/ag/styles/ag-tokens-dark.css');

    console.log('[+] Verified: main.ts imports both light and dark AgnosticUI token stylesheets.');
  });

  it('==> Should inject #late-unsized-banner styled with --ag-* tokens after delay to induce a layout shift', () => {
    console.log('\n::: RUNNING UNIT CHECKS: Validating Delayed CLS Trap Injection :::');

    vi.useFakeTimers();

    try {
      const appendedChildren: Array<{ id: string; textContent: string; style: Record<string, string> }> = [];
      const mockSlot = {
        appendChild: (node: { id: string; textContent: string; style: Record<string, string> }) => {
          appendedChildren.push(node);
          return node;
        },
      };

      const mockDoc = {
        getElementById: (id: string) => (id === 'cls-trap-slot' ? mockSlot : null),
        createElement: (_tag: string) => ({
          id: '',
          textContent: '',
          style: {} as Record<string, string>,
        }),
      } as unknown as Document;

      // Schedule injection with 100ms delay
      scheduleClsTrapInjection(mockDoc, 100);

      // Before timer elapses, no banner should be injected yet (ensures post-paint shift)
      expect(appendedChildren.length).toBe(0);

      // Advance timers past 100ms
      vi.advanceTimersByTime(150);

      expect(appendedChildren.length).toBe(1);
      const injectedBanner = appendedChildren[0];
      expect(injectedBanner).toBeDefined();
      expect(injectedBanner?.id).toBe('late-unsized-banner');
      expect(injectedBanner?.style.height).toBe('140px');
      expect(injectedBanner?.style.padding).toBe('var(--ag-space-4)');
      expect(injectedBanner?.style.backgroundColor).toBe('var(--ag-warning-background)');
      expect(injectedBanner?.style.color).toBe('var(--ag-warning-text)');
      expect(injectedBanner?.style.borderRadius).toBe('var(--ag-radius-lg)');

      console.log('[+] Verified: #late-unsized-banner injects asynchronously with --ag-* tokens.');
    } finally {
      vi.useRealTimers();
    }
  });
});
