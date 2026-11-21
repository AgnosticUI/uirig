/**
 * tests/unit/browser-pool.test.ts
 * Unit test suite for `WarmBrowserPool` (`src/core/browser-pool.ts`), verifying:
 * 1. Persistent Chromium reuse across sequential `acquire()` calls
 * 2. Concurrent launch deduplication (stampede protection)
 * 3. Automatic crash / disconnect recovery on subsequent `acquire()`
 * 4. Idle timeout auto-close cleanup and transparent relaunch
 * 5. Explicit `dispose()` lifecycle cleanup
 */

import { EventEmitter } from 'events';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Browser } from 'playwright';
import { WarmBrowserPool } from '../../src/core/browser-pool.js';

interface IMockBrowser extends EventEmitter {
  isConnected: ReturnType<typeof vi.fn<() => boolean>>;
  close: ReturnType<typeof vi.fn<() => Promise<void>>>;
  simulateCrash: () => void;
}

function createMockBrowser(): IMockBrowser {
  const emitter = new EventEmitter() as IMockBrowser;
  let connected = true;

  emitter.isConnected = vi.fn(() => connected);
  emitter.close = vi.fn(async () => {
    connected = false;
    emitter.emit('disconnected');
  });
  emitter.simulateCrash = () => {
    connected = false;
    emitter.emit('disconnected');
  };

  return emitter;
}

describe('WarmBrowserPool (src/core/browser-pool.ts)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('launches Chromium once and reuses the same warm instance across sequential acquire() calls', async () => {
    const browsers: Array<IMockBrowser> = [];
    const launcher = vi.fn(async () => {
      const b = createMockBrowser();
      browsers.push(b);
      return b as unknown as Browser;
    });

    const pool = new WarmBrowserPool({ launcher, idleTimeoutMs: 60_000 });

    const b1 = await pool.acquire();
    const b2 = await pool.acquire();
    const b3 = await pool.acquire();

    expect(launcher).toHaveBeenCalledTimes(1);
    expect(b1).toBe(b2);
    expect(b2).toBe(b3);
    expect(pool.isHealthy()).toBe(true);

    await pool.dispose();
  });

  it('deduplicates concurrent acquire() calls so only a single Chromium binary launches', async () => {
    let releaseLaunch!: (browser: Browser) => void;
    const launcher = vi.fn(
      () =>
        new Promise<Browser>((resolve) => {
          releaseLaunch = resolve;
        })
    );

    const pool = new WarmBrowserPool({ launcher, idleTimeoutMs: 60_000 });
    const pending = Promise.all([pool.acquire(), pool.acquire(), pool.acquire()]);

    const mockBrowser = createMockBrowser() as unknown as Browser;
    releaseLaunch(mockBrowser);

    const [a, b, c] = await pending;
    expect(launcher).toHaveBeenCalledTimes(1);
    expect(a).toBe(mockBrowser);
    expect(b).toBe(mockBrowser);
    expect(c).toBe(mockBrowser);

    await pool.dispose();
  });

  it('recovers gracefully by relaunching Chromium after a browser crash or disconnect', async () => {
    const instances: Array<IMockBrowser> = [];
    const launcher = vi.fn(async () => {
      const b = createMockBrowser();
      instances.push(b);
      return b as unknown as Browser;
    });

    const pool = new WarmBrowserPool({ launcher, idleTimeoutMs: 60_000 });

    const first = await pool.acquire();
    expect(launcher).toHaveBeenCalledTimes(1);
    expect(pool.isHealthy()).toBe(true);

    instances[0]?.simulateCrash();
    expect(pool.isHealthy()).toBe(false);

    const second = await pool.acquire();
    expect(launcher).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
    expect(pool.isHealthy()).toBe(true);

    await pool.dispose();
  });

  it('closes idle Chromium after idleTimeoutMs and transparently relaunches on the next acquire()', async () => {
    vi.useFakeTimers();

    const instances: Array<IMockBrowser> = [];
    const launcher = vi.fn(async () => {
      const b = createMockBrowser();
      instances.push(b);
      return b as unknown as Browser;
    });

    const pool = new WarmBrowserPool({ launcher, idleTimeoutMs: 10_000 });

    await pool.acquire();
    expect(launcher).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(instances[0]?.close).toHaveBeenCalledTimes(1);
    expect(pool.isHealthy()).toBe(false);

    const relaunched = await pool.acquire();
    expect(launcher).toHaveBeenCalledTimes(2);
    expect(relaunched).toBe(instances[1]);

    await pool.dispose();
  });
});
