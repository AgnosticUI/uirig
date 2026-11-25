/**
 * src/utils/browser-launch.ts
 * Resilient Chromium launcher and package-scoped browser installer (`uirig install`).
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chromium, type Browser, type LaunchOptions } from 'playwright';
import { logTelemetry, paint } from './formatter.js';

export type ChromiumLaunchFn = (options?: LaunchOptions) => Promise<Browser>;
export type ChromiumInstallFn = () => Promise<void>;

export interface IUirigChromiumLaunchOptions {
  headless?: boolean;
  executablePath?: string;
  autoInstall?: boolean;
  launcher?: ChromiumLaunchFn;
  installer?: ChromiumInstallFn;
}

export function isMissingBrowserExecutableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /Executable doesn't exist/i.test(message) ||
    /Please run the following command to download new browsers/i.test(message)
  );
}

export function resolvePlaywrightCliPath(): string {
  const req = createRequire(import.meta.url);
  for (const pkgName of ['playwright', 'playwright-core'] as const) {
    try {
      const pkgDir = dirname(req.resolve(`${pkgName}/package.json`));
      const cliCandidate = join(pkgDir, 'cli.js');
      if (existsSync(cliCandidate)) {
        return cliCandidate;
      }
    } catch {
      // Try next candidate
    }
  }
  throw new Error('ERR_PLAYWRIGHT_CLI_NOT_FOUND: Unable to locate playwright/cli.js.');
}

export async function installBundledChromium(
  cliPath: string = resolvePlaywrightCliPath()
): Promise<void> {
  logTelemetry(
    'browser:install',
    `Installing Chromium matching @rlevin/uirig's Playwright runtime via ${paint(cliPath, 'cyan')}...`
  );

  const result = spawnSync(process.execPath, [cliPath, 'install', 'chromium'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.stdout && result.stdout.trim().length > 0) {
    process.stderr.write(result.stdout.trimEnd() + '\n');
  }
  if (result.stderr && result.stderr.trim().length > 0) {
    process.stderr.write(result.stderr.trimEnd() + '\n');
  }

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(
      `ERR_CHROMIUM_INSTALL_FAILED: Failed to install Chromium (exit=${String(result.status)}). ${detail}`.trim()
    );
  }

  logTelemetry('browser:install', paint('Chromium installation complete.', 'green'));
}
export async function launchUirigChromium(
  options: IUirigChromiumLaunchOptions = {}
): Promise<Browser> {
  const headless = options.headless ?? true;
  const launcher: ChromiumLaunchFn =
    options.launcher ?? ((launchOpts) => chromium.launch(launchOpts));
  const installer: ChromiumInstallFn =
    options.installer ?? (() => installBundledChromium());

  const envExecPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
  const resolvedExecutablePath =
    options.executablePath && options.executablePath.trim().length > 0
      ? options.executablePath.trim()
      : envExecPath && envExecPath.length > 0
        ? envExecPath
        : undefined;

  const baseLaunchOptions: LaunchOptions = {
    headless,
    ...(resolvedExecutablePath ? { executablePath: resolvedExecutablePath } : {}),
  };

  try {
    return await launcher(baseLaunchOptions);
  } catch (initialError: unknown) {
    if (!isMissingBrowserExecutableError(initialError)) {
      throw initialError;
    }

    if (resolvedExecutablePath) {
      throw new Error(
        `ERR_CHROMIUM_MISSING: Configured Chromium executable not found at '${resolvedExecutablePath}'. ` +
          `Verify PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH or unset it and run 'npx @rlevin/uirig install'.`
      );
    }

    const isTestEnv =
      Boolean(process.env.VITEST) &&
      options.autoInstall !== true &&
      options.installer === undefined;
    const skipAutoInstall =
      options.autoInstall === false ||
      process.env.UIRIG_SKIP_BROWSER_INSTALL === '1' ||
      isTestEnv;

    if (!skipAutoInstall) {
      logTelemetry(
        'browser:recover',
        paint(
          'Bundled Chromium binary missing; auto-installing matching Chromium for @rlevin/uirig...',
          'yellow'
        )
      );
      try {
        await installer();
        return await launcher({ headless });
      } catch (installOrRetryError: unknown) {
        const reason =
          installOrRetryError instanceof Error
            ? installOrRetryError.message
            : String(installOrRetryError);
        logTelemetry(
          'browser:recover',
          `Auto-install retry did not succeed (${reason}); attempting system Chrome fallback...`
        );
      }
    }

    try {
      const chromeBrowser = await launcher({ headless, channel: 'chrome' });
      logTelemetry(
        'browser:recover',
        paint('Launched system Google Chrome fallback (channel: chrome).', 'cyan')
      );
      return chromeBrowser;
    } catch {
      throw new Error(
        'ERR_CHROMIUM_MISSING: Chromium browser binary for @rlevin/uirig is not installed. ' +
          "Run 'npx @rlevin/uirig install' (or 'npx uirig install') to download the matching Chromium binary, " +
          'or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to a local Chrome/Chromium executable.'
      );
    }
  }
}
