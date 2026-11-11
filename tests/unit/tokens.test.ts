/**
 * tests/unit/tokens.test.ts
 * Unit tests observing how validateComputedStyleEntry catches unauthorized colors,
 * magic pixel spacing, and Shadow DOM drift while passing compliant elements.
 */
import { describe, it, expect } from 'vitest';
import {
  validateComputedStyleEntry,
  type ITokenScaleConfig,
  type IExtractedElementStyles,
} from '../../src/core/tokens.js';

describe('::: PHASE 3 TASK 3.1 (CHUNK 2): TOKEN VALIDATION LOGIC GATES :::', () => {
  // Define a strict baseline design system scale for testing
  const approvedScale: ITokenScaleConfig = {
    colors: ['rgb(15, 23, 42)', 'rgb(255, 255, 255)', 'rgb(59, 130, 246)'],
    spacing: ['0px', '8px', '16px', '24px'],
    fontSizes: ['14px', '16px', '24px'],
    radii: ['0px', '4px', '8px'],
  };

  it('==> Should pass an element whose computed styles strictly match the approved token scale', () => {
    console.log('\n--- START TEST: Compliant Element Token Audit ---');

    // Simulate a button styled exclusively with approved design tokens and a transparent wrapper default
    const compliantElement: IExtractedElementStyles = {
      selector: 'button.primary-btn',
      inShadowDom: false,
      styles: {
        color: 'rgb(255, 255, 255)',
        backgroundColor: 'rgb(59, 130, 246)',
        paddingTop: '8px',
        paddingBottom: '8px',
        paddingLeft: '16px',
        paddingRight: '16px',
        fontSize: '14px',
        borderRadius: '4px',
      },
    };

    console.log(`[+] Auditing selector: ${compliantElement.selector}`);
    const violations = validateComputedStyleEntry(compliantElement, approvedScale);
    console.log(`[+] Violations detected: ${violations.length}`);

    expect(violations).toHaveLength(0);
  });

  it('==> Should ignore transparent background defaults without throwing false positives', () => {
    console.log('\n--- START TEST: Transparent Background Noise Filter ---');

    const transparentWrapper: IExtractedElementStyles = {
      selector: 'div.layout-container',
      inShadowDom: false,
      styles: {
        color: 'rgb(15, 23, 42)',
        backgroundColor: 'rgba(0, 0, 0, 0)',
        paddingTop: '0px',
        paddingBottom: '0px',
        paddingLeft: '0px',
        paddingRight: '0px',
        fontSize: '16px',
        borderRadius: '0px',
      },
    };

    const violations = validateComputedStyleEntry(transparentWrapper, approvedScale);
    console.log(`[+] Violations on transparent wrapper: ${violations.length}`);

    expect(violations).toHaveLength(0);
  });

  it('==> Should catch hardcoded hex/rgb colors, magic pixel padding, and Shadow DOM violations', () => {
    console.log('\n--- START TEST: Rogue Magic Number & Shadow DOM Detection ---');

    // Simulate a Web Component element inside a ShadowRoot using rogue values (13px padding, rogue pink color)
    const rogueShadowElement: IExtractedElementStyles = {
      selector: 'my-card >> shadow-root >> span.badge',
      inShadowDom: true,
      styles: {
        color: 'rgb(255, 0, 128)',       // Rogue hardcoded color
        backgroundColor: 'rgba(0, 0, 0, 0)',
        paddingTop: '13px',              // Rogue magic pixel spacing
        paddingBottom: '8px',
        paddingLeft: '16px',
        paddingRight: '16px',
        fontSize: '15px',                // Rogue off-scale font size
        borderRadius: '4px',
      },
    };

    console.log(`[+] Auditing Shadow DOM element: ${rogueShadowElement.selector}`);
    const violations = validateComputedStyleEntry(rogueShadowElement, approvedScale);
    console.log('[!] Violations caught:', JSON.stringify(violations, null, 2));

    expect(violations).toHaveLength(3);
    expect(violations[0]).toEqual({
      selector: 'my-card >> shadow-root >> span.badge',
      property: 'color',
      actualValue: 'rgb(255, 0, 128)',
      inShadowDom: true,
    });
    expect(violations[1]?.property).toBe('paddingTop');
    expect(violations[1]?.actualValue).toBe('13px');
    expect(violations[2]?.property).toBe('fontSize');
    expect(violations[2]?.actualValue).toBe('15px');
  });
});
