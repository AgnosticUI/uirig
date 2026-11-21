import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

export type AuditToolName =
  | 'tokens'
  | 'contrast'
  | 'dark-mode'
  | 'stress'
  | 'cls'
  | 'dom';

export interface IViewportConfig {
  name: string;
  width: number;
  height: number;
}

export interface IBrowserPool {
  dispose(): Promise<void>;
}

export interface IAuditExecutionInput {
  target?: string;
  selectors?: Array<string>;
  configPath?: string;
  groupByRoot?: boolean;
  top?: number;
  maxTokens?: number;
  spatialBrief?: boolean;
  only?: AuditToolName;
  viewportsOverride?: Array<IViewportConfig>;
  browserPool: IBrowserPool;
  silentStdout: boolean;
  json: boolean;
  cwd?: string;
}

export interface IAuditExecutionOutput {
  exitCode: number;
  jsonText: string;
}

export type AuditRunner = (input: IAuditExecutionInput) => Promise<IAuditExecutionOutput>;

const AUDIT_INPUT_SHAPE = {
  target: z
    .string()
    .optional()
    .describe('Live URL (e.g. http://localhost:5173) or local .html file path. Omit to use uirig.config.json.'),
  selectors: z
    .array(z.string())
    .optional()
    .describe('Optional CSS selectors to scope element-level checks (e.g. ["ag-button", ".pricing-card"]).'),
  configPath: z
    .string()
    .optional()
    .describe('Optional path to uirig.config.json.'),
  groupByRoot: z
    .boolean()
    .optional()
    .describe('Collapse cascading child failures under their shared parent container or Web Component host.'),
  top: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Keep only the top N highest-priority violations.'),
  maxTokens: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Approximate token budget cap for the returned JSON payload.'),
  spatialBrief: z
    .boolean()
    .optional()
    .describe('Include compact viewport-relative bounding-box summary of landmarks & target selectors.'),
  viewport: z
    .object({
      name: z.string().default('custom'),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional()
    .describe('Optional single viewport override (e.g. { name: "desktop", width: 1280, height: 800 }).'),
  cwd: z
    .string()
    .optional()
    .describe('Optional working directory for resolving relative target or config paths.'),
};

const AuditInputSchema = z.object(AUDIT_INPUT_SHAPE);
type AuditToolArgs = z.infer<typeof AuditInputSchema>;

interface IMcpToolSpec {
  name: string;
  description: string;
  only?: AuditToolName;
}

const MCP_TOOL_SPECS: Array<IMcpToolSpec> = [
  {
    name: 'uirig_check',
    description:
      'Run all 6 deterministic UI verification engines (tokens, contrast, dark-mode, stress, cls, dom) concurrently in isolated contexts using a warm Chromium browser.',
  },
  {
    name: 'uirig_tokens',
    description:
      'Audit Light DOM and open ShadowRoot computed styles against configured design tokens.',
    only: 'tokens',
  },
  {
    name: 'uirig_contrast',
    description:
      'Verify WCAG 2.1 AA rendered luminance contrast (>= 4.5:1) using Porter-Duff alpha compositing across Light and Shadow DOM.',
    only: 'contrast',
  },
  {
    name: 'uirig_dark_mode',
    description:
      'Emulate prefers-color-scheme: dark / [data-theme="dark"] and audit dark contrast and un-inverted bright surfaces.',
    only: 'dark-mode',
  },
  {
    name: 'uirig_stress',
    description:
      'Fuzz text with +30% expansion and space-free strings to detect container overflow, 100vw bleed, and <24px tap targets.',
    only: 'stress',
  },
  {
    name: 'uirig_cls',
    description:
      'Measure W3C 1s/5s session-window Cumulative Layout Shift (CLS) against clsMaxLimit.',
    only: 'cls',
  },
  {
    name: 'uirig_dom',
    description:
      'Audit Light + Shadow DOM for broken ARIA/label IDs, orphaned <slot> projections, broken media, unsafe links, and prompt-injection traps.',
    only: 'dom',
  },
];

const defaultAuditRunner: AuditRunner = async () => ({
  exitCode: 0,
  jsonText: '{}',
});

export function createUirigMcpServer(
  browserPool: IBrowserPool,
  version: string = '0.2.4',
  runAudit: AuditRunner = defaultAuditRunner
): McpServer {
  const server = new McpServer({
    name: 'uirig',
    version,
  });

  for (const spec of MCP_TOOL_SPECS) {
    server.registerTool(
      spec.name,
      {
        description: spec.description,
        inputSchema: AUDIT_INPUT_SHAPE,
      },
      async (rawArgs: AuditToolArgs) => {
        try {
          const viewportsOverride: Array<IViewportConfig> | undefined = rawArgs.viewport
            ? [
                {
                  name: rawArgs.viewport.name ?? 'custom',
                  width: rawArgs.viewport.width,
                  height: rawArgs.viewport.height,
                },
              ]
            : undefined;

          const result = await runAudit({
            target: rawArgs.target,
            selectors: rawArgs.selectors,
            configPath: rawArgs.configPath,
            groupByRoot: rawArgs.groupByRoot,
            top: rawArgs.top,
            maxTokens: rawArgs.maxTokens,
            spatialBrief: rawArgs.spatialBrief,
            only: spec.only,
            viewportsOverride,
            browserPool,
            silentStdout: true,
            json: true,
            cwd: rawArgs.cwd,
          });

          return {
            content: [{ type: 'text' as const, text: result.jsonText }],
            isError: result.exitCode !== 0,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ tool: 'uirig', passed: false, error: message }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  return server;
}
export type McpTransportMode = 'stdio' | 'sse';

export interface IMcpServerOptions {
  transport?: McpTransportMode;
  port?: number;
  idleTimeoutMs?: number;
  signal?: AbortSignal;
  version?: string;
  createPool?: (idleTimeoutMs: number) => IBrowserPool;
  runAudit?: AuditRunner;
  stdioTransport?: Transport;
}

const DEFAULT_IDLE_TIMEOUT_MS = 300_000;

export async function executeMcpCommand(options: IMcpServerOptions = {}): Promise<void> {
  process.env.UIRIG_JSON_MODE = '1';

  const transportMode = options.transport ?? 'stdio';
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const version = options.version ?? '0.2.4';

  const browserPool = options.createPool
    ? options.createPool(idleTimeoutMs)
    : { dispose: async () => {} };

  const cleanup = async (): Promise<void> => {
    await browserPool.dispose();
  };

  if (transportMode === 'stdio') {
    const server = createUirigMcpServer(browserPool, version, options.runAudit);
    const transport = options.stdioTransport ?? new StdioServerTransport();

    await server.connect(transport);
    await new Promise<void>((resolveClose) => {
      const prevOnClose = transport.onclose;
      transport.onclose = () => {
        prevOnClose?.();
        resolveClose();
      };
    });
    await cleanup();
    return;
  }

  const port = options.port ?? 3333;
  const activeTransports = new Map<string, SSEServerTransport>();

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const reqUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && reqUrl.pathname === '/sse') {
      const sseTransport = new SSEServerTransport('/messages', res);
      activeTransports.set(sseTransport.sessionId, sseTransport);
      res.on('close', () => {
        activeTransports.delete(sseTransport.sessionId);
      });
      const sessionServer = createUirigMcpServer(browserPool, version, options.runAudit);
      await sessionServer.connect(sseTransport);
      return;
    }

    if (req.method === 'POST' && reqUrl.pathname === '/messages') {
      const sessionId = reqUrl.searchParams.get('sessionId') ?? '';
      const targetTransport = activeTransports.get(sessionId);
      if (!targetTransport) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unknown or expired MCP SSE sessionId' }));
        return;
      }
      await targetTransport.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found. Use GET /sse and POST /messages.' }));
  });

  await new Promise<void>((resolveListen) => {
    httpServer.listen(port, '127.0.0.1', () => resolveListen());
  });

  if (options.signal) {
    options.signal.addEventListener(
      'abort',
      () => {
        for (const t of activeTransports.values()) {
          void t.close();
        }
        httpServer.close();
      },
      { once: true }
    );
  }

  await new Promise<void>((resolveShutdown) => {
    httpServer.on('close', () => resolveShutdown());
  });
  await cleanup();
  
}
