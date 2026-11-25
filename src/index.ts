/**
 * src/index.ts
 * Main system entry point and zero-dependency CLI argument parser/router for `uirig`.
 * Supports:
 * - `uirig <url-or-file> [--only=<tool>] [--tokens-path=<path>] [--auto-tokens] [--selectors=<csv>] [--changed] [--base=<ref>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]`
 * - `uirig init`
 * - `uirig check [<url-or-file>] [--only=<tool>] [--tokens-path=<path>] [--auto-tokens] [--selectors=<csv>] [--changed] [--base=<ref>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]`
 * - `uirig tokens | contrast | dark-mode | stress | cls | dom [<url-or-file>] [--tokens-path=<path>] [--auto-tokens] [--selectors=<csv>] [--changed] [--base=<ref>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]`
 * - `uirig manifest`
 * - `uirig mcp [--transport=<mode>] [--port=<n>] [--idle-timeout=<ms>]`
 * - `uirig --help` / `uirig <command> --help` / `uirig --version`
 */
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { executeInitCommand } from './commands/init.js';
import {
  executeCheckCommand,
  type AuditToolName,
  type PosixExitCode,
} from './commands/check.js';
import { executeManifestCommand } from './commands/manifest.js';
import { logTelemetry, paint } from './utils/formatter.js';
import { parseSelectorList } from './utils/scope.js';
import { readFileSync } from 'fs';
import { executeMcpCommand } from './commands/mcp.js';
import { validateHttpTargetUrl } from './utils/static-server.js';
import { DEFAULT_SWEEP_SPEC, parseSweepRange } from './core/sweep.js';
export { validateHttpTargetUrl };

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string };
export const UIRIG_VERSION = pkg.version;

const AUDIT_TOOL_NAMES = new Set<AuditToolName>([
  'tokens',
  'contrast',
  'dark-mode',
  'stress',
  'cls',
  'dom',
  'sweep',
]);

interface ISubcommandHelpSpec {
  summary: string;
  usage: string;
  mechanics: Array<string>;
  options: Array<string>;
  exitCodes: Array<string>;
  examples: Array<string>;
}

const SHARED_AUDIT_OPTIONS = [
  '--tokens-path=<path>   Path to W3C, Style Dictionary, flat JSON, or CSS custom properties token file',
  '--auto-tokens          Auto-discover design tokens from workspace files & live :root CSS vars',
  '--themes=<csv>         Evaluate target across multiple theme skins (e.g. --themes="light,dark,brand")',
  '--sweep[=<range>]      Step viewport across <min>:<max>:<step> widths (default: 320:1440:40)',
  '--changed              Scope audit to components modified in git diff (optional: --base <ref>)',
  '--base=<ref>           Git base ref for --changed diff comparison (e.g. --base=main)',
  '--scope=<csv>          Restrict audit to matching CSS selector containers (alias: -s, --selectors; repeatable)',
  '--exclude=<csv>        Carve out matching CSS selector subtrees from audit (repeatable)',
  '--config=<path>        Path to uirig.config.json (also supports: --config <path>)',
  '--fix                  Apply deterministic 1-to-1 fixes on disk and re-verify',
  '--group-by-root        Collapse child failures under their shared parent container or host',
  '--top=<n>              Keep only the top N highest-priority violations (e.g. --top=5)',
  '--max-tokens=<budget>  Cap JSON output to approximately N LLM tokens (e.g. --max-tokens=1200)',
  '--spatial-brief        Emit compact bounding-box summary of landmarks & target selectors',
  '--verbose              Print individual failing selectors and details beneath each engine',
  '--json                 Route diagnostic logs to stderr and emit deduplicated JSON to stdout',
  '--headed               Launch Chromium with a visible browser window for local inspection',
  '-h, --help             Show this command help page',
];

