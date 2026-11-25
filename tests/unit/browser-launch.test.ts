/**
 * tests/unit/browser-launch.test.ts
 * Unit test suite for resilient Chromium launching and missing-binary recovery (`src/utils/browser-launch.ts`, Issue #59).
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Browser, LaunchOptions } from 'playwright';
import {
  isMissingBrowserExecutableError,
  launchUirigChromium,
  resolvePlaywrightCliPath,
} from '../../src/utils/browser-launch.js';

function createMissingExecutableError(): Error {
  return new Error(
    "browserType.launch: Executable doesn't exist at /Users/dev/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell\n" +
      'Please run the following command to download new browsers:\n' +
      '    npx playwright install'
  );
}

describe('launchUirigChromium (src/utils/browser-launch.ts)', () => {
  const originalExecEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  const originalSkipEnv = process.env.UIRIG_SKIP_BROWSER_INSTALL;

  afterEach(() => {
    if (originalExecEnv === undefined) {
      delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    } else {
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = originalExecEnv;
    }

    if (originalSkipEnv === undefined) {
      delete process.env.UIRIG_SKIP_BROWSER_INSTALL;
    } else {
      process.env.UIRIG_SKIP_BROWSER_INSTALL = originalSkipEnv;
    }
  });

  it('detects Playwright missing browser executable errors and resolves @rlevin/uirig playwright/cli.js', () => {
    expect(isMissingBrowserExecutableError(createMissingExecutableError())).toBe(true);
    expect(isMissingBrowserExecutableError(new Error('ECONNREFUSED'))).toBe(false);

    const cliPath = resolvePlaywrightCliPath();
    expect(cliPath).toMatch(/playwright(?:-core)?[/\\]cli\.js$/);
  });

  it('honors PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH when set', async () => {
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = '/usr/local/bin/custom-chromium';
    const mockBrowser = { isConnected: () => true } as unknown as Browser;
    const launcher = vi.fn(async (_opts?: LaunchOptions) => mockBrowser);
    const installer = vi.fn(async () => {});

    const browser = await launchUirigChromium({
      headless: true,
      launcher,
      installer,
    });

    expect(browser).toBe(mockBrowser);
    expect(launcher).toHaveBeenCalledWith({
      headless: true,
      executablePath: '/usr/local/bin/custom-chromium',
    });
    expect(installer).not.toHaveBeenCalled();
  });

  it('auto-installs bundled Chromium and retries launch when Executable does not exist', async () => {
    const mockBrowser = { isConnected: () => true } as unknown as Browser;
    let attempt = 0;
    const launcher = vi.fn(async (_opts?: LaunchOptions) => {
      attempt += 1;
      if (attempt === 1) {
        throw createMissingExecutableError();
      }
      return mockBrowser;
    });
    const installer = vi.fn(async () => {});

    const browser = await launchUirigChromium({
      headless: true,
      launcher,
      installer,
    });

    expect(browser).toBe(mockBrowser);
    expect(installer).toHaveBeenCalledTimes(1);
    expect(launcher).toHaveBeenCalledTimes(2);
  });

  it('falls back to system Chrome channel when auto-install fails or is skipped', async () => {
    const mockChromeBrowser = { isConnected: () => true } as unknown as Browser;
    const launcher = vi.fn(async (opts?: LaunchOptions) => {
      if (opts?.channel === 'chrome') {
        return mockChromeBrowser;
      }
      throw createMissingExecutableError();
    });
    const installer = vi.fn(async () => {
      throw new Error('offline');
    });

    const browser = await launchUirigChromium({
      headless: true,
      launcher,
      installer,
    });

    expect(browser).toBe(mockChromeBrowser);
    expect(installer).toHaveBeenCalledTimes(1);
    expect(launcher).toHaveBeenLastCalledWith({
      headless: true,
      channel: 'chrome',
    });
  });

  it('throws actionable ERR_CHROMIUM_MISSING with npx @rlevin/uirig install (never bare npx playwright install) when all recovery options fail', async () => {
    const launcher = vi.fn(async () => {
      throw createMissingExecutableError();
    });
    const installer = vi.fn(async () => {
      throw new Error('network unreachable');
    });

    await expect(
      launchUirigChromium({
        headless: true,
        launcher,
        installer,
      })
    ).rejects.toThrow(/ERR_CHROMIUM_MISSING.*npx @rlevin\/uirig install/);
  });
});
