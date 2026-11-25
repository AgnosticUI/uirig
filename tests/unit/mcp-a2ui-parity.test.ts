/**
 * tests/unit/mcp-a2ui-parity.test.ts
 * MCP server parity specs for Issue #37:
 * - `themes` & `fix` forwarding + `sourceFile`/`lineNumber`/`unifiedDiff` in MCP tool responses
 * - `uirig_a2ui_delta` & `uirig_discover_tokens` native MCP tools
 */

import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { WarmBrowserPool } from '../../src/core/browser-pool.js';
import { createUirigMcpServer } from '../../src/commands/mcp.js';

describe('::: ISSUE #37: MCP SERVER PARITY (THEMES, SOURCE-MAP, --FIX & A2UI TOOLS) :::', () => {
  const pool = new WarmBrowserPool({ headless: true, idleTimeoutMs: 30_000 });

  afterAll(async () => {
    await pool.dispose();
  });

  it('==> Should expose uirig_a2ui_delta and uirig_discover_tokens alongside the 7 audit tools', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-mcp-parity-tools-'));
    try {
      writeFileSync(
        join(tempDir, 'design.tokens.json'),
        JSON.stringify({
          color: { primary: { $type: 'color', $value: '#0f172a' } },
          spacing: { md: { $type: 'dimension', $value: '16px' } },
        }),
        'utf8'
      );

      const server = createUirigMcpServer(pool, '0.2.4');
      const client = new Client({ name: 'test-client', version: '1.0.0' });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

      const listed = await client.listTools();
      const toolNames = listed.tools.map((t) => t.name);
      expect(toolNames).toContain('uirig_a2ui_delta');
      expect(toolNames).toContain('uirig_discover_tokens');

      // 1. Test `uirig_discover_tokens`
      const tokensRes = await client.callTool({
        name: 'uirig_discover_tokens',
        arguments: { cwd: tempDir },
      });
      const tokensText = (tokensRes.content as Array<{ type: string; text: string }>).at(0)?.text ?? '{}';
      const discovered = JSON.parse(tokensText) as { colors: Array<string>; spacing: Array<string> };
      expect(discovered.colors).toContain('rgb(15, 23, 42)');
      expect(discovered.spacing).toContain('16px');

      // 2. Test `uirig_a2ui_delta`
      const deltaRes = await client.callTool({
        name: 'uirig_a2ui_delta',
        arguments: {
          surfaceId: 'support-ticket',
          violations: [
            {
              engine: 'dom',
              violationType: 'unlabeled_control',
              a2ui: {
                surfaceId: 'support-ticket',
                a2uiComponentId: 'close_drawer_btn',
                a2uiComponentType: 'IconButton',
              },
            },
          ],
        },
      });
      const deltaText = (deltaRes.content as Array<{ type: string; text: string }>).at(0)?.text ?? '{}';
      expect(JSON.parse(deltaText)).toEqual({
        updateComponents: {
          surfaceId: 'support-ticket',
          components: [{ id: 'close_drawer_btn', ariaLabel: 'Close Drawer Btn' }],
        },
      });

      await client.close();
      await server.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('==> Should support themes, sourceFile:lineNumber, unifiedDiff, and fix in uirig_dom / uirig_check MCP calls', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-mcp-parity-fix-'));
    try {
      const htmlPath = join(tempDir, 'surface.html');
      writeFileSync(
        htmlPath,
        [
          '<!DOCTYPE html>',
          '<html>',
          '  <body>',
          '    <a id="unsafe-link" data-source-loc="surface.html:4:5" href="javascript:void(0)">Reset</a>',
          '  </body>',
          '</html>',
        ].join('\n'),
        'utf8'
      );

      const server = createUirigMcpServer(pool, '0.2.4');
      const client = new Client({ name: 'test-client', version: '1.0.0' });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

      // 1. Read-only MCP call with `themes` -> returns `sourceFile`, `lineNumber`, and `unifiedDiff`
      const dryRes = await client.callTool({
        name: 'uirig_dom',
        arguments: {
          target: './surface.html',
          cwd: tempDir,
          themes: ['light', 'dark'],
          viewport: { name: 'desktop', width: 1280, height: 800 },
        },
      });
      expect(dryRes.isError).toBe(true);
      const dryText = (dryRes.content as Array<{ type: string; text: string }>).at(0)?.text ?? '{}';
      const dryPayload = JSON.parse(dryText) as {
        violations: Array<{
          viewport: string;
          sourceFile: string | null;
          lineNumber: number | null;
          unifiedDiff: string | null;
        }>;
      };
      expect(dryPayload.violations.some((v) => v.viewport.includes('[theme: dark]'))).toBe(true);
      expect(dryPayload.violations.at(0)?.sourceFile).toBe('surface.html');
      expect(dryPayload.violations.at(0)?.lineNumber).toBe(4);
      expect(dryPayload.violations.at(0)?.unifiedDiff).toContain('+    <a id="unsafe-link" data-source-loc="surface.html:4:5" href="#">Reset</a>');

      // 2. MCP call with `fix: true` -> patches `surface.html` and passes (`isError: false`)
      const fixRes = await client.callTool({
        name: 'uirig_dom',
        arguments: {
          target: './surface.html',
          cwd: tempDir,
          fix: true,
          viewport: { name: 'desktop', width: 1280, height: 800 },
        },
      });
      expect(fixRes.isError).toBe(false);
      expect(readFileSync(htmlPath, 'utf8')).toContain('href="#"');

      await client.close();
      await server.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
  it('==> Should accept tokensPath array in uirig_tokens MCP calls for split light + dark CSS stylesheets', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-mcp-multitokens-'));
    try {
      writeFileSync(
        join(tempDir, 'ag-tokens.css'),
        ':where(html) { --ag-bg: #ffffff; --ag-fg: #0f172a; --ag-space: 16px; --ag-font: 16px; --ag-radius: 0px; }',
        'utf8'
      );
      writeFileSync(
        join(tempDir, 'ag-tokens-dark.css'),
        '[data-theme="dark"] { --ag-bg: #010409; --ag-fg: #f0f6fc; }',
        'utf8'
      );
      writeFileSync(
        join(tempDir, 'split.html'),
        `<!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="./ag-tokens.css" />
            <link rel="stylesheet" href="./ag-tokens-dark.css" />
            <style>
              body { margin: 0; padding: 16px; background: var(--ag-bg); color: var(--ag-fg); font-size: 16px; border-radius: 0px; }
              p { margin: 0; font-size: 16px; }
            </style>
          </head>
          <body><p>MCP multi-token CSS check</p></body>
        </html>`,
        'utf8'
      );

      const server = createUirigMcpServer(pool, '0.3.0');
      const client = new Client({ name: 'test-client', version: '1.0.0' });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

      const res = await client.callTool({
        name: 'uirig_tokens',
        arguments: {
          target: './split.html',
          cwd: tempDir,
          tokensPath: ['./ag-tokens.css', './ag-tokens-dark.css'],
          themes: ['light', 'dark'],
          viewport: { name: 'desktop', width: 1280, height: 800 },
        },
      });

      expect(res.isError).toBe(false);
      const text = (res.content as Array<{ type: string; text: string }>).at(0)?.text ?? '{}';
      const payload = JSON.parse(text) as { passed: boolean; exitCode: number };
      expect(payload.passed).toBe(true);
      expect(payload.exitCode).toBe(0);

      await client.close();
      await server.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('==> Should expose uirig_sweep and report failedWidths via MCP tool calls (Issue #18)', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-mcp-sweep-'));
    try {
      writeFileSync(
        join(tempDir, 'sweep.html'),
        `<!DOCTYPE html>
        <html>
          <head>
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; padding: 16px; font-family: sans-serif; }
              .tablet-overflow { display: none; width: 820px; height: 48px; background: #1e293b; color: #fff; }
              @media (min-width: 720px) {
                .tablet-overflow { display: block; }
              }
            </style>
          </head>
          <body><div class="tablet-overflow">Breaks in 720px-800px</div></body>
        </html>`,
        'utf8'
      );

      const server = createUirigMcpServer(pool, '0.3.1');
      const client = new Client({ name: 'test-client', version: '1.0.0' });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

      const listed = await client.listTools();
      expect(listed.tools.some((t) => t.name === 'uirig_sweep')).toBe(true);

      const res = await client.callTool({
        name: 'uirig_sweep',
        arguments: {
          target: './sweep.html',
          cwd: tempDir,
          sweep: '320:1440:40',
        },
      });

      expect(res.isError).toBe(true);
      const text = (res.content as Array<{ type: string; text: string }>).at(0)?.text ?? '{}';
      const payload = JSON.parse(text) as {
        exitCode: number;
        violations: Array<{ engine: string; failedWidths?: string }>;
      };
      expect(payload.exitCode).toBe(2);
      expect(payload.violations.at(0)?.engine).toBe('sweep');
      expect(payload.violations.at(0)?.failedWidths).toBe('720px-800px');

      await client.close();
      await server.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('==> Should support scope and exclude arrays in MCP audit tool calls (Issue #58)', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-mcp-scope-exclude-'));
    try {
      writeFileSync(
        join(tempDir, 'scoped-stage.html'),
        `<!DOCTYPE html>
        <html>
          <head>
            <style>
              :root { --bg: #ffffff; --fg: #111827; }
              :root[data-theme="dark"] { --bg: #0f172a; --fg: #f8fafc; }
              body { margin: 0; padding: 16px; background: var(--bg); color: var(--fg); font-family: sans-serif; }
              .host-shell { width: 1600px; color: rgb(210, 210, 210); }
              #uirig-stage h3.demo-title { color: rgb(210, 210, 210); }
              #uirig-stage p.clean-copy { margin: 0; font-size: 16px; }
            </style>
          </head>
          <body>
            <header class="host-shell">Host scrollbar & contrast outside #uirig-stage</header>
            <section id="uirig-stage">
              <h3 class="demo-title">Excluded demo heading</h3>
              <p class="clean-copy">Audited stage copy</p>
            </section>
          </body>
        </html>`,
        'utf8'
      );

      const server = createUirigMcpServer(pool, '0.3.1');
      const client = new Client({ name: 'test-client', version: '1.0.0' });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

      const res = await client.callTool({
        name: 'uirig_check',
        arguments: {
          target: './scoped-stage.html',
          cwd: tempDir,
          scope: ['#uirig-stage'],
          exclude: ['h3.demo-title'],
          viewport: { name: 'desktop', width: 1280, height: 800 },
        },
      });

      expect(res.isError).toBe(false);
      const text = (res.content as Array<{ type: string; text: string }>).at(0)?.text ?? '{}';
      const payload = JSON.parse(text) as {
        passed: boolean;
        exitCode: number;
        violations: Array<unknown>;
      };
      expect(payload.passed).toBe(true);
      expect(payload.exitCode).toBe(0);
      expect(payload.violations).toHaveLength(0);

      await client.close();
      await server.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('==> Should expose uirig_states MCP tool and catch click-occluded controls & missing :focus-visible rings (Issue #16)', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'uirig-mcp-states-'));
    try {
      writeFileSync(
        join(tempDir, 'states-fixture.html'),
        `<!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 16px; background: #ffffff; color: #0f172a; }
              .stack { position: relative; width: 180px; height: 44px; margin-bottom: 12px; }
              .stack button, .stack .shield { position: absolute; inset: 0; width: 100%; height: 100%; }
              .shield { opacity: 0; z-index: 5; }
              button.no-ring { outline: none; border: 1px solid #cbd5e1; background: #ffffff; padding: 8px 14px; }
              button.no-ring:focus-visible { outline: none; }
            </style>
          </head>
          <body>
            <div class="stack">
              <button id="blocked-btn">Blocked</button>
              <div class="shield"></div>
            </div>
            <button id="no-ring-btn" class="no-ring">No Ring</button>
          </body>
        </html>`,
        'utf8'
      );

      const server = createUirigMcpServer(pool, '0.3.1');
      const client = new Client({ name: 'test-client', version: '1.0.0' });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

      const res = await client.callTool({
        name: 'uirig_states',
        arguments: {
          target: './states-fixture.html',
          cwd: tempDir,
          viewport: { name: 'desktop', width: 1280, height: 800 },
        },
      });

      expect(res.isError).toBe(true);
      const text = (res.content as Array<{ type: string; text: string }>).at(0)?.text ?? '{}';
      const payload = JSON.parse(text) as {
        passed: boolean;
        exitCode: number;
        violations: Array<{ engine: string; violationType: string; selector: string }>;
      };
      expect(payload.passed).toBe(false);
      expect(payload.exitCode).toBe(1);
      expect(payload.violations).toHaveLength(2);
      expect(payload.violations.map((v) => v.violationType).sort()).toEqual([
        'click_occluded',
        'missing_focus_visible',
      ]);

      await client.close();
      await server.close();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

});