const SUBCOMMAND_HELP_SPECS: Record<string, ISubcommandHelpSpec> = {
  init: {
    summary: 'Scaffold uirig.config.json, .uirig/session.json, and .uirig/SKILL.md in the current workspace.',
    usage: 'uirig init [--help]',
    mechanics: [
      'Detects existing config files and writes sensible defaults without overwriting custom tokens.',
      'Generates .uirig/SKILL.md so AI coding agents can self-verify UI edits with `uirig check --json`.',
    ],
    options: ['-h, --help          Show help for the init subcommand'],
    exitCodes: [
      '0                   Workspace files initialized successfully',
      '1                   Filesystem write error or invalid working directory',
    ],
    examples: ['npx @rlevin/uirig init'],
  },
  check: {
    summary: 'Run all verification engines concurrently across configured or direct targets in isolated contexts.',
    usage: 'uirig check [<url-or-file>] [--only=<tool>] [--sweep[=<min:max:step>]] [--tokens-path=<path>] [--auto-tokens] [--scope=<csv>] [--exclude=<csv>] [--changed] [--base=<ref>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]',
    mechanics: [
      'Launches a single headless Chromium instance and isolates each (url, viewport) pair in a fresh BrowserContext.',
      'Automatically serves local .html files on an ephemeral 127.0.0.1 HTTP server when given a file path.',
      'Supports --scope (or --selectors / -s) to bound audits to target containers and --exclude to carve out subtrees.',
    ],
    options: [
      '--only=<tool>          Filter execution to one engine: tokens | contrast | dark-mode | stress | cls | dom | sweep',
      ...SHARED_AUDIT_OPTIONS,
    ],
    exitCodes: [
      '0                   All token, contrast, dark-mode, stress, sweep, CLS, DOM, and runtime checks passed',
      '1                   Token drift, contrast/dark-mode failure, DOM violation, uncaught JS error, or config error',
      '2                   Structural layout overflow/collision, breakpoint sweep failure, or CLS budget breach',
    ],
    examples: [
      'npx @rlevin/uirig check',
      'npx @rlevin/uirig check http://localhost:5173 --scope="#uirig-stage" --exclude="h3.demo-title" --verbose',
      'npx @rlevin/uirig check http://localhost:5173 --sweep=320:1440:40 --json',
      'npx @rlevin/uirig check http://localhost:5173 --tokens-path=./design.tokens.json --verbose',
      'npx @rlevin/uirig check --changed --base=main --json',
    ],
  },
  sweep: {
    summary: 'Step an active Chromium viewport across [min, max, step] widths and report failing width ranges.',
    usage: 'uirig sweep [<url-or-file>] [--sweep=<min:max:step>] [--scope=<csv>] [--exclude=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]',
    mechanics: [
      'Resizes a single open Chromium page across the configured width range (default 320:1440:40) without extra browser launches.',
      'Evaluates horizontal overflow (relative to --scope containers when scoped) and sibling touch-target collisions at each width.',
    ],
    options: SHARED_AUDIT_OPTIONS,
    exitCodes: [
      '0                   No responsive overflow or touch-target collisions across swept widths',
      '2                   Structural overflow or touch-target collision detected across one or more width ranges',
    ],
    examples: [
      'npx @rlevin/uirig sweep http://localhost:5173 --verbose',
      'npx @rlevin/uirig check ./dist/index.html --sweep=320:1440:40 --json',
    ],
  },
  tokens: {
    summary: 'Audit Light DOM and open ShadowRoot computed styles against your design token scale.',
    usage: 'uirig tokens [<url-or-file>] [--tokens-path=<path>] [--auto-tokens] [--scope=<csv>] [--exclude=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]',
    mechanics: [
      'Climbs Light DOM and nested Web Component ShadowRoot trees to inspect rendered colors, spacing, font sizes, and radii.',
      'Accepts W3C ($value), Style Dictionary (value), flat JSON, or CSS custom property token files via tokensPath / --tokens-path.',
    ],
    options: SHARED_AUDIT_OPTIONS,
    exitCodes: [
      '0                   All computed styles align with configured design tokens',
      '1                   Hardcoded off-scale values detected or config error',
    ],
    examples: [
      'npx @rlevin/uirig tokens http://localhost:5173 --tokens-path=./tokens.css --verbose',
      'npx @rlevin/uirig tokens http://localhost:5173 --scope="ag-button" --verbose',
      'npx @rlevin/uirig tokens --config=./uirig.config.json --json',
    ],
  },
  contrast: {
    summary: 'Verify WCAG 2.1 AA rendered luminance contrast (>= 4.5:1) using Porter-Duff alpha compositing.',
    usage: 'uirig contrast [<url-or-file>] [--tokens-path=<path>] [--auto-tokens] [--scope=<csv>] [--exclude=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]',
    mechanics: [
      'Walks Light DOM and ShadowRoot.host ancestors to composite translucent backgrounds before computing luminance contrast.',
      'Computes the nearest passing design system color token (suggestedToken) when tokensPath / --tokens-path or --auto-tokens is set.',
    ],
    options: SHARED_AUDIT_OPTIONS,
    exitCodes: [
      '0                   All visible text nodes meet WCAG 2.1 AA contrast thresholds',
      '1                   One or more text nodes fell below required contrast ratios',
    ],
    examples: [
      'npx @rlevin/uirig contrast ./dist/index.html --scope="#pricing" --verbose',
      'npx @rlevin/uirig contrast http://localhost:5173 --json',
    ],
  },
  'dark-mode': {
    summary: 'Emulate dark color scheme / [data-theme="dark"] and audit dark contrast & un-inverted bright surfaces.',
    usage: 'uirig dark-mode [<url-or-file>] [--tokens-path=<path>] [--auto-tokens] [--scope=<csv>] [--exclude=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]',
    mechanics: [
      'Forces prefers-color-scheme: dark and toggles data-theme="dark" on <html> inside an isolated browser context.',
      'Re-runs Porter-Duff contrast checks and flags large surfaces stranded above 0.85 relative luminance.',
    ],
    options: SHARED_AUDIT_OPTIONS,
    exitCodes: [
      '0                   Dark-mode contrast and surface luminance checks passed',
      '1                   Dark-mode contrast regression or un-inverted bright surface detected',
    ],
    examples: [
      'npx @rlevin/uirig dark-mode http://localhost:5173 --verbose',
      'npx @rlevin/uirig dark-mode ./dist/index.html --json',
    ],
  },
  stress: {
    summary: 'Fuzz text with +30% expansion and space-free strings to catch layout overflow, bleed, and tiny tap targets.',
    usage: 'uirig stress [<url-or-file>] [--scope=<csv>] [--exclude=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]',
    mechanics: [
      'Injects +30% longer copy and unbreakable email/URL tokens to test flex/grid resilience and container clipping.',
      'Checks horizontal scrollbar bleed (or --scope container overflow when scoped), squished avatars, stuck opacity: 0 elements, and 24x24px minimum tap targets.',
    ],
    options: SHARED_AUDIT_OPTIONS,
    exitCodes: [
      '0                   No geometric overflow, scrollbar bleed, or touch-target violations',
      '2                   Structural layout break or touch-target size violation detected',
    ],
    examples: [
      'npx @rlevin/uirig stress http://localhost:5173 --headed',
      'npx @rlevin/uirig stress ./dist/index.html --verbose',
    ],
  },
  cls: {
    summary: 'Measure W3C 1s/5s session-window Cumulative Layout Shift (CLS) against clsMaxLimit.',
    usage: 'uirig cls [<url-or-file>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]',
    mechanics: [
      'Injects a pre-navigation PerformanceObserver for layout-shift entries prior to initial page load.',
      'Aggregates shifting bursts using W3C 1-second gap / 5-second max session windows.',
    ],
    options: SHARED_AUDIT_OPTIONS,
    exitCodes: [
      '0                   Session-window CLS score remained within clsMaxLimit',
      '2                   Unexpected layout shift exceeded configured clsMaxLimit',
    ],
    examples: [
      'npx @rlevin/uirig cls http://localhost:5173 --verbose',
      'npx @rlevin/uirig cls ./dist/index.html --json',
    ],
  },
  dom: {
    summary: 'Audit Light + Shadow DOM for broken ARIA/label IDs, broken media, unsafe links, and prompt-injection traps.',
    usage: 'uirig dom [<url-or-file>] [--scope=<csv>] [--exclude=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]',
    mechanics: [
      'Verifies aria-labelledby / label[for] ID resolution, accessible names on controls, and loaded <img> dimensions.',
      'Flags javascript: URIs, target="_blank" without rel="noopener", and invisible AI prompt-injection text.',
    ],
    options: SHARED_AUDIT_OPTIONS,
    exitCodes: [
      '0                   All structural DOM, ARIA, media, hygiene, and prompt-injection checks passed',
      '1                   One or more structural DOM or security hygiene violations detected',
    ],
    examples: [
      'npx @rlevin/uirig dom ./dist/index.html --verbose',
      'npx @rlevin/uirig dom http://localhost:5173 --json',
    ],
  },
  manifest: {
    summary: 'Print an ASCII repository directory tree blueprint while excluding blocklisted build/vendor directories.',
    usage: 'uirig manifest [--help]',
    mechanics: [
      'Walks the current workspace and renders a clean deterministic directory tree for documentation or agent context.',
    ],
    options: ['-h, --help          Show help for the manifest subcommand'],
    exitCodes: ['0                   Repository tree printed successfully'],
    examples: ['npx @rlevin/uirig manifest'],
  },
  mcp: {
    summary: 'Start a persistent Model Context Protocol (MCP) server with a warm headless Chromium instance.',
    usage: 'uirig mcp [--transport=<mode>] [--port=<n>] [--idle-timeout=<ms>] [--help]',
    mechanics: [
      'Exposes uirig_check and all 6 individual verification engines as typed MCP tools.',
      'Reuses a single warm Chromium browser across tool calls while isolating each run in fresh BrowserContexts.',
      'Routes all telemetry to stderr so stdout stays 100% pure for stdio JSON-RPC frames.',
    ],
    options: [
      '--transport=<mode>     Transport protocol: stdio (default) | sse',
      '--port=<n>             HTTP port when --transport=sse is active (default: 3333)',
      '--idle-timeout=<ms>    Close warm Chromium after N ms of inactivity (default: 300000)',
      '-h, --help             Show help for the mcp subcommand',
    ],
    exitCodes: [
      '0                   MCP server exited cleanly',
      '1                   Invalid CLI flags or fatal server startup error',
    ],
    examples: [
      'npx @rlevin/uirig mcp',
      'npx @rlevin/uirig mcp --transport=sse --port=3333',
      'npx @modelcontextprotocol/inspector node dist/index.js mcp',
    ],
  },
};

