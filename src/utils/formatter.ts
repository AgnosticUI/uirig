/**
 * src/utils/formatter.ts
 * Typographic console styler and diagnostic telemetry stream router.
 * Provides:
 * 1. Zero-dependency ANSI color helpers that honor the `NO_COLOR` standard.
 * 2. Unix-compliant telemetry routing (`logTelemetry`) that writes to `stdout`
 *    during normal CLI runs and routes colored diagnostics to `stderr` when
 *    `UIRIG_JSON_MODE` is active, keeping `stdout` 100% pure for JSON consumers.
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
 * Returns true when `UIRIG_JSON_MODE` is enabled (`'1'` or `'true'`), indicating
 * that `stdout` is reserved exclusively for machine-readable JSON payloads.
 */
export function isJsonStreamMode(): boolean {
  return process.env.UIRIG_JSON_MODE === '1' || process.env.UIRIG_JSON_MODE === 'true';
}

/**
 * Determines whether ANSI escape codes should be suppressed.
 * Honors the cross-platform `NO_COLOR` standard (https://no-color.org).
 * Does NOT disable color during `UIRIG_JSON_MODE`, because telemetry routes
 * to `stderr` while `stdout` receives unstyled JSON payloads.
 */
export function isColorDisabled(): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
    return true;
  }
  return false;
}

/**
 * Wraps a string in one or more ANSI escape sequences, automatically appending
 * `\x1b[0m` reset codes. Returns the plain unstyled string if color is disabled.
 */
export function paint(text: string, ...styles: AnsiStyle[]): string {
  if (styles.length === 0 || isColorDisabled()) {
    return text;
  }
  const prefix = styles.map((style) => ANSI_CODES[style]).join('');
  return `${prefix}${text}${ANSI_CODES.reset}`;
}

/**
 * Maps each core telemetry domain prefix to a distinct, high-contrast ANSI color.
 */
function resolveTagStyles(tag: string): AnsiStyle[] {
  if (tag.startsWith('tokens:')) {
    return ['bold', 'magenta'];
  }
  if (tag.startsWith('matrix:') || tag.startsWith('dark-mode:')) {
    return ['bold', 'cyan'];
  }
  if (tag.startsWith('adversary:')) {
    return ['bold', 'yellow'];
  }
  if (tag.startsWith('cls:')) {
    return ['bold', 'blue'];
  }
  if (tag.startsWith('dom:')) {
    return ['bold', 'red'];
  }
  if (tag.startsWith('check')) {
    return ['bold', 'green'];
  }
  return ['bold', 'white'];
}

/**
 * Formats a structured runtime telemetry line with a color-coded `[domain:stage]`
 * badge and clean message body.
 */
export function formatTelemetryLog(tag: string, message: string): string {
  const tagStyles = resolveTagStyles(tag);
  const styledBadge = paint(`[${tag}]`, ...tagStyles);
  return `${styledBadge} ${message}`;
}

/**
 * Emits a structured runtime telemetry line to the appropriate Unix stream:
 * - Normal mode: writes to `stdout` via `console.log()`.
 * - JSON stream mode (`UIRIG_JSON_MODE=1`): routes to `stderr` via `console.error()`,
 *   keeping `stdout` 100% pure for `JSON.parse()` consumers without stripping `stderr` colors.
 */
export function logTelemetry(tag: string, message: string): void {
  const formattedLine = formatTelemetryLog(tag, message);
  if (isJsonStreamMode()) {
    console.error(formattedLine);
  } else {
    console.log(formattedLine);
  }
}
