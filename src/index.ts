/**
 * src/index.ts
 * Main system entry point and zero-dependency CLI argument parser/router for `uirig`.
 * Supports:
 * - `uirig <url-or-file> [--only=<tool>] [--config=<path>] [--json] [--headed]` (zero-config instant check)
 * - `uirig init`
 * - `uirig check [<url-or-file>] [--only=<tool>] [--config=<path>] [--json] [--headed]`
 * - `uirig tokens | contrast | dark-mode | stress | cls | dom [<url-or-file>] [--config=<path>] [--json] [--headed]`
 * - `uirig manifest`
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

export const UIRIG_VERSION = '0.1.0';

const AUDIT_TOOL_NAMES = new Set<AuditToolName>([
  'tokens',
  'contrast',
  'dark-mode',
  'stress',
  'cls',
  'dom',
]);

interface ISubcommandHelpSpec {
  summary: string;
  usage: string;
  mechanics: string[];
  options: string[];
  exitCodes: string[];
  examples: string[];
}

const SHARED_AUDIT_OPTIONS = [
  '--config=<path>     Path to uirig.config.json (also supports: --config <path>)',
  '--json              Route diagnostic logs to stderr and emit deduplicated JSON to stdout',
  '--headed            Launch Chromium with a visible browser window for local inspection',
  '-h, --help          Show this command help page',
];

/**
 * Structured per-subcommand documentation dictionary.
 * Centralizing usage, mechanics, flags, exit codes, and examples guarantees every
 * CLI subcommand offers self-contained help without drifting from top-level docs.
 */
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
    examples: ['npx uirig init'],
  },
  check: {
    summary: 'Run all 6 verification engines concurrently across configured or direct targets in isolated contexts.',
    usage: 'uirig check [<url-or-file>] [--only=<tool>] [--config=<path>] [--json] [--headed]',
    mechanics: [
      'Launches a single headless Chromium instance and isolates each (url, viewport) pair in a fresh BrowserContext.',
      'Automatically serves local .html files on an ephemeral 127.0.0.1 HTTP server when given a file path.',
      'Captures uncaught runtime pageerror and console.error exceptions and writes .uirig/github_pr_comment.md.',
    ],
    options: [
      '--only=<tool>       Filter execution to one engine: tokens | contrast | dark-mode | stress | cls | dom',
      ...SHARED_AUDIT_OPTIONS,
    ],
    exitCodes: [
      '0                   All token, contrast, dark-mode, stress, CLS, DOM, and runtime checks passed',
      '1                   Token drift, contrast/dark-mode failure, DOM violation, uncaught JS error, or config error',
      '2                   Structural layout overflow/collision or CLS budget breach',
    ],
    examples: [
      'npx uirig check',
      'npx uirig check ./dist/index.html --json',
      'npx uirig check --only=dark-mode --headed',
    ],
  },
  tokens: {
    summary: 'Audit Light DOM and open ShadowRoot computed styles against your design token scale.',
    usage: 'uirig tokens [<url-or-file>] [--config=<path>] [--json] [--headed]',
    mechanics: [
      'Climbs Light DOM and nested Web Component ShadowRoot trees to inspect rendered colors, spacing, font sizes, and radii.',
      'Attributes violations to the nearest custom element hostComponent and respects data-uirig-ignore="tokens".',
    ],
    options: SHARED_AUDIT_OPTIONS,
    exitCodes: [
      '0                   All computed styles align with configured design tokens',
      '1                   Hardcoded off-scale values detected or config error',
    ],
    examples: [
      'npx uirig tokens http://localhost:5173',
      'npx uirig tokens --config=./uirig.config.json --json',
    ],
  },
  contrast: {
    summary: 'Verify WCAG 2.1 AA rendered luminance contrast (>= 4.5:1) using Porter-Duff alpha compositing.',
    usage: 'uirig contrast [<url-or-file>] [--config=<path>] [--json] [--headed]',
    mechanics: [
      'Walks Light DOM and ShadowRoot.host ancestors to composite translucent backgrounds before computing luminance contrast.',
      'Computes the nearest passing design system color token (suggestedToken) when tokensPath is configured.',
    ],
    options: SHARED_AUDIT_OPTIONS,
    exitCodes: [
      '0                   All visible text nodes meet WCAG 2.1 AA contrast thresholds',
      '1                   One or more text nodes fell below required contrast ratios',
    ],
    examples: [
      'npx uirig contrast ./dist/index.html',
      'npx uirig contrast http://localhost:5173 --json',
    ],
  },
  'dark-mode': {
    summary: 'Emulate dark color scheme / [data-theme="dark"] and audit dark contrast & un-inverted bright surfaces.',
    usage: 'uirig dark-mode [<url-or-file>] [--config=<path>] [--json] [--headed]',
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
      'npx uirig dark-mode http://localhost:5173',
      'npx uirig dark-mode ./dist/index.html --json',
    ],
  },
  stress: {
    summary: 'Fuzz text with +30% expansion and space-free strings to catch layout overflow, bleed, and tiny tap targets.',
    usage: 'uirig stress [<url-or-file>] [--config=<path>] [--json] [--headed]',
    mechanics: [
      'Injects +30% longer copy and unbreakable email/URL tokens to test flex/grid resilience and container clipping.',
      'Checks horizontal scrollbar bleed (100vw), squished avatars, stuck opacity: 0 elements, and 24x24px minimum tap targets.',
    ],
    options: SHARED_AUDIT_OPTIONS,
    exitCodes: [
      '0                   No geometric overflow, scrollbar bleed, or touch-target violations',
      '2                   Structural layout break or touch-target size violation detected',
    ],
    examples: [
      'npx uirig stress http://localhost:5173 --headed',
      'npx uirig stress ./dist/index.html --json',
    ],
  },
  cls: {
    summary: 'Measure W3C 1s/5s session-window Cumulative Layout Shift (CLS) against clsMaxLimit.',
    usage: 'uirig cls [<url-or-file>] [--config=<path>] [--json] [--headed]',
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
      'npx uirig cls http://localhost:5173',
      'npx uirig cls ./dist/index.html --json',
    ],
  },
  dom: {
    summary: 'Audit Light + Shadow DOM for broken ARIA/label IDs, broken media, unsafe links, and prompt-injection traps.',
    usage: 'uirig dom [<url-or-file>] [--config=<path>] [--json] [--headed]',
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
      'npx uirig dom ./dist/index.html',
      'npx uirig dom http://localhost:5173 --json',
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
    examples: ['npx uirig manifest'],
  },
};
export const CLI_HELP_TEXT = `
${paint('uirig', 'bold', 'cyan')} v${UIRIG_VERSION}: The first line of defense for AI-generated UIs and Web Components

${paint('USAGE:', 'bold')}
  uirig <url-or-file> [options]   Run instant zero-config check against a URL or .html file
  uirig <command> [options]       Run a specific subcommand

${paint('COMMANDS:', 'bold')}
  init                            Scaffold uirig.config.json, .uirig/session.json, and .uirig/SKILL.md
  check [<url-or-file>]           Run all 6 verification engines concurrently in isolated contexts
  tokens [<url-or-file>]          Run only the shadow-piercing design token drift auditor
  contrast [<url-or-file>]        Run only the WCAG 2.1 rendered luminance contrast gate
  dark-mode [<url-or-file>]       Run only the dark-mode theme parity & surface luminance gate
  stress [<url-or-file>]          Run only the +30% text-expansion geometric overflow fuzzer
  cls [<url-or-file>]             Run only the W3C session-window Cumulative Layout Shift monitor
  dom [<url-or-file>]             Run only the structural DOM, ARIA, media & prompt-injection gate
  manifest                        Print ASCII repository tree blueprint (excluding blocklisted dirs)

${paint('AUDIT OPTIONS (check / tokens / contrast / dark-mode / stress / cls / dom):', 'bold')}
  --config=<path>                 Path to uirig.config.json (also supports: --config <path>)
  --only=<tool>                   Filter 'check' to one engine: tokens | contrast | dark-mode | stress | cls | dom
  --json                          Route telemetry to stderr and emit machine-readable JSON to stdout
  --headed                        Launch Chromium with a visible browser window for local debugging

${paint('GLOBAL OPTIONS:', 'bold')}
  -h, --help                      Show this help message (or run 'uirig <command> --help')
  -v, --version                   Print CLI version

${paint('POSIX EXIT CODES:', 'bold')}
  0                               All geometric bounds, contrast ratios, token, and DOM checks passed
  1                               Config error, token drift, contrast failure, DOM violation, or runtime JS error
  2                               Structural layout break (overflow/collision) or CLS budget breach
`;