export const CLI_HELP_TEXT = `
${paint('uirig', 'bold', 'cyan')} v${UIRIG_VERSION}: The first line of defense for AI-generated UIs and Web Components

${paint('USAGE:', 'bold')}
  uirig <url-or-file> [options]   Run instant zero-config check against a URL or .html file
  uirig <command> [options]       Run a specific subcommand

${paint('COMMANDS:', 'bold')}
  init                            Scaffold uirig.config.json, .uirig/session.json, and .uirig/SKILL.md
  check [<url-or-file>]           Run all verification engines concurrently in isolated contexts
  tokens [<url-or-file>]          Run only the shadow-piercing design token drift auditor
  contrast [<url-or-file>]        Run only the WCAG 2.1 rendered luminance contrast gate
  dark-mode [<url-or-file>]       Run only the dark-mode theme parity & surface luminance gate
  stress [<url-or-file>]          Run only the +30% text-expansion geometric overflow fuzzer
  sweep [<url-or-file>]           Step viewport across [min, max, step] widths and report failing ranges
  cls [<url-or-file>]             Run only the W3C session-window Cumulative Layout Shift monitor
  dom [<url-or-file>]             Run only the structural DOM, ARIA, media & prompt-injection gate
  manifest                        Print ASCII repository tree blueprint (excluding blocklisted dirs)
  mcp                             Start persistent MCP server with warm Chromium (stdio or SSE)

${paint('AUDIT OPTIONS (check / tokens / contrast / dark-mode / stress / sweep / cls / dom):', 'bold')}
  --tokens-path=<path>            Path to W3C, Style Dictionary, flat JSON, or CSS token file
  --auto-tokens                   Auto-discover design tokens from workspace files & live :root CSS vars
  --themes=<csv>                  Evaluate target across multiple theme skins (e.g. --themes="light,dark")
  --sweep[=<min:max:step>]        Step viewport across responsive widths (default: 320:1440:40)
  --changed                       Scope audit to components modified in git diff (optional: --base <ref>)
  --base=<ref>                    Git base ref for --changed diff comparison (e.g. --base=main)
  --scope=<csv>                   Restrict audit to matching CSS selector containers (alias: -s, --selectors; repeatable)
  --exclude=<csv>                 Carve out matching CSS selector subtrees from audit (repeatable)
  --config=<path>                 Path to uirig.config.json (also supports: --config <path>)
  --only=<tool>                   Filter 'check' to one engine: tokens | contrast | dark-mode | stress | cls | dom | sweep
  --group-by-root                 Collapse child failures under their shared parent container or host
  --top=<n>                       Keep only the top N highest-priority violations (e.g. --top=5)
  --max-tokens=<budget>           Cap JSON output to approximately N LLM tokens (e.g. --max-tokens=1200)
  --spatial-brief                 Emit compact bounding-box summary of landmarks & target selectors
  --verbose                       Print individual failing selectors and details beneath each engine
  --json                          Route telemetry to stderr and emit machine-readable JSON to stdout
  --headed                        Launch Chromium with a visible browser window for local debugging

${paint('GLOBAL OPTIONS:', 'bold')}
  -h, --help                      Show this help message (or run 'uirig <command> --help')
  -v, --version                   Print CLI version

${paint('POSIX EXIT CODES:', 'bold')}
  0                               All geometric bounds, contrast ratios, token, and DOM checks passed
  1                               Config error, token drift, contrast failure, DOM violation, or runtime JS error
  2                               Structural layout break (overflow/collision/sweep) or CLS budget breach
`;

