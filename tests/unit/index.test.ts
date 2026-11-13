/**
 * tests/unit/index.test.ts
 * 1-to-1 unit tests for `src/index.ts`.
 * Verifies:
 * 1. Pure CLI argument parsing (`parseCliArgs`) across `init`, `manifest`, `check`,
 *    direct zero-config `<url-or-file>` targets, `--config`, `--json`, `--headed`, `--help`, `--version`, and invalid flags.
 * 2. Subcommand-specific `--help` topic parsing and `renderHelpText(topic?)` output for all 9 commands.
 * 3. Command dispatching and deterministic POSIX exit codes (`0`, `1`, `2`) in `runCli()`.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { resolve } from 'path';
import { parseCliArgs, renderHelpText, runCli, UIRIG_VERSION } from '../../src/index.js';
import type { ICheckExecutionReport } from '../../src/commands/check.js';

function createMockReport(exitCode: 0 | 1 | 2): ICheckExecutionReport {
  return {
    timestamp: '2026-11-12T08:00:00.000Z',
    configPath: '/workspace/uirig.config.json',
    reportPath: '/workspace/.uirig/github_pr_comment.md',
    exitCode,
    results: [],
    summary: {
      totalViewportsAudited: 1,
      totalTokenViolations: exitCode === 1 ? 1 : 0,
      totalContrastViolations: 0,
      totalStressViolations: exitCode === 2 ? 1 : 0,
      totalClsViolations: 0,
    },
  };
}

describe('index.ts — Root CLI Parser & Command Router', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses help, version, init, and manifest subcommands accurately', () => {
    console.log('\n--- START TEST: Basic Subcommand & Flag Parsing ---');
    expect(parseCliArgs([])).toEqual({ command: 'help', topic: undefined });
    expect(parseCliArgs(['--help'])).toEqual({ command: 'help', topic: undefined });
    expect(parseCliArgs(['-v'])).toEqual({ command: 'version' });
    expect(parseCliArgs(['init'])).toEqual({ command: 'init' });
    expect(parseCliArgs(['manifest'])).toEqual({ command: 'manifest' });
  });

  it('parses check flags (--config=, --config <path>, --json, --headed)', () => {
    console.log('\n--- START TEST: check Command Flag Parsing ---');
    expect(parseCliArgs(['check'])).toEqual({
      command: 'check',
      target: undefined,
      only: undefined,
      configPath: undefined,
      json: false,
      headless: true,
    });

    expect(parseCliArgs(['check', '--config=./custom.json', '--json', '--headed'])).toEqual({
      command: 'check',
      target: undefined,
      only: undefined,
      configPath: './custom.json',
      json: true,
      headless: false,
    });

    expect(parseCliArgs(['check', '--config', 'dir/uirig.config.json'])).toEqual({
      command: 'check',
      target: undefined,
      only: undefined,
      configPath: 'dir/uirig.config.json',
      json: false,
      headless: true,
    });
  });

  it('parses direct zero-config <url-or-file> targets and standalone engine + target pairs', () => {
    console.log('\n--- START TEST: Zero-Config Instant Target CLI Parsing ---');
    expect(parseCliArgs(['http://localhost:5173'])).toEqual({
      command: 'check',
      target: 'http://localhost:5173',
      only: undefined,
      configPath: undefined,
      json: false,
      headless: true,
    });

    expect(parseCliArgs(['./dist/index.html', '--json'])).toEqual({
      command: 'check',
      target: './dist/index.html',
      only: undefined,
      configPath: undefined,
      json: true,
      headless: true,
    });

    expect(parseCliArgs(['contrast', './dist/index.html', '--headed'])).toEqual({
      command: 'check',
      target: './dist/index.html',
      only: 'contrast',
      configPath: undefined,
      json: false,
      headless: false,
    });

    expect(parseCliArgs(['check', 'https://example.com'])).toEqual({
      command: 'check',
      target: 'https://example.com',
      only: undefined,
      configPath: undefined,
      json: false,
      headless: true,
    });
  });

    it('returns command=unknown with descriptive reason on invalid commands or missing flag values', () => {
    console.log('\n--- START TEST: Invalid Command & Missing Flag Value Detection ---');
    const badCmd = parseCliArgs(['deploy']);
    expect(badCmd.command).toBe('unknown');

    const missingConfigVal = parseCliArgs(['check', '--config=']);
    expect(missingConfigVal.command).toBe('unknown');

    const badFlag = parseCliArgs(['check', '--bogus']);
    expect(badFlag.command).toBe('unknown');
  });

  it('writes help and version text to stdout and returns POSIX exit code 0', async () => {
    console.log('\n--- START TEST: Help & Version stdout Output ---');
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array): boolean => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    });

    const helpExit = await runCli(['--help']);
    expect(helpExit).toBe(0);
    expect(stdoutChunks.join('')).toContain('uirig <url-or-file> [options]');

    stdoutChunks.length = 0;
    const versionExit = await runCli(['--version']);
    expect(versionExit).toBe(0);
    expect(stdoutChunks.join('').trim()).toBe(UIRIG_VERSION);
  });

  it('dispatches init, manifest, check, and direct <url-or-file> handlers and propagates POSIX exit codes (0, 1, 2)', async () => {
    console.log('\n--- START TEST: Command Dispatching & Exit Code Propagation ---');
    const initSpy = vi.fn().mockResolvedValue(undefined);
    const manifestSpy = vi.fn().mockResolvedValue(undefined);
    const checkSpy = vi
      .fn()
      .mockResolvedValueOnce(createMockReport(0))
      .mockResolvedValueOnce(createMockReport(1))
      .mockResolvedValueOnce(createMockReport(2))
      .mockResolvedValueOnce(createMockReport(0));

    expect(await runCli(['init'], { init: initSpy })).toBe(0);
    expect(initSpy).toHaveBeenCalledTimes(1);

    expect(await runCli(['manifest'], { manifest: manifestSpy })).toBe(0);
    expect(manifestSpy).toHaveBeenCalledTimes(1);

    expect(await runCli(['check'], { check: checkSpy })).toBe(0);
    expect(
      await runCli(['check', '--config=custom.json', '--json', '--headed'], { check: checkSpy })
    ).toBe(1);
    expect(checkSpy).toHaveBeenLastCalledWith({
      target: undefined,
      configPath: 'custom.json',
      json: true,
      only: undefined,
      headless: false,
    });
    expect(await runCli(['check'], { check: checkSpy })).toBe(2);

    expect(await runCli(['./dist/index.html', '--json'], { check: checkSpy })).toBe(0);
    expect(checkSpy).toHaveBeenLastCalledWith({
      target: './dist/index.html',
      configPath: undefined,
      json: true,
      only: undefined,
      headless: true,
    });
  });

  it('returns POSIX exit code 1 and writes to stderr on unknown commands or thrown runtime errors', async () => {
    console.log('\n--- START TEST: Fatal Runtime Error & Unknown Command Exit Code 1 ---');
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const unknownExit = await runCli(['unknown-subcommand']);
    expect(unknownExit).toBe(1);
    expect(stderrSpy).toHaveBeenCalled();

    const failingCheck = vi.fn().mockRejectedValue(new Error('ERR_CONFIG_MISSING: Not found'));
    const crashExit = await runCli(['check'], { check: failingCheck });
    expect(crashExit).toBe(1);
  });

  it('executes compiled bin/uirig binary end-to-end for --version and --help', () => {
    console.log('\n--- START TEST: End-to-End Compiled bin/uirig Execution ---');
    const binPath = resolve(process.cwd(), 'bin/uirig');

    const versionOutput = execFileSync(process.execPath, [binPath, '--version'], {
      encoding: 'utf8',
    });
    expect(versionOutput.trim()).toBe(UIRIG_VERSION);

    const helpOutput = execFileSync(process.execPath, [binPath, '--help'], {
      encoding: 'utf8',
    });
    expect(helpOutput).toContain('uirig <url-or-file> [options]');
    expect(helpOutput).toContain('POSIX EXIT CODES:');
  });
  it('parses standalone tool subcommands (tokens, contrast, stress, cls) and --only=<tool>', () => {
    console.log('\n--- START TEST: Standalone Engine Subcommands & --only Flag ---');
    expect(parseCliArgs(['tokens', '--json'])).toEqual({
      command: 'check',
      target: undefined,
      only: 'tokens',
      configPath: undefined,
      json: true,
      headless: true,
    });

    expect(parseCliArgs(['contrast', '--config=custom.json'])).toEqual({
      command: 'check',
      target: undefined,
      only: 'contrast',
      configPath: 'custom.json',
      json: false,
      headless: true,
    });

    expect(parseCliArgs(['stress', '--headed'])).toEqual({
      command: 'check',
      target: undefined,
      only: 'stress',
      configPath: undefined,
      json: false,
      headless: false,
    });

    expect(parseCliArgs(['cls'])).toEqual({
      command: 'check',
      target: undefined,
      only: 'cls',
      configPath: undefined,
      json: false,
      headless: true,
    });

    expect(parseCliArgs(['check', '--only=contrast'])).toEqual({
      command: 'check',
      target: undefined,
      only: 'contrast',
      configPath: undefined,
      json: false,
      headless: true,
    });

    const invalidOnly = parseCliArgs(['check', '--only=unknown']);
    expect(invalidOnly.command).toBe('unknown');
  });

  it('dispatches standalone tool commands (e.g. uirig contrast --json) with only="contrast"', async () => {
    console.log('\n--- START TEST: Standalone Tool Execution Routing ---');
    const checkSpy = vi.fn().mockResolvedValue(createMockReport(0));

    const exitCode = await runCli(['contrast', '--json'], { check: checkSpy });
    expect(exitCode).toBe(0);
    expect(checkSpy).toHaveBeenCalledWith({
      target: undefined,
      configPath: undefined,
      only: 'contrast',
      json: true,
      headless: true,
    });
  });

  it('parses standalone dark-mode and dom subcommands and --only flags', () => {
    console.log('\n--- START TEST: Standalone dark-mode & dom Subcommand Parsing ---');
    expect(parseCliArgs(['dark-mode', './dist/index.html', '--json'])).toEqual({
      command: 'check',
      target: './dist/index.html',
      only: 'dark-mode',
      configPath: undefined,
      json: true,
      headless: true,
    });

    expect(parseCliArgs(['dom', './dist/index.html', '--json'])).toEqual({
      command: 'check',
      target: './dist/index.html',
      only: 'dom',
      configPath: undefined,
      json: true,
      headless: true,
    });
  });

  it('parses subcommand-specific --help and help <topic> across all 9 commands', () => {
    console.log('\n--- START TEST: Subcommand --help Topic Parsing & Rendering ---');
    const topics = [
      'init',
      'check',
      'tokens',
      'contrast',
      'dark-mode',
      'stress',
      'cls',
      'dom',
      'manifest',
    ] as const;

    for (const topic of topics) {
      expect(parseCliArgs([topic, '--help'])).toEqual({ command: 'help', topic });
      expect(parseCliArgs([topic, '-h'])).toEqual({ command: 'help', topic });
      expect(parseCliArgs(['help', topic])).toEqual({ command: 'help', topic });

      const rendered = renderHelpText(topic);
      expect(rendered).toContain(`uirig ${topic}`);
      expect(rendered).toContain('USAGE:');
      expect(rendered).toContain('HOW IT WORKS:');
      expect(rendered).toContain('POSIX EXIT CODES:');
      expect(rendered).toContain('EXAMPLES:');
    }

    expect(parseCliArgs(['./dist/index.html', '--help'])).toEqual({
      command: 'help',
      topic: undefined,
    });
  });

  it('writes subcommand-specific help to stdout without invoking command handlers', async () => {
    console.log('\n--- START TEST: Subcommand --help Execution Isolation ---');
    const stdoutChunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array): boolean => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    });

    const initSpy = vi.fn();
    const checkSpy = vi.fn();

    expect(await runCli(['init', '--help'], { init: initSpy })).toBe(0);
    expect(initSpy).not.toHaveBeenCalled();
    expect(stdoutChunks.join('')).toContain('uirig init');

    stdoutChunks.length = 0;
    expect(await runCli(['dark-mode', '--help'], { check: checkSpy })).toBe(0);
    expect(checkSpy).not.toHaveBeenCalled();
    expect(stdoutChunks.join('')).toContain('uirig dark-mode');
    expect(stdoutChunks.join('')).toContain('prefers-color-scheme: dark');
  });
});
