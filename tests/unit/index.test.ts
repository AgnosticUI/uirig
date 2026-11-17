/**
 * tests/unit/index.test.ts
 * Unit test suite for the root CLI entry router (`src/index.ts`), including
 * zero-config direct target invocations (`uirig <url-or-file>`), `--selectors`
 * / `-s` scoping flags, `--top` & `--max-tokens` output limits, `--spatial-brief`,
 * `--verbose`, subcommand routing, subcommand-specific `--help` pages, and POSIX exit codes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseCliArgs,
  runCli,
  CLI_HELP_TEXT,
  renderHelpText,
  UIRIG_VERSION,
} from '../../src/index.js';
import type { ICheckExecutionReport } from '../../src/commands/check.js';

function createMockReport(exitCode: 0 | 1 | 2 = 0): ICheckExecutionReport {
  return {
    timestamp: '2026-11-12T12:00:00.000Z',
    configPath: '/workspace/uirig.config.json',
    reportPath: '/workspace/.uirig/github_pr_comment.md',
    exitCode,
    results: new Array(),
    summary: {
      totalViewportsAudited: 1,
      totalTokenViolations: 0,
      totalContrastViolations: 0,
      totalStressViolations: 0,
      totalClsViolations: 0,
    },
  };
}

describe('Root CLI Entry Router (src/index.ts)', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('parses `check` defaults cleanly and captures --only, --config, --top, --max-tokens, --spatial-brief, --verbose, --json, and --headed flags', () => {
    console.log('[TEST] Verifying parseCliArgs for check command and flags...');

    expect(parseCliArgs(['check'])).toEqual({
      command: 'check',
      target: undefined,
      only: undefined,
      selectors: undefined,
      configPath: undefined,
      top: undefined,
      maxTokens: undefined,
      spatialBrief: false,
      verbose: false,
      json: false,
      headless: true,
    });

    expect(
      parseCliArgs([
        'check',
        '--only=contrast',
        '--config=./custom/uirig.config.json',
        '--top=5',
        '--max-tokens=1200',
        '--spatial-brief',
        '--verbose',
        '--json',
        '--headed',
      ])
    ).toEqual({
      command: 'check',
      target: undefined,
      only: 'contrast',
      selectors: undefined,
      configPath: './custom/uirig.config.json',
      top: 5,
      maxTokens: 1200,
      spatialBrief: true,
      verbose: true,
      json: true,
      headless: false,
    });
  });

  it('parses zero-config direct URL and local .html file targets (`uirig <url-or-file>`)', () => {
    console.log('[TEST] Verifying zero-config direct target parsing in parseCliArgs...');

    expect(parseCliArgs(['http://localhost:5173', '--json'])).toEqual({
      command: 'check',
      target: 'http://localhost:5173',
      only: undefined,
      selectors: undefined,
      configPath: undefined,
      top: undefined,
      maxTokens: undefined,
      spatialBrief: false,
      verbose: false,
      json: true,
      headless: true,
    });
    expect(
      parseCliArgs([
        './index.html',
        '--only=contrast',
        '--headed',
        '--spatial-brief',
        '--top',
        '3',
        '--max-tokens',
        '800',
      ])
    ).toEqual({
      command: 'check',
      target: './index.html',
      only: 'contrast',
      selectors: undefined,
      configPath: undefined,
      top: 3,
      maxTokens: 800,
      spatialBrief: true,
      verbose: false,
      json: false,
      headless: false,
    });

    expect(parseCliArgs(['check', 'dist/preview.html', '--config', 'alt.config.json'])).toEqual({
      command: 'check',
      target: 'dist/preview.html',
      only: undefined,
      selectors: undefined,
      configPath: 'alt.config.json',
      top: undefined,
      maxTokens: undefined,
      spatialBrief: false,
      verbose: false,
      json: false,
      headless: true,
    });
  });

  it('parses comma-separated and repeatable --selectors / -s flags with deduplication', () => {
    console.log('[TEST] Verifying --selectors / -s parsing and validation...');

    expect(
      parseCliArgs([
        'check',
        './index.html',
        '--selectors=#hero, .pricing-card',
        '-s',
        '.pricing-card, ag-button',
      ])
    ).toEqual({
      command: 'check',
      target: './index.html',
      only: undefined,
      selectors: ['#hero', '.pricing-card', 'ag-button'],
      configPath: undefined,
      top: undefined,
      maxTokens: undefined,
      spatialBrief: false,
      verbose: false,
      json: false,
      headless: true,
    });

    expect(parseCliArgs(['check', '--selectors=']).command).toBe('unknown');
    expect(parseCliArgs(['check', '-s']).command).toBe('unknown');
  });

  it('prints help text on empty args or --help and version on --version', async () => {
    console.log('[TEST] Verifying --help and --version CLI routes...');

    const emptyExit = await runCli(new Array<string>());
    expect(emptyExit).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith(`${CLI_HELP_TEXT.trim()}\n`);

    const helpExit = await runCli(['--help']);
    expect(helpExit).toBe(0);

    const versionExit = await runCli(['--version']);
    expect(versionExit).toBe(0);
    expect(stdoutSpy).toHaveBeenLastCalledWith(`${UIRIG_VERSION}\n`);
  });

  it('renders dedicated subcommand help pages for `uirig <command> --help` and `uirig help <command>`', async () => {
    console.log('[TEST] Verifying subcommand-specific --help pages...');

    const darkModeHelpExit = await runCli(['dark-mode', '--help']);
    expect(darkModeHelpExit).toBe(0);
    const darkModeOutput = String(stdoutSpy.mock.calls.at(-1)?.at(0) ?? '');
    expect(darkModeOutput).toContain('uirig dark-mode');
    expect(darkModeOutput).toContain('prefers-color-scheme: dark');
    expect(darkModeOutput).toContain('--selectors=<csv>');

    const checkHelpExit = await runCli(['help', 'check']);
    expect(checkHelpExit).toBe(0);
    const checkOutput = String(stdoutSpy.mock.calls.at(-1)?.at(0) ?? '');
    expect(checkOutput).toContain('uirig check');
    expect(checkOutput).toContain('--only=<tool>');
    expect(checkOutput).toContain('--top=<n>');
    expect(checkOutput).toContain('--max-tokens=<budget>');
    expect(checkOutput).toContain('--spatial-brief');
    expect(checkOutput).toContain('POSIX EXIT CODES:');

    const initHelpExit = await runCli(['init', '-h']);
    expect(initHelpExit).toBe(0);
    expect(renderHelpText('init')).toContain('uirig init');

    expect(renderHelpText('nonexistent-topic')).toBe(CLI_HELP_TEXT.trim());
  });

    it('routes `init`, `manifest`, and `check` (including zero-config target, selectors, top, maxTokens, spatialBrief & verbose) to handlers and forwards POSIX exit code', async () => {
    console.log('[TEST] Verifying subcommand routing and exit code propagation...');

    const initSpy = vi.fn(async () => {});
    const manifestSpy = vi.fn(async () => {});
    const checkSpy = vi.fn(async () => createMockReport(2));

    expect(await runCli(['init'], { init: initSpy })).toBe(0);
    expect(initSpy).toHaveBeenCalledTimes(1);

    expect(await runCli(['manifest'], { manifest: manifestSpy })).toBe(0);
    expect(manifestSpy).toHaveBeenCalledTimes(1);

    const checkExit = await runCli(
      [
        './demo.html',
        '--only=stress',
        '-s',
        '.card',
        '--top=4',
        '--max-tokens=900',
        '--spatial-brief',
        '--verbose',
        '--json',
      ],
      { check: checkSpy }
    );
    expect(checkExit).toBe(2);
    expect(checkSpy).toHaveBeenCalledWith({
      target: './demo.html',
      configPath: undefined,
      only: 'stress',
      selectors: ['.card'],
      top: 4,
      maxTokens: 900,
      spatialBrief: true,
      verbose: true,
      json: true,
      headless: true,
    });
  });

  it('supports standalone subcommands (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom`) with optional direct targets', async () => {
    console.log('[TEST] Verifying standalone engine subcommands...');

    const checkSpy = vi.fn(async () => createMockReport(0));

    expect(
      parseCliArgs(['tokens', '--config=uirig.config.json', '--selectors=ag-button'])
    ).toEqual({
      command: 'check',
      target: undefined,
      only: 'tokens',
      selectors: ['ag-button'],
      configPath: 'uirig.config.json',
      top: undefined,
      maxTokens: undefined,
      spatialBrief: false,
      verbose: false,
      json: false,
      headless: true,
    });

    expect(parseCliArgs(['dark-mode', './index.html', '--verbose'])).toEqual({
      command: 'check',
      target: './index.html',
      only: 'dark-mode',
      selectors: undefined,
      configPath: undefined,
      top: undefined,
      maxTokens: undefined,
      spatialBrief: false,
      verbose: true,
      json: false,
      headless: true,
    });


        const domExit = await runCli(['dom', './index.html', '--json'], { check: checkSpy });
    expect(domExit).toBe(0);
    expect(checkSpy).toHaveBeenLastCalledWith({
      target: './index.html',
      configPath: undefined,
      only: 'dom',
      selectors: undefined,
      top: undefined,
      maxTokens: undefined,
      spatialBrief: false,
      verbose: false,
      json: true,
      headless: true,
    });
  });

  it('returns POSIX exit code 1 on unknown commands, invalid --only tools, invalid --top/--max-tokens values, or handler errors', async () => {
    console.log('[TEST] Verifying error handling for invalid CLI arguments...');

    expect(await runCli(['unknown-cmd'])).toBe(1);
    expect(await runCli(['check', '--only=lighthouse'])).toBe(1);
    expect(await runCli(['check', '--config'])).toBe(1);
    expect(await runCli(['check', '--top=0'])).toBe(1);
    expect(await runCli(['check', '--top=-3'])).toBe(1);
    expect(await runCli(['check', '--top'])).toBe(1);
    expect(await runCli(['check', '--max-tokens=abc'])).toBe(1);
    expect(await runCli(['check', '--max-tokens=0'])).toBe(1);
    expect(await runCli(['check', '--max-tokens'])).toBe(1);

    const failingCheck = vi.fn(async () => {
      throw new Error('ERR_CONFIG_MISSING: uirig.config.json not found');
    });
    expect(await runCli(['check'], { check: failingCheck })).toBe(1);
  });
});