export function renderHelpText(topic?: string): string {
  if (!topic) {
    return CLI_HELP_TEXT.trim();
  }

  const normalizedTopic = topic.trim().toLowerCase();
  const spec = SUBCOMMAND_HELP_SPECS[normalizedTopic];
  if (!spec) {
    return CLI_HELP_TEXT.trim();
  }

  const formatList = (items: Array<string>): string =>
    items.map((line) => `  ${line}`).join('\n');

  return [
    `${paint(`uirig ${normalizedTopic}`, 'bold', 'cyan')} — ${spec.summary}`,
    '',
    `${paint('USAGE:', 'bold')}`,
    `  ${spec.usage}`,
    '',
    `${paint('HOW IT WORKS:', 'bold')}`,
    formatList(spec.mechanics),
    '',
    `${paint('OPTIONS:', 'bold')}`,
    formatList(spec.options),
    '',
    `${paint('POSIX EXIT CODES:', 'bold')}`,
    formatList(spec.exitCodes),
    '',
    `${paint('EXAMPLES:', 'bold')}`,
    formatList(spec.examples),
  ].join('\n');
}

export type McpTransportMode = 'stdio' | 'sse';

export interface IMcpCommandOptions {
  transport: McpTransportMode;
  port: number;
  idleTimeoutMs: number;
}

