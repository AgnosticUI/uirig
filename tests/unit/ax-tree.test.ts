/**
 * tests/unit/ax-tree.test.ts
 * Unit specs for Chromium CDP Accessibility Tree evaluators (`ax_empty_name` and `ax_hidden_focus`).
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateAxNodeForEmptyName,
  evaluateAxNodeForHiddenFocus,
  INTERACTIVE_AX_ROLES,
  isAxNodeFocusable,
  isAxNodeHiddenByAriaOrInert,
  type ICdpAxNode,
} from '../../src/core/ax-tree.js';

describe('::: ISSUE #19 (CHUNK 1): PURE AX-TREE RULE EVALUATORS :::', () => {
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

    // Properly named interactive node passes
    const labeledButton: ICdpAxNode = {
      nodeId: 'ax-2',
      ignored: false,
      role: { type: 'internalRole', value: 'button' },
      name: { type: 'computedString', value: 'Submit Ticket' },
      backendDOMNodeId: 43,
    };
    expect(evaluateAxNodeForEmptyName(labeledButton)).toBeNull();

    // Ignored AX node or non-interactive role (e.g. generic / group) is skipped
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

    // Focusable button outside hidden/inert ancestor passes
    expect(evaluateAxNodeForHiddenFocus(trappedButton, false)).toBeNull();

    // Non-focusable static text inside aria-hidden="true" passes
    const hiddenText: ICdpAxNode = {
      nodeId: 'ax-11',
      ignored: true,
      role: { type: 'internalRole', value: 'StaticText' },
      name: { type: 'computedString', value: 'Decorative icon' },
      backendDOMNodeId: 100,
    };
    expect(evaluateAxNodeForHiddenFocus(hiddenText, true)).toBeNull();
  });
});
