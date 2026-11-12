/**
 * src/interfaces/locator.ts
 * Shared diagnostic and violation type contracts for `dark-mode`, `dom`, and `runtime`
 * engines, plus component-attributed agent telemetry types.
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
 * Represents a single structural DOM, ARIA reference, broken media, passive security,
 * or AI prompt-injection trap violation (`uirig dom`).
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
    | 'prompt_injection_trap';
  selector: string;
  hostComponent?: string | null;
  detail: string;
  inShadowDom: boolean;
}

/**
 * Represents an uncaught runtime JavaScript exception (`pageerror`) or `console.error`
 * captured during viewport navigation.
 */
export interface IRuntimeErrorViolation {
  source: 'pageerror' | 'console_error';
  message: string;
  location?: string;
}