/**
 * Renders either the top-level CLI help banner or an ANSI-styled subcommand manual
 * when a valid topic (`init`, `check`, `tokens`, `contrast`, `dark-mode`, `stress`,
 * `cls`, `dom`, `manifest`) is supplied.
 */
export function renderHelpText(topic?: string): string {
  if (!topic) {
    return CLI_HELP_TEXT.trim();
  }

  const normalizedTopic = topic.trim().toLowerCase();
  const spec = SUBCOMMAND_HELP_SPECS[normalizedTopic];
  if (!spec) {
    return CLI_HELP_TEXT.trim();
  }

  const formatList = (items: string[]): string =>
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

export type ParsedCliCommand =
  | { command: 'help'; topic?: string }
  | { command: 'version' }
  | { command: 'init' }
  | { command: 'manifest' }
  | {
      command: 'check';
      target?: string;
      only?: AuditToolName;
      configPath?: string;
      json: boolean;
      headless: boolean;
    }
  | { command: 'unknown'; rawCommand: string; reason: string };

/**
 * Determines whether a positional CLI argument looks like a direct HTTP(S) URL
 * or local `.html` / path target (e.g. `http://localhost:5173`, `./dist/index.html`).
 */
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
 * Parses shared audit flags (`--config`, `--only`, `--json`, `--headed`) and optional
 * positional `<url-or-file>` target for `uirig <target>`, `uirig check`, and standalone engines.
 */
function parseAuditCommandArgs(
  rawSubcommand: string,
  restArgs: string[],
  presetOnly?: AuditToolName,
  initialTarget?: string
): ParsedCliCommand {
  let target: string | undefined = initialTarget;
  let configPath: string | undefined;
  let only: AuditToolName | undefined = presetOnly;
  let json = false;
  let headless = true;

  for (let i = 0; i < restArgs.length; i++) {
    const token = restArgs.at(i) ?? '';

    if (token === '--json') {
      json = true;
    } else if (token === '--headed') {
      headless = false;
    } else if (token.startsWith('--only=')) {
      const toolValue = token.slice('--only='.length).trim() as AuditToolName;
      if (!AUDIT_TOOL_NAMES.has(toolValue)) {
        return {
          command: 'unknown',
          rawCommand: rawSubcommand,
          reason: `Invalid --only value '${toolValue}'. Expected one of: tokens, contrast, dark-mode, stress, cls, dom.`,
        };
      }
      only = toolValue;
    } else if (token.startsWith('--config=')) {
      const value = token.slice('--config='.length).trim();
      if (value.length === 0) {
        return {
          command: 'unknown',
          rawCommand: rawSubcommand,
          reason: 'Missing file path after --config=',
        };
      }
      configPath = value;
    } else if (token === '--config') {
      const nextToken = restArgs.at(i + 1);
      if (!nextToken || nextToken.startsWith('-')) {
        return {
          command: 'unknown',
          rawCommand: rawSubcommand,
          reason: 'Missing file path after --config',
        };
      }
      configPath = nextToken;
      i++;
    } else if (token === '-h' || token === '--help') {
      const helpTopic = SUBCOMMAND_HELP_SPECS[rawSubcommand] ? rawSubcommand : undefined;
      return { command: 'help', topic: helpTopic };
    } else if (!token.startsWith('-') && !target && isDirectTargetArg(token)) {
      target = token;
    } else {
      return {
        command: 'unknown',
        rawCommand: rawSubcommand,
        reason: `Unrecognized option for '${rawSubcommand}': ${token}`,
      };
    }
  }

  return {
    command: 'check',
    target,
    only,
    configPath,
    json,
    headless,
  };
}

/**
 * Pure CLI argument parser that converts `process.argv.slice(2)` into a strongly
 * typed `ParsedCliCommand` discriminated union.
 */
export function parseCliArgs(argv: string[]): ParsedCliCommand {
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
}

/**
 * Executes a parsed CLI command sequence and resolves to a deterministic POSIX exit code.
 */
export async function runCli(
  argv: string[],
  handlers: ICliCommandHandlers = {}
): Promise<PosixExitCode> {
  const parsed = parseCliArgs(argv);

  if (parsed.command === 'help') {
    process.stdout.write(`${renderHelpText(parsed.topic)}\n`);
    return 0;
  }

  if (parsed.command === 'version') {
    process.stdout.write(`${UIRIG_VERSION}\n`);
    return 0;
  }

  if (parsed.command === 'unknown') {
    console.error(paint(`[uirig:cli] Error: ${parsed.reason}`, 'bold', 'red'));
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

    const runCheck = handlers.check ?? executeCheckCommand;
    const report = await runCheck({
      target: parsed.target,
      configPath: parsed.configPath,
      only: parsed.only,
      json: parsed.json,
      headless: parsed.headless,
    });
    return report.exitCode;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(paint(`[uirig:fatal] ${message}`, 'bold', 'red'));
    return 1;
  }
}

const currentScriptPath = fileURLToPath(import.meta.url);
const invokedScriptPath = process.argv.at(1) ? resolve(process.argv.at(1) as string) : '';

if (currentScriptPath === invokedScriptPath) {
  logTelemetry('cli:boot', `Starting uirig v${UIRIG_VERSION}...`);
  runCli(process.argv.slice(2)).then((exitCode) => {
    process.exit(exitCode);
  });
}