export type ParsedCliCommand =
  | { command: 'help'; topic?: string }
  | { command: 'version' }
  | { command: 'init' }
  | { command: 'manifest' }
  | {
      command: 'mcp';
      transport: McpTransportMode;
      port: number;
      idleTimeoutMs?: number;
    }
  | {
      command: 'check';
      target?: string;
      only?: AuditToolName;
      tokensPath?: string | Array<string>;
      autoTokens?: boolean;
      themes?: Array<string>;
      sweep?: string;
      changed?: boolean;
      baseRef?: string;
      fix?: boolean;
      scope?: Array<string>;
      selectors?: Array<string>;
      exclude?: Array<string>;
      configPath?: string;
      groupByRoot: boolean;
      top?: number;
      maxTokens?: number;
      spatialBrief: boolean;
      verbose: boolean;
      json: boolean;
      headless: boolean;
    }
  | {
      command: 'unknown';
      rawCommand: string;
      reason: string;
    };

export function isDirectTargetArg(arg: string): boolean {
  const trimmed = arg.trim();
  if (!trimmed || trimmed.startsWith('-')) {
    return false;
  }
  return (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('/') ||
    /\.html?$/i.test(trimmed)
  );
}

/**
 * Parses a positive whole number (>= 1) for `--top`, `--max-tokens`, `--port`, and `--idle-timeout`.
 * Returns `null` if the input is missing, non-numeric, decimal, zero, or negative.
 */
