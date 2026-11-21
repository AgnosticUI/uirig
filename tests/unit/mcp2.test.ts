import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { executeMcpCommand, createUirigMcpServer, type IBrowserPool } from '../../src/commands/mcp2.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

describe('mcp2 — TDD Learning', () => {
  const fakePool: IBrowserPool = {
    dispose: async () => {},
  };

  let client: Client;
  let server: ReturnType<typeof createUirigMcpServer>;

  beforeEach(async () => {
    server = createUirigMcpServer(fakePool, '0.2.4');
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  /**
   * GIVEN a createUirigMcpServer instance
   * WHEN an MCP Client calls listTools()
   * THEN all 7 uirig verification tools are exposed
   */
  it('lists all 7 uirig verification tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual([
      'uirig_check',
      'uirig_cls',
      'uirig_contrast',
      'uirig_dark_mode',
      'uirig_dom',
      'uirig_stress',
      'uirig_tokens',
    ]);
  });

  /**
   * GIVEN a createUirigMcpServer instance
   * WHEN an MCP Client inspects every tool's inputSchema via listTools()
   * THEN ALL 7 tools advertise target, selectors, and viewport properties
   */
  it('advertises the audit input schema on every tool', async () => {
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(7);
    for (const tool of tools) {
      const properties = Object.keys(tool.inputSchema.properties ?? {});
      expect(properties).toEqual(
        expect.arrayContaining(['target', 'selectors', 'viewport', 'top', 'maxTokens'])
      );
    }
  });

    /**
   * GIVEN a createUirigMcpServer wired to an audit runner
   * WHEN an MCP Client invokes uirig_contrast with target, selectors, and viewport
   * THEN it forwards mapped options (including only: 'contrast' and silentStdout: true) and returns JSON with isError: false
   */
  it('forwards tool arguments and engine filter to the audit runner on passing audit', async () => {
    let capturedArgs: unknown;

    const fakeRunner = async (args: unknown) => {
      capturedArgs = args;
      return {
        exitCode: 0,
        jsonText: JSON.stringify({ tool: 'uirig', passed: true, exitCode: 0 }),
      };
    };

    // Re-create server with fakeRunner for this test
    await client.close();
    await server.close();

    server = createUirigMcpServer(fakePool, '0.2.4', fakeRunner);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'uirig_contrast',
      arguments: {
        target: './card.html',
        selectors: ['#card'],
        viewport: { width: 1280, height: 800 },
      },
    });

    expect(capturedArgs).toMatchObject({
      target: './card.html',
      selectors: ['#card'],
      only: 'contrast',
      viewportsOverride: [{ name: 'custom', width: 1280, height: 800 }],
      browserPool: fakePool,
      silentStdout: true,
      json: true,
    });

    expect(response.isError).toBe(false);
    const firstBlock = Array.isArray(response.content) ? response.content[0] : undefined;
    expect(firstBlock).toEqual({
      type: 'text',
      text: JSON.stringify({ tool: 'uirig', passed: true, exitCode: 0 }),
    });
  });
  /**
   * GIVEN a createUirigMcpServer whose audit runner throws an unexpected error
   * WHEN an MCP Client invokes uirig_check
   * THEN the server catches the error and returns a structured JSON error payload with isError: true
   */
  it('catches thrown runner errors and returns structured error JSON with isError: true', async () => {
    const crashingRunner = async () => {
      throw new Error('Target HTML file not found');
    };

    await client.close();
    await server.close();

    server = createUirigMcpServer(fakePool, '0.2.4', crashingRunner);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'uirig_check',
      arguments: { target: './missing.html' },
    });

    expect(response.isError).toBe(true);
    const firstBlock = Array.isArray(response.content) ? response.content[0] : undefined;
    const text = firstBlock?.type === 'text' ? firstBlock.text : '';
    expect(JSON.parse(text)).toEqual({
      tool: 'uirig',
      passed: false,
      error: 'Target HTML file not found',
    });
  });
  /**
   * GIVEN executeMcpCommand configured for stdio mode with a mock transport and pool factory
   * WHEN the stdio transport closes
   * THEN UIRIG_JSON_MODE is enabled and browserPool.dispose() is called cleanly
   */
  it('runs stdio mode, enables UIRIG_JSON_MODE, and disposes the browser pool on close', async () => {
    let disposed = false;
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const runPromise = executeMcpCommand({
      transport: 'stdio',
      createPool: () => ({
        dispose: async () => {
          disposed = true;
        },
      }),
      stdioTransport: serverTransport,
    });

    const stdioClient = new Client({ name: 'stdio-sim', version: '1.0.0' }, { capabilities: {} });
    await stdioClient.connect(clientTransport);
    expect(process.env.UIRIG_JSON_MODE).toBe('1');

    // Closing the client triggers serverTransport.onclose
    await stdioClient.close();
    await runPromise;

    expect(disposed).toBe(true);
  });

    /**
   * GIVEN executeMcpCommand running in sse HTTP mode
   * WHEN an SSEClientTransport connects, calls a tool, and an invalid sessionId is posted
   * THEN tool calls succeed over HTTP+SSE, unknown sessions return 404, and shutdown disposes the pool
   */
  it('serves MCP over HTTP SSE, rejects unknown sessionIds with 404, and disposes pool on shutdown', async () => {
    let disposed = false;
    const abortController = new AbortController();
    const port = 34567;

    const runPromise = executeMcpCommand({
      transport: 'sse',
      port,
      signal: abortController.signal,
      createPool: () => ({
        dispose: async () => {
          disposed = true;
        },
      }),
      runAudit: async () => ({
        exitCode: 0,
        jsonText: JSON.stringify({ tool: 'uirig', passed: true }),
      }),
    });

    // Give HTTP server a moment to bind
    await new Promise((r) => setTimeout(r, 50));

    // 1. Unknown sessionId returns 404
    const badRes = await fetch(`http://127.0.0.1:${port}/messages?sessionId=does-not-exist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(badRes.status).toBe(404);

    // 2. Real SSE MCP client connects and calls a tool
    const sseTransport = new SSEClientTransport(new URL(`http://127.0.0.1:${port}/sse`));
    const sseClient = new Client({ name: 'sse-test', version: '1.0.0' }, { capabilities: {} });
    await sseClient.connect(sseTransport);

    const { tools } = await sseClient.listTools();
    expect(tools).toHaveLength(7);

    const callRes = await sseClient.callTool({ name: 'uirig_contrast', arguments: {} });
    expect(callRes.isError).toBe(false);

    await sseClient.close();
    abortController.abort();
    await runPromise;

    expect(disposed).toBe(true);
  });

});
