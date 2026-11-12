/**
 * src/index.ts
 * Main system entry point and zero-dependency CLI argument parser/router for `uirig`.
 * Supports:
 * - `uirig <url-or-file> [--only=<tool>] [--config=<path>] [--json] [--headed]` (zero-config instant check)
 * - `uirig init`
 * - `uirig check [<url-or-file>] [--only=<tool>] [--config=<path>] [--json] [--headed]`
 * - `uirig tokens | contrast | dark-mode | stress | cls | dom [<url-or-file>] [--config=<path>] [--json] [--headed]`
 * - `uirig manifest`
 * - `uirig --help` / `uirig --version`
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
  -h, --help                      Show this help message
  -v, --version                   Print CLI version

${paint('POSIX EXIT CODES:', 'bold')}
  0                               All geometric bounds, contrast ratios, token, and DOM checks passed
  1                               Config error, token drift, contrast failure, DOM violation, or runtime JS error
  2                               Structural layout break (overflow/collision) or CLS budget breach
`;

export type ParsedCliCommand =
  | { command: 'help' }
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
          reason: `Invalid --only value '${toolValue}'. Expected one of: tokens, contrast, dark-mode, stress, cls.`,
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
      return { command: 'help' };
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

  if (firstArg === '-h' || firstArg === '--help' || firstArg === 'help') {
    return { command: 'help' };
  }

  if (firstArg === '-v' || firstArg === '--version' || firstArg === 'version') {
    return { command: 'version' };
  }

  if (firstArg === 'init') {
    return { command: 'init' };
  }

  if (firstArg === 'manifest') {
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
    process.stdout.write(`${CLI_HELP_TEXT.trim()}\n`);
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