function parsePositiveIntegerFlag(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

function parseMcpCommandArgs(restArgs: Array<string>): ParsedCliCommand {
  let transport: McpTransportMode = 'stdio';
  let port = 3333;
  let idleTimeoutMs = 300_000;

  for (let i = 0; i < restArgs.length; i++) {
    const token = restArgs.at(i) ?? '';

    if (token === '-h' || token === '--help') {
      return { command: 'help', topic: 'mcp' };
    } else if (token.startsWith('--transport=')) {
      const mode = token.slice('--transport='.length).trim();
      if (mode !== 'stdio' && mode !== 'sse') {
        return {
          command: 'unknown',
          rawCommand: 'mcp',
          reason: `Invalid --transport value '${mode}'. Expected 'stdio' or 'sse'.`,
        };
      }
      transport = mode;
    } else if (token === '--transport') {
      const nextToken = restArgs.at(i + 1);
      if (nextToken !== 'stdio' && nextToken !== 'sse') {
        return {
          command: 'unknown',
          rawCommand: 'mcp',
          reason: `Invalid --transport value '${nextToken ?? ''}'. Expected 'stdio' or 'sse'.`,
        };
      }
      transport = nextToken;
      i++;
    } else if (token.startsWith('--port=')) {
      const parsedPort = parsePositiveIntegerFlag(token.slice('--port='.length));
      if (parsedPort === null || parsedPort > 65535) {
        return {
          command: 'unknown',
          rawCommand: 'mcp',
          reason: `Invalid --port value '${token.slice('--port='.length)}'. Expected an integer between 1 and 65535.`,
        };
      }
      port = parsedPort;
    } else if (token === '--port') {
      const nextToken = restArgs.at(i + 1);
      const parsedPort = nextToken ? parsePositiveIntegerFlag(nextToken) : null;
      if (parsedPort === null || parsedPort > 65535) {
        return {
          command: 'unknown',
          rawCommand: 'mcp',
          reason: `Invalid --port value '${nextToken ?? ''}'. Expected an integer between 1 and 65535.`,
        };
      }
      port = parsedPort;
      i++;
    } else if (token.startsWith('--idle-timeout=')) {
      const parsedTimeout = parsePositiveIntegerFlag(token.slice('--idle-timeout='.length));
      if (parsedTimeout === null) {
        return {
          command: 'unknown',
          rawCommand: 'mcp',
          reason: `Invalid --idle-timeout value '${token.slice('--idle-timeout='.length)}'. Expected a positive integer in ms.`,
        };
      }
      idleTimeoutMs = parsedTimeout;
    } else if (token === '--idle-timeout') {
      const nextToken = restArgs.at(i + 1);
      const parsedTimeout = nextToken ? parsePositiveIntegerFlag(nextToken) : null;
      if (parsedTimeout === null) {
        return {
          command: 'unknown',
          rawCommand: 'mcp',
          reason: `Invalid --idle-timeout value '${nextToken ?? ''}'. Expected a positive integer in ms.`,
        };
      }
      idleTimeoutMs = parsedTimeout;
      i++;
    } else {
      return {
        command: 'unknown',
        rawCommand: 'mcp',
        reason: `Unrecognized option for 'mcp': ${token}`,
      };
    }
  }

  return {
    command: 'mcp',
    transport,
    port,
    idleTimeoutMs,
  };
}

function parseAuditCommandArgs(
  rawSubcommand: string,
  restArgs: Array<string>,
  presetOnly?: AuditToolName,
  initialTarget?: string
): ParsedCliCommand {
  let target: string | undefined = initialTarget;
  let configPath: string | undefined;
  const collectedTokensPaths = new Array<string>();
  let only: AuditToolName | undefined = presetOnly;
  let autoTokens = false;
  let sweep: string | undefined;
  let changed = false;
  let baseRef: string | undefined;
  let fix = false;
  const collectedThemes = new Array<string>();
  const collectedScope = new Array<string>();
  const collectedSelectors = new Array<string>();
  const collectedExclude = new Array<string>();
  let groupByRoot = false;
  let top: number | undefined;
  let maxTokens: number | undefined;
  let spatialBrief = false;
  let verbose = false;
  let json = false;
  let headless = true;

  for (let i = 0; i < restArgs.length; i++) {
    const token = restArgs.at(i) ?? '';

    if (token === '--json') {
      json = true;
    } else if (token.startsWith('--tokens-path=') || token.startsWith('--token-path=')) {
      const value = token.startsWith('--tokens-path=')
        ? token.slice('--tokens-path='.length).trim()
        : token.slice('--token-path='.length).trim();
      const splitPaths = value
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      if (splitPaths.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing file path after --tokens-path=' };
      }
      collectedTokensPaths.push(...splitPaths);
    } else if (token === '--tokens-path' || token === '--token-path') {
      const nextToken = restArgs.at(i + 1);
      if (!nextToken || nextToken.startsWith('-')) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing file path after ' + token };
      }
      const splitPaths = nextToken
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      if (splitPaths.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing file path after ' + token };
      }
      collectedTokensPaths.push(...splitPaths);
      i++;
    } else if (token === '--auto-tokens') {
      autoTokens = true;
    } else if (token.startsWith('--sweep=')) {
      const rawSpec = token.slice('--sweep='.length).trim();
      try {
        parseSweepRange(rawSpec);
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : String(err);
        return { command: 'unknown', rawCommand: rawSubcommand, reason };
      }
      sweep = rawSpec;
    } else if (token === '--sweep') {
      const nextToken = restArgs.at(i + 1);
      if (nextToken && !nextToken.startsWith('-') && !isDirectTargetArg(nextToken)) {
        try {
          parseSweepRange(nextToken);
        } catch (err: unknown) {
          const reason = err instanceof Error ? err.message : String(err);
          return { command: 'unknown', rawCommand: rawSubcommand, reason };
        }
        sweep = nextToken.trim();
        i++;
      } else {
        sweep = DEFAULT_SWEEP_SPEC;
      }
    } else if (token === '--changed') {
      changed = true;
    } else if (token.startsWith('--base=')) {
      const val = token.slice('--base='.length).trim();
      if (val.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing Git ref after --base=' };
      }
      baseRef = val;
    } else if (token === '--base') {
      const nextToken = restArgs.at(i + 1);
      if (!nextToken || nextToken.startsWith('-')) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing Git ref after --base' };
      }
      baseRef = nextToken.trim();
      i++;
    } else if (token === '--fix') {
      fix = true;
    } else if (token.startsWith('--themes=')) {
      const parsedThemes = parseSelectorList(token.slice('--themes='.length));
      if (parsedThemes.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing theme name after --themes=' };
      }
      collectedThemes.push(...parsedThemes);
    } else if (token === '--themes') {
      const nextToken = restArgs.at(i + 1);
      if (!nextToken || nextToken.startsWith('-')) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing theme name after --themes' };
      }
      const parsedThemes = parseSelectorList(nextToken);
      if (parsedThemes.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Empty theme name after --themes' };
      }
      collectedThemes.push(...parsedThemes);
      i++;
    } else if (token === '--group-by-root') {
      groupByRoot = true;
    } else if (token === '--spatial-brief') {
      spatialBrief = true;
    } else if (token === '--verbose') {
      verbose = true;
    } else if (token === '--headed') {
      headless = false;
    } else if (token.startsWith('--top=')) {
      const parsedTop = parsePositiveIntegerFlag(token.slice('--top='.length));
      if (parsedTop === null) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: "Invalid --top value '" + token.slice('--top='.length) + "'. Expected a positive integer (e.g. --top=5)." };
      }
      top = parsedTop;
    } else if (token === '--top') {
      const nextToken = restArgs.at(i + 1);
      const parsedTop = nextToken ? parsePositiveIntegerFlag(nextToken) : null;
      if (parsedTop === null) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: "Invalid --top value '" + (nextToken ?? '') + "'. Expected a positive integer (e.g. --top 5)." };
      }
      top = parsedTop;
      i++;
    } else if (token.startsWith('--max-tokens=')) {
      const parsedTokens = parsePositiveIntegerFlag(token.slice('--max-tokens='.length));
      if (parsedTokens === null) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: "Invalid --max-tokens value '" + token.slice('--max-tokens='.length) + "'. Expected a positive integer (e.g. --max-tokens=1200)." };
      }
      maxTokens = parsedTokens;
    } else if (token === '--max-tokens') {
      const nextToken = restArgs.at(i + 1);
      const parsedTokens = nextToken ? parsePositiveIntegerFlag(nextToken) : null;
      if (parsedTokens === null) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: "Invalid --max-tokens value '" + (nextToken ?? '') + "'. Expected a positive integer (e.g. --max-tokens 1200)." };
      }
      maxTokens = parsedTokens;
      i++;
    } else if (token.startsWith('--scope=')) {
      const rawVal = token.slice('--scope='.length);
      const parsed = parseSelectorList(rawVal);
      if (parsed.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing CSS selector value after --scope=' };
      }
      collectedScope.push(...parsed);
    } else if (token === '--scope') {
      const nextToken = restArgs.at(i + 1);
      if (!nextToken || nextToken.startsWith('-')) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing CSS selector value after --scope' };
      }
      const parsed = parseSelectorList(nextToken);
      if (parsed.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Empty CSS selector value after --scope' };
      }
      collectedScope.push(...parsed);
      i++;
    } else if (token.startsWith('--selectors=') || token.startsWith('-s=')) {
      const rawVal = token.startsWith('--selectors=') ? token.slice('--selectors='.length) : token.slice('-s='.length);
      const parsed = parseSelectorList(rawVal);
      if (parsed.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing CSS selector value after --selectors=' };
      }
      collectedSelectors.push(...parsed);
    } else if (token === '--selectors' || token === '-s') {
      const nextToken = restArgs.at(i + 1);
      if (!nextToken || nextToken.startsWith('-')) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing CSS selector value after ' + token };
      }
      const parsed = parseSelectorList(nextToken);
      if (parsed.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Empty CSS selector value after ' + token };
      }
      collectedSelectors.push(...parsed);
      i++;
    } else if (token.startsWith('--exclude=')) {
      const rawVal = token.slice('--exclude='.length);
      const parsed = parseSelectorList(rawVal);
      if (parsed.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing CSS selector value after --exclude=' };
      }
      collectedExclude.push(...parsed);
    } else if (token === '--exclude') {
      const nextToken = restArgs.at(i + 1);
      if (!nextToken || nextToken.startsWith('-')) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing CSS selector value after --exclude' };
      }
      const parsed = parseSelectorList(nextToken);
      if (parsed.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Empty CSS selector value after --exclude' };
      }
      collectedExclude.push(...parsed);
      i++;
    } else if (token.startsWith('--only=')) {
      const toolValue = token.slice('--only='.length).trim() as AuditToolName;
      if (!AUDIT_TOOL_NAMES.has(toolValue)) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: "Invalid --only value '" + toolValue + "'. Expected one of: tokens, contrast, dark-mode, stress, cls, dom, sweep." };
      }
      only = toolValue;
    } else if (token.startsWith('--config=')) {
      const value = token.slice('--config='.length).trim();
      if (value.length === 0) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing file path after --config=' };
      }
      configPath = value;
    } else if (token === '--config') {
      const nextToken = restArgs.at(i + 1);
      if (!nextToken || nextToken.startsWith('-')) {
        return { command: 'unknown', rawCommand: rawSubcommand, reason: 'Missing file path after --config' };
      }
      configPath = nextToken;
      i++;
    } else if (token === '-h' || token === '--help') {
      const helpTopic = SUBCOMMAND_HELP_SPECS[rawSubcommand] ? rawSubcommand : undefined;
      return { command: 'help', topic: helpTopic };
    } else if (!token.startsWith('-') && !target && isDirectTargetArg(token)) {
      target = token;
    } else {
      return { command: 'unknown', rawCommand: rawSubcommand, reason: "Unrecognized option for '" + rawSubcommand + "': " + token };
    }
  }

  if (target !== undefined) {
    const urlError = validateHttpTargetUrl(target);
    if (urlError !== null) {
      return {
        command: 'unknown',
        rawCommand: rawSubcommand,
        reason: urlError,
      };
    }
  }

  const uniqueScope = collectedScope.length > 0 ? Array.from(new Set(collectedScope)) : undefined;
  const uniqueSelectors = collectedSelectors.length > 0 ? Array.from(new Set(collectedSelectors)) : undefined;
  const uniqueExclude = collectedExclude.length > 0 ? Array.from(new Set(collectedExclude)) : undefined;
  const uniqueThemes = collectedThemes.length > 0 ? Array.from(new Set(collectedThemes)) : undefined;
  const uniqueTokensPaths =
    collectedTokensPaths.length > 0 ? Array.from(new Set(collectedTokensPaths)) : undefined;
  const resolvedTokensPath: string | Array<string> | undefined =
    uniqueTokensPaths === undefined
      ? undefined
      : uniqueTokensPaths.length === 1
        ? uniqueTokensPaths.at(0)
        : uniqueTokensPaths;

  return {
    command: 'check',
    target,
    only,
    ...(resolvedTokensPath !== undefined ? { tokensPath: resolvedTokensPath } : {}),
    ...(autoTokens ? { autoTokens: true } : {}),
    ...(uniqueThemes ? { themes: uniqueThemes } : {}),
    ...(sweep !== undefined ? { sweep } : {}),
    ...(changed ? { changed: true } : {}),
    ...(baseRef ? { baseRef } : {}),
    ...(fix ? { fix: true } : {}),
    ...(uniqueScope ? { scope: uniqueScope } : {}),
    selectors: uniqueSelectors,
    ...(uniqueExclude ? { exclude: uniqueExclude } : {}),
    configPath,
    groupByRoot,
    top,
    maxTokens,
    spatialBrief,
    verbose,
    json,
    headless,
  };
}

