/**
 * tests/unit/mcp.test.ts
 * End-to-end MCP protocol test suite (`src/commands/mcp.ts`) using the official
 * `@modelcontextprotocol/sdk` Client over `StdioClientTransport` and `InMemoryTransport`.
 * Covers tool discovery, pure stdio framing, warm browser reuse, and crash recovery.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createUirigMcpServer } from '../../src/commands/mcp.js';
import { WarmBrowserPool } from '../../src/core/browser-pool.js';

describe('uirig mcp — Native MCP Server Mode (src/commands/mcp.ts)', () => {
  let tempDir: string;
  let client: Client | null = null;
  let transport: StdioClientTransport | null = null;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'uirig-mcp-test-'));
  });

  afterEach(async () => {
    if (client) {
      await client.close().catch(() => {});
      client = null;
    }
    if (transport) {
      await transport.close().catch(() => {});
      transport = null;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function connectMcpClient(): Promise<Client> {
    const binPath = resolve(process.cwd(), 'bin/uirig');
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [binPath, 'mcp', '--idle-timeout=30000'],
      cwd: tempDir,
      stderr: 'pipe',
    });

    client = new Client(
      { name: 'uirig-vitest-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    return client;
  }

  it('starts over stdio with zero stdout pollution and lists all 10 uirig verification & A2UI tools', async () => {
    const mcpClient = await connectMcpClient();
    const { tools } = await mcpClient.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual([
      'uirig_a2ui_delta',
      'uirig_check',
      'uirig_cls',
      'uirig_contrast',
      'uirig_dark_mode',
      'uirig_discover_tokens',
      'uirig_dom',
      'uirig_stress',
      'uirig_sweep',
      'uirig_tokens',
    ]);
  });


  it('reuses a warm Chromium instance across sequential MCP tool calls and returns agentic JSON', async () => {
    const htmlPath = join(tempDir, 'component.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            :root { --bg: #ffffff; --fg: #111827; }
            :root[data-theme="dark"] { --bg: #0f172a; --fg: #f8fafc; }
            body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font-family: sans-serif; }
            .bad-contrast { color: rgb(185, 185, 185); }
          </style>
        </head>
        <body>
          <section id="card">
            <p class="bad-contrast">Low contrast text inside card</p>
          </section>
        </body>
      </html>`,
      'utf8'
    );

    const mcpClient = await connectMcpClient();

    // Call 1: Warms up Chromium and detects contrast failure
    const firstRes = await mcpClient.callTool({
      name: 'uirig_contrast',
      arguments: {
        target: './component.html',
        selectors: ['#card'],
        viewport: { name: 'desktop', width: 1280, height: 800 },
        cwd: tempDir,
      },
    });

    const firstContent = Array.isArray(firstRes.content) ? firstRes.content[0] : undefined;
    const firstText = firstContent?.type === 'text' ? firstContent.text : '';
    const firstPayload = JSON.parse(firstText) as {
      tool: string;
      passed: boolean;
      exitCode: number;
      violations: Array<{ engine: string }>;
    };

    expect(firstPayload.tool).toBe('uirig');
    expect(firstPayload.passed).toBe(false);
    expect(firstPayload.exitCode).toBe(1);
    expect(firstPayload.violations[0]?.engine).toBe('contrast');

    // Call 2: Reuses the warm Chromium instance (no cold browser startup)
    const warmStart = performance.now();
    const secondRes = await mcpClient.callTool({
      name: 'uirig_dom',
      arguments: {
        target: './component.html',
        selectors: ['#card'],
        viewport: { name: 'desktop', width: 1280, height: 800 },
        cwd: tempDir,
      },
    });
    const warmElapsedMs = performance.now() - warmStart;

    const secondContent = Array.isArray(secondRes.content) ? secondRes.content[0] : undefined;
    const secondText = secondContent?.type === 'text' ? secondContent.text : '';
    const secondPayload = JSON.parse(secondText) as {
      tool: string;
      passed: boolean;
      exitCode: number;
    };

    expect(secondPayload.passed).toBe(true);
    expect(secondPayload.exitCode).toBe(0);
    // Warm check avoids Chromium binary cold-start (generous 1500ms ceiling for Intel hardware)
    expect(warmElapsedMs).toBeLessThan(1500);
  });

  it('recovers gracefully when the underlying Chromium process crashes between MCP tool invocations', async () => {
    const htmlPath = join(tempDir, 'recovery.html');
    writeFileSync(
      htmlPath,
      `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 16px; background: #ffffff; color: #111827; font-family: sans-serif; }
          </style>
        </head>
        <body><h1>Self-Healing MCP Pool</h1></body>
      </html>`,
      'utf8'
    );

    const pool = new WarmBrowserPool({ headless: true, idleTimeoutMs: 60_000 });
    const mcpServer = createUirigMcpServer(pool, '0.2.4');
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const inMemoryClient = new Client(
      { name: 'uirig-crash-test-client', version: '1.0.0' },
      { capabilities: {} }
    );

    try {
      await Promise.all([
        mcpServer.connect(serverTransport),
        inMemoryClient.connect(clientTransport),
      ]);

      // 1. First invocation warms Chromium
      const res1 = await inMemoryClient.callTool({
        name: 'uirig_contrast',
        arguments: {
          target: './recovery.html',
          viewport: { name: 'desktop', width: 1280, height: 800 },
          cwd: tempDir,
        },
      });
      const text1 = Array.isArray(res1.content) && res1.content[0]?.type === 'text' ? res1.content[0].text : '';
      expect((JSON.parse(text1) as { passed: boolean }).passed).toBe(true);
      expect(pool.isHealthy()).toBe(true);

      // 2. Simulate unexpected Chromium crash
      const activeBrowser = await pool.acquire();
      await activeBrowser.close();
      expect(pool.isHealthy()).toBe(false);

      // 3. Next MCP invocation transparently relaunches Chromium and passes
      const res2 = await inMemoryClient.callTool({
        name: 'uirig_dom',
        arguments: {
          target: './recovery.html',
          viewport: { name: 'desktop', width: 1280, height: 800 },
          cwd: tempDir,
        },
      });
      const text2 = Array.isArray(res2.content) && res2.content[0]?.type === 'text' ? res2.content[0].text : '';
      expect((JSON.parse(text2) as { passed: boolean }).passed).toBe(true);
      expect(pool.isHealthy()).toBe(true);
    } finally {
      await inMemoryClient.close().catch(() => {});
      await mcpServer.close().catch(() => {});
      await pool.dispose();
    }
  });
});
