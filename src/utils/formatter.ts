/**
 * src/utils/formatter.ts
 * Typographic console styler and diagnostic output formatter.
 * Provides zero-dependency ANSI color helpers that automatically honor
 * `NO_COLOR` and programmatic JSON stream mode (`UIRIG_JSON_MODE`).
 */

/**
 * Standard ANSI SGR (Select Graphic Rendition) escape sequences.
 */
export const ANSI_CODES = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
} as const;

export type AnsiStyle = keyof typeof ANSI_CODES;

/**
 * Determines whether ANSI escape codes should be suppressed.
 * Honors the cross-platform `NO_COLOR` standard (https://no-color.org)
 * as well as `UIRIG_JSON_MODE=1` when streaming raw JSON to AI agents.
 */
export function isColorDisabled(): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
    return true;
  }
  if (process.env.UIRIG_JSON_MODE === '1' || process.env.UIRIG_JSON_MODE === 'true') {
    return true;
  }
  return false;
}

/**
 * Wraps a string in one or more ANSI escape sequences, automatically appending
 * `\x1b[0m` reset codes. Returns the plain unstyled string if color is disabled.
 *
 * @param text - The text content to style.
 * @param styles - One or more style keys from `ANSI_CODES` (e.g., `'bold'`, `'cyan'`).
 * @returns The ANSI-styled string, or plain `text` when color output is disabled.
 */
export function paint(text: string, ...styles: AnsiStyle[]): string {
  if (styles.length === 0 || isColorDisabled()) {
    return text;
  }
  const prefix = styles.map((style) => ANSI_CODES[style]).join('');
  return `${prefix}${text}${ANSI_CODES.reset}`;
}

/**
 * Maps each core telemetry domain prefix to a distinct, high-contrast ANSI color
 * so every tool in the 4-tool MVP suite (`tokens`, `matrix`, `adversary`, `cls`)
 * is immediately distinguishable in terminal output.
 */
function resolveTagStyles(tag: string): AnsiStyle[] {
  if (tag.startsWith('tokens:')) {
    return ['bold', 'magenta'];
  }
  if (tag.startsWith('matrix:')) {
    return ['bold', 'cyan'];
  }
  if (tag.startsWith('adversary:')) {
    return ['bold', 'yellow'];
  }
  if (tag.startsWith('cls:')) {
    return ['bold', 'blue'];
  }
  if (tag.startsWith('spot-check') || tag.startsWith('check')) {
    return ['bold', 'green'];
  }
  return ['bold', 'white'];
}

/**
 * Formats a structured runtime telemetry line with a color-coded `[domain:stage]`
 * badge and clean message body for consistent console logging across all `uirig` tools.
 *
 * @param tag - Telemetry domain tag without brackets (e.g., `'tokens:audit'`, `'cls:monitor'`).
 * @param message - Descriptive log message body.
 * @returns Formatted single-line string ready for `console.log()`.
 */
export function formatTelemetryLog(tag: string, message: string): string {
  const tagStyles = resolveTagStyles(tag);
  const styledBadge = paint(`[${tag}]`, ...tagStyles);
  return `${styledBadge} ${message}`;
}