export function parseCliArgs(argv: Array<string>): ParsedCliCommand {
  if (argv.length === 0) {
    return { command: 'help' };
  }

  const firstArg = argv.at(0) ?? '';
  const secondArg = argv.at(1);

  if (firstArg === '-h' || firstArg === '--help' || firstArg === 'help') {
    const topic =
      secondArg && SUBCOMMAND_HELP_SPECS[secondArg.toLowerCase()]
        ? secondArg.toLowerCase()
        : undefined;
    return { command: 'help', topic };
  }

  if (firstArg === '-v' || firstArg === '--version' || firstArg === 'version') {
    return { command: 'version' };
  }

  if (firstArg === 'init') {
    if (secondArg === '-h' || secondArg === '--help') {
      return { command: 'help', topic: 'init' };
    }
    return { command: 'init' };
  }

  if (firstArg === 'manifest') {
    if (secondArg === '-h' || secondArg === '--help') {
      return { command: 'help', topic: 'manifest' };
    }
    return { command: 'manifest' };
  }

  if (firstArg === 'mcp') {
    return parseMcpCommandArgs(argv.slice(1));
  }

  if (firstArg === 'check') {
    return parseAuditCommandArgs('check', argv.slice(1));
  }

  if (AUDIT_TOOL_NAMES.has(firstArg as AuditToolName)) {
    return parseAuditCommandArgs(firstArg, argv.slice(1), firstArg as AuditToolName);
  }

  if (isDirectTargetArg(firstArg)) {
    return parseAuditCommandArgs(firstArg, argv.slice(1), undefined, firstArg);
  }

  return {
    command: 'unknown',
    rawCommand: firstArg,
    reason: `Unknown command '${firstArg}'. Run 'uirig --help' to see available commands.`,
  };
}

