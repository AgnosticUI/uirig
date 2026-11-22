/**
 * tests/unit/a2ui-attribution.test.ts
 * Unit & live Chromium specs for Universal `<a2ui-surface>` Component Attribution (Issue #31).
 */

import { describe, it, expect, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import {
  resolveA2uiAttributionFromComposedChain,
  resolveA2uiAttributionsForSelectors,
  type IA2uiElementNodeLike,
} from '../../src/utils/a2ui-attribution.js';

describe('::: ISSUE #31 (CHUNK 1): UNIVERSAL <a2ui-surface> ATTRIBUTION :::', () => {
  let browser: Browser | null = null;

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('==> Should resolve composed ancestors across ShadowRoot boundaries and return null outside <a2ui-surface>', () => {
    const surfaceNode: IA2uiElementNodeLike = {
      tagName: 'A2UI-SURFACE',
      parentElement: null,
      getAttribute: (name: string) => {
        if (name === 'surface-id') return 'support-ticket';
        if (name === 'catalog-id') return 'agnosticui-v1';
        return null;
      },
    };

    const hostWrapper: IA2uiElementNodeLike = {
      tagName: 'AG-BUTTON',
      parentElement: surfaceNode,
      getAttribute: (name: string) => {
        if (name === 'data-a2ui-id') return 'close_drawer_btn';
        if (name === 'data-a2ui-component') return 'IconButton';
        if (name === 'data-a2ui-wire-path') return '/components/4';
        return null;
      },
    };

    const innerShadowButton: IA2uiElementNodeLike = {
      tagName: 'BUTTON',
      parentElement: null,
      getAttribute: () => null,
      getRootNode: () => ({ host: hostWrapper }),
    };

    expect(resolveA2uiAttributionFromComposedChain(innerShadowButton)).toEqual({
      surfaceId: 'support-ticket',
      a2uiComponentId: 'close_drawer_btn',
      a2uiComponentType: 'IconButton',
      catalogId: 'agnosticui-v1',
      wirePath: '/components/4',
      suggestedPatch: null,
    });

    // Elements outside `<a2ui-surface>` return null
    const standaloneDiv: IA2uiElementNodeLike = {
      tagName: 'DIV',
      parentElement: null,
      getAttribute: () => null,
    };
    expect(resolveA2uiAttributionFromComposedChain(standaloneDiv)).toBeNull();
  });

  it('==> Should resolve both attribute-driven (Lit) and property-driven (React) <a2ui-surface> trees in live Chromium', async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <!-- 1. Lit-style attribute-driven <a2ui-surface> with Shadow DOM -->
          <a2ui-surface id="lit-surface" catalog-id="agnosticui-lit-v1">
            <div data-a2ui-id="header_title" data-a2ui-component="Text">Support Ticket</div>
            <ag-icon-btn id="lit-close" data-a2ui-id="close_btn" data-a2ui-component="IconButton"></ag-icon-btn>
          </a2ui-surface>

          <!-- 2. React-style property-driven <a2ui-surface> -->
          <a2ui-surface id="react-surface">
            <div id="react-card-wrapper">
              <button id="react-submit-btn" type="button">Escalate</button>
            </div>
          </a2ui-surface>

          <!-- 3. Non-A2UI control outside <a2ui-surface> -->
          <button id="plain-btn" type="button">Outside</button>

          <script>
            class AgIconBtn extends HTMLElement {
              constructor() {
                super();
                const root = this.attachShadow({ mode: 'open' });
                root.innerHTML = '<button class="inner-close" type="button"></button>';
              }
            }
            customElements.define('ag-icon-btn', AgIconBtn);

            const reactSurface = document.getElementById('react-surface');
            reactSurface.catalogId = 'agnosticui-react-v1';
            const reactWrapper = document.getElementById('react-card-wrapper');
            reactWrapper.component = { id: 'escalate_action_btn', component: 'Button' };
          </script>
        </body>
      </html>
    `);

    const resolved = await resolveA2uiAttributionsForSelectors(page, [
      'ag-icon-btn#lit-close >> shadow-root >> button.inner-close',
      'button#react-submit-btn',
      'button#plain-btn',
    ]);
    await context.close();

    expect(resolved.get('ag-icon-btn#lit-close >> shadow-root >> button.inner-close')).toEqual({
      surfaceId: 'lit-surface',
      a2uiComponentId: 'close_btn',
      a2uiComponentType: 'IconButton',
      catalogId: 'agnosticui-lit-v1',
      wirePath: '/components/1',
      suggestedPatch: null,
    });

    expect(resolved.get('button#react-submit-btn')).toEqual({
      surfaceId: 'react-surface',
      a2uiComponentId: 'escalate_action_btn',
      a2uiComponentType: 'Button',
      catalogId: 'agnosticui-react-v1',
      wirePath: null,
      suggestedPatch: null,
    });

    expect(resolved.get('button#plain-btn')).toBeNull();
  });
});
