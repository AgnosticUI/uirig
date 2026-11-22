/**
 * tests/unit/ax-tree.test.ts
 * Unit & live Chromium CDP (Chrome DevTools Protocol) specs for Computed Accessibility
 * Tree Snapshot rules (`ax_empty_name` and `ax_hidden_focus`).
 */

import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  evaluateAxNodeForEmptyName,
  evaluateAxNodeForHiddenFocus,
  INTERACTIVE_AX_ROLES,
  isAxNodeFocusable,
  isAxNodeHiddenByAriaOrInert,
  type ICdpAxNode,
} from '../../src/core/ax-tree.js';
import { runDomIntegrityAudit } from '../../src/core/dom.js';

describe('::: ISSUE #19 (CHUNKS 1–2): COMPUTED ACCESSIBILITY TREE SNAPSHOT :::', () => {
  let browser: Browser | null = null;

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('==> Should flag non-ignored interactive AX roles with empty or whitespace-only computed names', () => {
    for (const role of INTERACTIVE_AX_ROLES) {
      const emptyNode: ICdpAxNode = {
        nodeId: 'ax-1',
        ignored: false,
        role: { type: 'internalRole', value: role },
        name: { type: 'computedString', value: '   ' },
        backendDOMNodeId: 42,
      };
      const detail = evaluateAxNodeForEmptyName(emptyNode);
      expect(detail).not.toBeNull();
      expect(detail).toContain(role);
    }

    const labeledButton: ICdpAxNode = {
      nodeId: 'ax-2',
      ignored: false,
      role: { type: 'internalRole', value: 'button' },
      name: { type: 'computedString', value: 'Submit Ticket' },
      backendDOMNodeId: 43,
    };
    expect(evaluateAxNodeForEmptyName(labeledButton)).toBeNull();

    const ignoredButton: ICdpAxNode = {
      nodeId: 'ax-3',
      ignored: true,
      role: { type: 'internalRole', value: 'button' },
      name: { type: 'computedString', value: '' },
      backendDOMNodeId: 44,
    };
    expect(evaluateAxNodeForEmptyName(ignoredButton)).toBeNull();

    const genericDiv: ICdpAxNode = {
      nodeId: 'ax-4',
      ignored: false,
      role: { type: 'internalRole', value: 'generic' },
      name: { type: 'computedString', value: '' },
      backendDOMNodeId: 45,
    };
    expect(evaluateAxNodeForEmptyName(genericDiv)).toBeNull();
  });

  it('==> Should flag focusable controls trapped inside aria-hidden="true" or inert ancestors', () => {
    const trappedButton: ICdpAxNode = {
      nodeId: 'ax-10',
      ignored: true,
      ignoredReasons: [{ name: 'ariaHiddenSubtree', value: { type: 'boolean', value: true } }],
      role: { type: 'internalRole', value: 'button' },
      name: { type: 'computedString', value: 'Hidden Action' },
      properties: [{ name: 'focusable', value: { type: 'booleanOrUndefined', value: true } }],
      backendDOMNodeId: 99,
    };

    expect(isAxNodeFocusable(trappedButton)).toBe(true);
    expect(isAxNodeHiddenByAriaOrInert(trappedButton)).toBe(true);

    const detail = evaluateAxNodeForHiddenFocus(trappedButton, true);
    expect(detail).not.toBeNull();
    expect(detail).toContain('aria-hidden="true" or inert');

    expect(evaluateAxNodeForHiddenFocus(trappedButton, false)).toBeNull();

    const hiddenText: ICdpAxNode = {
      nodeId: 'ax-11',
      ignored: true,
      role: { type: 'internalRole', value: 'StaticText' },
      name: { type: 'computedString', value: 'Decorative icon' },
      backendDOMNodeId: 100,
    };
    expect(evaluateAxNodeForHiddenFocus(hiddenText, true)).toBeNull();
  });

  it('==> Should catch ax_empty_name in Shadow DOM custom elements and ax_hidden_focus traps in live Chromium', async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <!-- 1. Custom ARIA button with empty computed accessible name -->
          <div id="custom-role-btn" role="button" tabindex="0"></div>

          <!-- 2. Shadow DOM Web Component with severed accessible name -->
          <ag-icon-button id="severed-shadow-btn"></ag-icon-button>

          <!-- 3. Focusable button trapped inside aria-hidden="true" -->
          <div id="hidden-drawer" aria-hidden="true">
            <button id="trapped-close-btn" type="button">Close Drawer</button>
          </div>

          <!-- 4. Accessible custom button (must pass cleanly) -->
          <div id="valid-role-btn" role="button" tabindex="0" aria-label="Save Draft"></div>

          <script>
            class AgIconButton extends HTMLElement {
              constructor() {
                super();
                const root = this.attachShadow({ mode: 'open' });
                root.innerHTML = '<span class="inner-btn" role="button" tabindex="0"><svg width="16" height="16"></svg></span>';
              }
            }
            customElements.define('ag-icon-button', AgIconButton);
          </script>
        </body>
      </html>
    `);

    const violations = await runDomIntegrityAudit(page);
    await context.close();

    const emptyNameViolations = violations.filter((v) => v.rule === 'ax_empty_name');
    const hiddenFocusViolations = violations.filter((v) => v.rule === 'ax_hidden_focus');

    expect(emptyNameViolations.some((v) => v.selector.includes('div#custom-role-btn'))).toBe(true);
    expect(
      emptyNameViolations.some(
        (v) => v.inShadowDom === true && v.hostComponent === 'ag-icon-button'
      )
    ).toBe(true);
    expect(emptyNameViolations.some((v) => v.selector.includes('div#valid-role-btn'))).toBe(false);

    expect(hiddenFocusViolations).toHaveLength(1);
    expect(hiddenFocusViolations.at(0)?.selector).toContain('button#trapped-close-btn');
  });
});
