/**
 * src/core/browser-pool.ts
 * Persistent warm Chromium lifecycle manager for `uirig mcp`.
 * Keeps a single headless Chromium browser alive across verification runs while
 * providing stampede deduplication, automatic crash recovery, and idle-timeout cleanup.
 */

import { chromium, type Browser } from 'playwright';
import { logTelemetry } from '../utils/formatter.js';

export type BrowserLauncher = () => Promise<Browser>;

export interface IWarmBrowserPoolOptions {
  /** Idle inactivity duration in milliseconds before closing Chromium (default: 300,000ms / 5m). */
  idleTimeoutMs?: number;
  /** Whether to launch Chromium in headless mode (default: true). */
  headless?: boolean;
  /** Optional custom browser launcher for unit tests or custom launch flags. */
  launcher?: BrowserLauncher;
}

export const DEFAULT_BROWSER_IDLE_TIMEOUT_MS = 300_000;

export class WarmBrowserPool {
  private browser: Browser | null = null;
  private launchPromise: Promise<Browser> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private readonly idleTimeoutMs: number;
  private readonly launcher: BrowserLauncher;

  constructor(options: IWarmBrowserPoolOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_BROWSER_IDLE_TIMEOUT_MS;
    const headless = options.headless ?? true;
    this.launcher =
      options.launcher ??
      (() => chromium.launch({ headless }));
  }

  /**
   * Returns true when a live, connected Chromium instance is currently warm.
   */
  public isHealthy(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }

  /**
   * Acquires the warm Chromium instance, launching or recovering it if needed.
   * Concurrent calls share a single in-flight launch promise.
   */
  public async acquire(): Promise<Browser> {
    if (this.disposed) {
      throw new Error('ERR_BROWSER_POOL_DISPOSED: Cannot acquire browser from a disposed pool.');
    }

    if (this.isHealthy() && this.browser !== null) {
      this.resetIdleTimer();
      return this.browser;
    }

    // Evict stale/crashed reference before relaunching
    this.browser = null;

    if (!this.launchPromise) {
      this.launchPromise = this.launchFreshBrowser();
    }

    try {
      const instance = await this.launchPromise;
      this.resetIdleTimer();
      return instance;
    } finally {
      this.launchPromise = null;
    }
  }

  private async launchFreshBrowser(): Promise<Browser> {
    logTelemetry('mcp:browser', 'Launching warm Chromium instance...');
    const instance = await this.launcher();

    if (this.disposed) {
      await instance.close().catch(() => {});
      throw new Error('ERR_BROWSER_POOL_DISPOSED: Pool disposed during Chromium startup.');
    }

    instance.on('disconnected', () => {
      if (this.browser === instance) {
        logTelemetry('mcp:browser', 'Chromium disconnected; will auto-recover on next call.');
        this.browser = null;
        this.clearIdleTimer();
      }
    });

    this.browser = instance;
    return instance;
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    if (this.idleTimeoutMs <= 0 || this.disposed) {
      return;
    }

    this.idleTimer = setTimeout(() => {
      void this.closeIdleBrowser();
    }, this.idleTimeoutMs);

    if (typeof this.idleTimer.unref === 'function') {
      this.idleTimer.unref();
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private async closeIdleBrowser(): Promise<void> {
    const current = this.browser;
    this.browser = null;
    this.clearIdleTimer();

    if (current && current.isConnected()) {
      logTelemetry('mcp:browser', 'Closing idle Chromium instance after inactivity timeout.');
      await current.close().catch(() => {});
    }
  }

  /**
   * Explicitly closes any active Chromium instance and prevents further launches.
   */
  public async dispose(): Promise<void> {
    this.disposed = true;
    this.clearIdleTimer();

    const current = this.browser;
    this.browser = null;

    if (current) {
      await current.close().catch(() => {});
    }
  }
}
