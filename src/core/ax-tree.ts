/**
 * src/core/ax-tree.ts
 * Computed Accessibility Tree Snapshot Engine (Issue #19).
 * Evaluates Chromium CDP `Accessibility.getFullAXTree` nodes for:
 * - `ax_empty_name`: interactive AX roles whose computed accessible name is empty/whitespace.
 * - `ax_hidden_focus`: keyboard-focusable controls nested inside `aria-hidden="true"` or `inert` ancestors.
 */

export interface ICdpAxValue {
  type?: string;
  value?: unknown;
}

export interface ICdpAxProperty {
  name: string;
  value: ICdpAxValue;
}

export interface ICdpAxNode {
  nodeId: string;
  ignored?: boolean;
  ignoredReasons?: Array<ICdpAxProperty>;
  role?: ICdpAxValue;
  name?: ICdpAxValue;
  properties?: Array<ICdpAxProperty>;
  childIds?: Array<string>;
  parentId?: string;
  backendDOMNodeId?: number;
}

/**
 * Interactive WAI-ARIA / Chromium AX roles that MUST expose a non-empty computed accessible name.
 */
export const INTERACTIVE_AX_ROLES = new Set<string>([
  'button',
  'link',
  'textbox',
  'combobox',
  'checkbox',
  'radio',
  'tab',
  'menuitem',
]);

/**
 * Reads a boolean property (such as `focusable` or `hidden`) from a CDP `AXNode.properties` list.
 */
export function getAxBooleanProperty(node: ICdpAxNode, propertyName: string): boolean {
  if (!Array.isArray(node.properties)) {
    return false;
  }
  for (const prop of node.properties) {
    if (prop.name === propertyName && prop.value?.value === true) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a CDP `AXNode` is keyboard-focusable (`focusable: true` or `focused: true`).
 */
export function isAxNodeFocusable(node: ICdpAxNode): boolean {
  return getAxBooleanProperty(node, 'focusable') || getAxBooleanProperty(node, 'focused');
}

/**
 * Checks whether a CDP `AXNode` was ignored due to an `aria-hidden` or `inert` ancestor/attribute.
 */
export function isAxNodeHiddenByAriaOrInert(node: ICdpAxNode): boolean {
  if (getAxBooleanProperty(node, 'hidden')) {
    return true;
  }
  if (Array.isArray(node.ignoredReasons)) {
    for (const reason of node.ignoredReasons) {
      if (reason.name === 'ariaHiddenElement' || reason.name === 'ariaHiddenSubtree' || reason.name === 'inertElement' || reason.name === 'inertSubtree') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Evaluates a single non-ignored CDP `AXNode` for `ax_empty_name`.
 * Returns a human-readable detail message if the node has an interactive role with an empty
 * or whitespace-only computed accessible name, or `null` when valid.
 */
export function evaluateAxNodeForEmptyName(node: ICdpAxNode): string | null {
  if (node.ignored === true || typeof node.backendDOMNodeId !== 'number') {
    return null;
  }

  const rawRole = typeof node.role?.value === 'string' ? node.role.value.trim().toLowerCase() : '';
  if (!INTERACTIVE_AX_ROLES.has(rawRole)) {
    return null;
  }

  const rawName = typeof node.name?.value === 'string' ? node.name.value.trim() : '';
  if (rawName.length === 0) {
    return (
      "Interactive element with computed AX role '" +
      rawRole +
      "' has an empty accessible name in Chromium's accessibility tree."
    );
  }

  return null;
}

/**
 * Evaluates a single CDP `AXNode` for `ax_hidden_focus`.
 * Returns a human-readable detail message when a keyboard-focusable node (`tabIndex >= 0`)
 * is trapped inside an `aria-hidden="true"` or `inert` ancestor, or `null` when valid.
 */
export function evaluateAxNodeForHiddenFocus(
  node: ICdpAxNode,
  hasHiddenOrInertAncestor: boolean
): string | null {
  if (typeof node.backendDOMNodeId !== 'number') {
    return null;
  }

  if (!hasHiddenOrInertAncestor) {
    return null;
  }

  if (!isAxNodeFocusable(node)) {
    return null;
  }

  const rawRole = typeof node.role?.value === 'string' ? node.role.value.trim().toLowerCase() : 'control';
  return (
    "Keyboard-focusable element (AX role '" +
    rawRole +
    "') is nested inside an aria-hidden=\"true\" or inert container, creating a hidden focus trap."
  );
}
