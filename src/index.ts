/**
 * src/index.ts
 * Main system entry point and zero-dependency CLI argument parser/router for `uirig`.
 * Supports:
 * - `uirig init`
 * - `uirig check [--only=<tool>] [--config=<path>] [--json] [--headed]`
 * - `uirig tokens | contrast | stress | cls [--config=<path>] [--json] [--headed]`
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

const AUDIT_TOOL_NAMES = new Set<AuditToolName>(['tokens', 'contrast', 'stress', 'cls']);

export const CLI_HELP_TEXT = `
${paint('uirig', 'bold', 'cyan')} v${UIRIG_VERSION} — Deterministic, framework-blind UI verification gate

${paint('USAGE:', 'bold')}
  uirig <command> [options]

${paint('COMMANDS:', 'bold')}
  init                        Scaffold uirig.config.json, .uirig/session.json, and .uirig/SKILL.md
  check [options]             Run all 4 verification engines concurrently in isolated contexts
  tokens [options]            Run only the shadow-piercing design token drift auditor
  contrast [options]          Run only the WCAG 2.1 rendered luminance contrast gate
  stress [options]            Run only the +30% pseudo-localization geometric overflow fuzzer
  cls [options]               Run only the W3C session-window Cumulative Layout Shift monitor
  manifest                    Print ASCII repository tree blueprint (excluding blocklisted dirs)

${paint('AUDIT OPTIONS (check / tokens / contrast / stress / cls):', 'bold')}
  --config=<path>             Path to uirig.config.json (also supports: --config <path>)
  --only=<tool>               Filter 'check' to one engine: tokens | contrast | stress | cls
  --json                      Route telemetry to stderr and emit machine-readable JSON to stdout
  --headed                    Launch Chromium with a visible browser window for local debugging

${paint('GLOBAL OPTIONS:', 'bold')}
  -h, --help                  Show this help message
  -v, --version               Print CLI version

${paint('POSIX EXIT CODES:', 'bold')}
  0                           All geometric bounds, contrast ratios, and token checks passed
  1                           Config error, design token drift, or WCAG contrast failure (< 4.5:1)
  2                           Structural layout break (overflow/collision) or CLS budget breach
`;

export type ParsedCliCommand =
  | { command: 'help' }
  | { command: 'version' }
  | { command: 'init' }
  | { command: 'manifest' }
  | {
      command: 'check';
      only?: AuditToolName;
      configPath?: string;
      json: boolean;
      headless: boolean;
    }
  | { command: 'unknown'; rawCommand: string; reason: string };

 /**
 * Parses shared audit flags (`--config`, `--only`, `--json`, `--headed`) for both
 * `uirig check` and standalone engine subcommands (`tokens`, `contrast`, `stress`, `cls`).
 */
function parseAuditCommandArgs(
  rawSubcommand: string,
  restArgs: string[],
  presetOnly?: AuditToolName
): ParsedCliCommand {
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
          reason: `Invalid --only value '${toolValue}'. Expected one of: tokens, contrast, stress, cls.`,
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
