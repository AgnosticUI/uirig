/**
 * src/index.ts
 * Main system entry point and zero-dependency CLI argument parser/router for `uirig`.
 * Supports:
 * - `uirig init`
 * - `uirig check [--config=<path>] [--json] [--headed]`
 * - `uirig manifest`
 * - `uirig --help` / `uirig --version`
 */

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { executeInitCommand } from './commands/init.js';
import { executeCheckCommand, type PosixExitCode } from './commands/check.js';
import { executeManifestCommand } from './commands/manifest.js';
import { logTelemetry, paint } from './utils/formatter.js';

export const UIRIG_VERSION = '0.1.0';

export const CLI_HELP_TEXT = `
${paint('uirig', 'bold', 'cyan')} v${UIRIG_VERSION} — Deterministic, framework-blind UI verification gate

${paint('USAGE:', 'bold')}
  uirig <command> [options]

${paint('COMMANDS:', 'bold')}
  init                        Scaffold uirig.config.json, .uirig/session.json, and .uirig/SKILL.md
  check [options]             Run tokens, contrast, +30% stress, and CLS audits in parallel contexts
  manifest                    Print ASCII repository tree blueprint (excluding blocklisted dirs)

${paint('CHECK OPTIONS:', 'bold')}
  --config=<path>             Path to uirig.config.json (also supports: --config <path>)
  --json                      Suppress human tables and emit machine-readable JSON to stdout
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
      configPath?: string;
      json: boolean;
      headless: boolean;
    }
  | { command: 'unknown'; rawCommand: string; reason: string };

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
    let configPath: string | undefined;
    let json = false;
    let headless = true;

    const rest = argv.slice(1);
    for (let i = 0; i < rest.length; i++) {
      const token = rest.at(i) ?? '';

      if (token === '--json') {
        json = true;
      } else if (token === '--headed') {
        headless = false;
      } else if (token.startsWith('--config=')) {
        const value = token.slice('--config='.length).trim();
        if (value.length === 0) {
          return {
            command: 'unknown',
            rawCommand: 'check',
            reason: 'Missing file path after --config=',
          };
        }
        configPath = value;
      } else if (token === '--config') {
        const nextToken = rest.at(i + 1);
        if (!nextToken || nextToken.startsWith('-')) {
          return {
            command: 'unknown',
            rawCommand: 'check',
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
          rawCommand: 'check',
          reason: `Unrecognized option for 'check': ${token}`,
        };
      }
    }

    return {
      command: 'check',
      configPath,
      json,
      headless,
    };
  }

  return {
    command: 'unknown',
    rawCommand: firstArg,
    reason: `Unknown command '${firstArg}'. Run 'uirig --help' to see available commands.`,
  };
}

/**
 * Optional dependency injection overrides for `runCli()` so unit tests can verify
 * command routing and exit codes without spawning live browsers or writing to disk.
 */
export interface ICliCommandHandlers {
  init?: () => Promise<void>;
  manifest?: () => Promise<void>;
  check?: typeof executeCheckCommand;
}

/**
 * Executes a parsed CLI command sequence and resolves to a deterministic POSIX exit code:
 * - `0`: Success (`help`, `version`, `init`, `manifest`, or passing `check`).
 * - `1`: Invalid CLI syntax, config/token load failure, or token/contrast violations.
 * - `2`: Structural layout break or CLS budget breach during `check`.
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

    // parsed.command === 'check'
    const runCheck = handlers.check ?? executeCheckCommand;
    const report = await runCheck({
      configPath: parsed.configPath,
      json: parsed.json,
      headless: parsed.headless,
    });
    return report.exitCode;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Always route crash diagnostics to stderr so stdout remains clean in --json mode
    console.error(paint(`[uirig:fatal] ${message}`, 'bold', 'red'));
    return 1;
  }
}

/**
 * Direct CLI invocation guard: runs `runCli(process.argv.slice(2))` and exits with the
 * returned POSIX exit code ONLY when `src/index.ts` is executed as the main script
 * (not when imported by `vitest` or programmatic consumers).
 */
const currentScriptPath = fileURLToPath(import.meta.url);
const invokedScriptPath = process.argv.at(1) ? resolve(process.argv.at(1) as string) : '';

if (currentScriptPath === invokedScriptPath) {
  logTelemetry('cli:boot', `Starting uirig v${UIRIG_VERSION}...`);
  runCli(process.argv.slice(2)).then((exitCode) => {
    process.exit(exitCode);
  });
}
