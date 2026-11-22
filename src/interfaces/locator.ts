/**
 * src/interfaces/locator.ts
 * Shared diagnostic and violation type contracts for `dark-mode`, `dom`, `runtime`,
 * and out-of-band A2UI (Agent-to-UI) `<a2ui-surface>` component attribution.
 */

export type UirigEngineName =
  | 'tokens'
  | 'contrast'
  | 'dark-mode'
  | 'stress'
  | 'cls'
  | 'dom'
  | 'runtime';

/**
 * Out-of-band A2UI v1.0 component attribution attached to `IAgenticViolation.a2ui`
 * when a violation occurs inside an `<a2ui-surface>` boundary (`null` otherwise).
 */
export interface IA2uiAttribution {
  /** Surface identifier from `<a2ui-surface surface-id="...">`, `id`, or `el.surfaceId`. */
  surfaceId: string | null;
  /** Component identifier from `data-a2ui-id` or `el.component?.id`. */
  a2uiComponentId: string | null;
  /** Component catalog type from `data-a2ui-component` or `el.component?.component`. */
  a2uiComponentType: string | null;
  /** Catalog identifier from `<a2ui-surface catalog-id="...">` or `el.catalogId`. */
  catalogId: string | null;
  /** RFC 6901 JSON Pointer into the surface's `components` array (e.g. `/components/2`). */
  wirePath: string | null;
  /** Optional deterministic RFC 6902 patch hint scoped to `wirePath`. */
  suggestedPatch: Array<{
    op: 'add' | 'replace' | 'remove';
    path: string;
    value?: unknown;
  }> | null;
}

/**
 * Represents a single dark-mode theme parity violation (`uirig dark-mode`),
 * either a contrast failure under emulated dark mode or a large surface stranded
 * at bright light luminance (`> darkModeMaxSurfaceLuminance`).
 */
export interface IDarkModeViolation {
  violationType: 'dark_mode_contrast_drop' | 'stranded_light_surface';
  selector: string;
  hostComponent?: string | null;
  foregroundRgb?: string;
  backgroundRgb: string;
  contrastRatio?: number;
  relativeLuminance?: number;
  suggestedToken?: string;
  inShadowDom: boolean;
}

/**
 * Represents a single structural DOM (Document Object Model), ARIA (Accessible Rich Internet Applications)
 * reference, broken media, passive security, Web Component `<slot>` content-model mismatch,
 * hidden AI prompt-injection trap, or computed accessibility tree violation (`uirig dom`).
 */
export interface IDomIntegrityViolation {
  rule:
    | 'unlabeled_control'
    | 'dangling_aria_ref'
    | 'broken_image'
    | 'unmuted_autoplay'
    | 'unsafe_uri'
    | 'unsafe_target_blank'
    | 'missing_frame_header'
    | 'prompt_injection_trap'
    | 'orphaned_slot_content'
    | 'ax_empty_name'
    | 'ax_hidden_focus';
  selector: string;
  hostComponent?: string | null;
  detail: string;
  inShadowDom: boolean;
}

/**
 * Represents an uncaught runtime JS (JavaScript) exception (`pageerror`) or `console.error`
 * captured during viewport navigation.
 */
export interface IRuntimeErrorViolation {
  source: 'pageerror' | 'console_error';
  message: string;
  location?: string;
}
