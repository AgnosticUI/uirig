/**
 * tests/unit/cli-auto-tokens.test.ts
 * Unit specs for `--auto-tokens` and `--tokens-path` / `--token-path` CLI argument parsing and forwarding.
 */

import { describe, it, expect, vi } from 'vitest';
import { parseCliArgs, runCli } from '../../src/index.js';

describe('::: ISSUE #10 (CHUNK 4A): CLI --auto-tokens & --tokens-path PARSER :::', () => {
  it('parses --auto-tokens on check, standalone engines, and direct targets', () => {
    const checkParsed = parseCliArgs(['check', '--auto-tokens']);
    expect(checkParsed).toMatchObject({ command: 'check', autoTokens: true });

    const directParsed = parseCliArgs(['./dist/index.html', '--auto-tokens', '--json']);
    expect(directParsed).toMatchObject({
      command: 'check',
      target: './dist/index.html',
      autoTokens: true,
      json: true,
    });

    const tokensParsed = parseCliArgs(['tokens', 'http://localhost:5173', '--auto-tokens']);
    expect(tokensParsed).toMatchObject({
      command: 'check',
      only: 'tokens',
      target: 'http://localhost:5173',
      autoTokens: true,
    });
  });

  it('forwards autoTokens: true into executeCheckCommand via runCli', async () => {
    const mockCheck = vi.fn().mockResolvedValue({
      timestamp: new Date().toISOString(),
      configPath: 'zero-config (built-in defaults)',
      reportPath: '.uirig/github_pr_comment.md',
      exitCode: 0,
      results: [],
      summary: {
        totalViewportsAudited: 0,
        totalTokenViolations: 0,
        totalContrastViolations: 0,
        totalStressViolations: 0,
        totalClsViolations: 0,
      },
    });

    const exitCode = await runCli(['./index.html', '--auto-tokens', '--json'], {
      check: mockCheck,
    });

    expect(exitCode).toBe(0);
    expect(mockCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        target: './index.html',
        autoTokens: true,
        json: true,
      })
    );
  });

  it('parses --tokens-path and --token-path flags (both = and space-separated) and rejects empty values', () => {
    expect(
      parseCliArgs(['check', 'http://localhost:5173', '--tokens-path=./design.tokens.json'])
    ).toMatchObject({
      command: 'check',
      target: 'http://localhost:5173',
      tokensPath: './design.tokens.json',
    });

    expect(parseCliArgs(['tokens', './index.html', '--token-path', './tokens.css'])).toMatchObject({
      command: 'check',
      target: './index.html',
      only: 'tokens',
      tokensPath: './tokens.css',
    });

    expect(parseCliArgs(['check', '--tokens-path='])).toMatchObject({
      command: 'unknown',
      reason: 'Missing file path after --tokens-path=',
    });
  });

  it('forwards tokensPath into executeCheckCommand via runCli', async () => {
    const mockCheck = vi.fn().mockResolvedValue({
      timestamp: new Date().toISOString(),
      configPath: 'zero-config (built-in defaults)',
      reportPath: '.uirig/github_pr_comment.md',
      exitCode: 0,
      results: [],
      summary: {
        totalViewportsAudited: 0,
        totalTokenViolations: 0,
        totalContrastViolations: 0,
        totalStressViolations: 0,
        totalClsViolations: 0,
      },
    });

    const exitCode = await runCli(
      ['check', 'http://localhost:5173', '--tokens-path=./tokens.css', '--json'],
      { check: mockCheck }
    );

    expect(exitCode).toBe(0);
    expect(mockCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'http://localhost:5173',
        tokensPath: './tokens.css',
        json: true,
      })
    );
  });

  it('parses comma-separated and repeatable --tokens-path / --token-path flags into deduplicated string[]', () => {
    expect(
      parseCliArgs([
        'check',
        'http://localhost:5173',
        '--tokens-path=src/styles/ag-tokens.css,src/styles/ag-tokens-dark.css',
        '--themes=light,dark',
      ])
    ).toMatchObject({
      command: 'check',
      target: 'http://localhost:5173',
      tokensPath: ['src/styles/ag-tokens.css', 'src/styles/ag-tokens-dark.css'],
      themes: ['light', 'dark'],
    });

    expect(
      parseCliArgs([
        'tokens',
        './index.html',
        '--tokens-path',
        './ag-tokens.css',
        '--token-path',
        './ag-tokens-dark.css',
        '--tokens-path=./ag-tokens.css',
      ])
    ).toMatchObject({
      command: 'check',
      target: './index.html',
      only: 'tokens',
      tokensPath: ['./ag-tokens.css', './ag-tokens-dark.css'],
    });
  });

  it('forwards multi-file tokensPath array into executeCheckCommand via runCli', async () => {
    const mockCheck = vi.fn().mockResolvedValue({
      timestamp: new Date().toISOString(),
      configPath: 'zero-config (built-in defaults)',
      reportPath: '.uirig/github_pr_comment.md',
      exitCode: 0,
      results: [],
      summary: {
        totalViewportsAudited: 0,
        totalTokenViolations: 0,
        totalContrastViolations: 0,
        totalStressViolations: 0,
        totalClsViolations: 0,
      },
    });

    const exitCode = await runCli(
      [
        'check',
        'http://localhost:5173',
        '--tokens-path=src/styles/ag-tokens.css,src/styles/ag-tokens-dark.css',
        '--themes=light,dark',
        '--json',
      ],
      { check: mockCheck }
    );

    expect(exitCode).toBe(0);
    expect(mockCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'http://localhost:5173',
        tokensPath: ['src/styles/ag-tokens.css', 'src/styles/ag-tokens-dark.css'],
        themes: ['light', 'dark'],
        json: true,
      })
    );
  });

});