export interface ICliCommandHandlers {
  init?: () => Promise<void>;
  manifest?: () => Promise<void>;
  check?: typeof executeCheckCommand;
  mcp?: (options: IMcpCommandOptions) => Promise<void>;
}

export async function runCli(
  argv: Array<string>,
  handlers: ICliCommandHandlers = {}
): Promise<PosixExitCode> {
  const parsed = parseCliArgs(argv);

  if (parsed.command === 'help') {
    process.stdout.write(renderHelpText(parsed.topic) + '\n');
    return 0;
  }

  if (parsed.command === 'version') {
    process.stdout.write(UIRIG_VERSION + '\n');
    return 0;
  }

  if (parsed.command === 'unknown') {
    console.error(paint('[uirig:cli] Error: ' + parsed.reason, 'bold', 'red'));
    return 1;
  }

  try {
    if (parsed.command === 'init') {
      const runInit = handlers.init ?? executeInitCommand;
      await runInit();
      return 0;
    }

    if (parsed.command === 'manifest') {
      const runManifest = handlers.manifest ?? executeManifestCommand;
      await runManifest();
      return 0;
    }

    if (parsed.command === 'mcp') {
      process.env.UIRIG_JSON_MODE = '1';
      const runMcp = handlers.mcp ?? executeMcpCommand;
      await runMcp({
        transport: parsed.transport,
        port: parsed.port,
        idleTimeoutMs: parsed.idleTimeoutMs ?? 300_000,
      });
      return 0;
    }

    const runCheck = handlers.check ?? executeCheckCommand;
    const report = await runCheck({
      target: parsed.target,
      configPath: parsed.configPath,
      ...(parsed.tokensPath ? { tokensPath: parsed.tokensPath } : {}),
      only: parsed.only,
      ...(parsed.autoTokens ? { autoTokens: true } : {}),
      ...(parsed.themes ? { themes: parsed.themes } : {}),
      ...(parsed.sweep !== undefined ? { sweep: parsed.sweep } : {}),
      ...(parsed.changed ? { changed: true } : {}),
      ...(parsed.baseRef ? { baseRef: parsed.baseRef } : {}),
      ...(parsed.fix ? { fix: true } : {}),
      ...(parsed.scope ? { scope: parsed.scope } : {}),
      selectors: parsed.selectors,
      ...(parsed.exclude ? { exclude: parsed.exclude } : {}),
      groupByRoot: parsed.groupByRoot,
      top: parsed.top,
      maxTokens: parsed.maxTokens,
      spatialBrief: parsed.spatialBrief,
      verbose: parsed.verbose,
      json: parsed.json,
      headless: parsed.headless,
    });
    return report.exitCode;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(paint('[uirig:fatal] ' + message, 'bold', 'red'));
    return 1;
  }
}

const isDirectEntrypoint =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectEntrypoint) {
  runCli(process.argv.slice(2))
    .then((code) => {
      process.exit(code);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(paint('[uirig:fatal] ' + message, 'bold', 'red'));
      process.exit(1);
    });
}

