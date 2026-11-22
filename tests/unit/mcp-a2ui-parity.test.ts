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
});
