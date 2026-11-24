/**
 * src/commands/mcp.ts
 * Native Model Context Protocol (MCP) server mode (`uirig mcp`).
 * Exposes `uirig_check`, all 6 individual verification engines, `uirig_a2ui_delta`,
 * and `uirig_discover_tokens` over `stdio` or `sse` while keeping a persistent
 * `WarmBrowserPool` alive across tool invocations.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import {
  executeCheckCommand,
  type AuditToolName,
  type IViewportConfig,
} from './check.js';
import { WarmBrowserPool, DEFAULT_BROWSER_IDLE_TIMEOUT_MS } from '../core/browser-pool.js';
import { discoverWorkspaceTokens } from '../core/auto-tokens.js';
import { buildA2uiUpdateComponentsDelta } from '../utils/a2ui-self-heal.js';
import { formatAgenticJsonStream, type IAgenticViolation } from '../utils/agent-stream.js';
import { logTelemetry } from '../utils/formatter.js';

export type McpTransportMode = 'stdio' | 'sse';

export interface IMcpServerOptions {
  transport?: McpTransportMode;
  port?: number;
  idleTimeoutMs?: number;
  version?: string;
}

const AUDIT_INPUT_SHAPE = {
  tokensPath: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Optional path or array of paths to W3C, Style Dictionary, flat JSON, or CSS custom property token files (e.g. ["./ag-tokens.css", "./ag-tokens-dark.css"]).'),
  autoTokens: z
    .boolean()
    .optional()
    .describe('Auto-discover design tokens from workspace files and live :root CSS custom properties when tokensPath is not configured.'),
  themes: z
    .array(z.string())
    .optional()
    .describe('Optional list of theme skins (e.g. ["light", "dark", "enterprise-dark"]) evaluated via data-theme and color-scheme emulation.'),
  changed: z
    .boolean()
    .optional()
    .describe('When true, inspects git diff in cwd to scope checks to modified UI/component files and exits cleanly if none changed.'),
  baseRef: z
    .string()
    .optional()
    .describe('Optional Git base ref (e.g. "main", "origin/main") used when changed is true.'),
  fix: z
    .boolean()
    .optional()
    .describe('When true, applies deterministic 1-to-1 fixes on disk inside cwd and automatically runs a re-verification pass.'),
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
    .describe('Optional single viewport override (e.g. { name: "desktop", width: 1280, height: 800 }) for fast single-viewport checks.'),
  cwd: z
    .string()
    .optional()
    .describe('Optional working directory for resolving relative target, config, git-diff, source-map, and --fix paths.'),
};

const A2UI_DELTA_INPUT_SHAPE = {
  surfaceId: z
    .string()
    .min(1)
    .describe('Target A2UI surface identifier (e.g. "support-ticket").'),
  violations: z
    .array(z.record(z.string(), z.unknown()))
    .describe('Array of violation objects emitted by uirig_check / uirig_dom / uirig_contrast.'),
};

const DISCOVER_TOKENS_INPUT_SHAPE = {
  cwd: z
    .string()
    .optional()
    .describe('Workspace root directory to scan for W3C *.tokens.json, Style Dictionary JSON, and Tailwind v4 @theme CSS files.'),
};

const AuditInputSchema = z.object(AUDIT_INPUT_SHAPE);
type AuditToolArgs = z.infer<typeof AuditInputSchema>;

const A2uiDeltaInputSchema = z.object(A2UI_DELTA_INPUT_SHAPE);
type A2uiDeltaToolArgs = z.infer<typeof A2uiDeltaInputSchema>;

const DiscoverTokensInputSchema = z.object(DISCOVER_TOKENS_INPUT_SHAPE);
type DiscoverTokensToolArgs = z.infer<typeof DiscoverTokensInputSchema>;

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
      'Audit Light + Shadow DOM and Chromium computed AX tree for broken ARIA/label IDs, ax_empty_name, ax_hidden_focus, orphaned <slot> projections, broken media, unsafe links, and prompt-injection traps.',
    only: 'dom',
  },
];

export function createUirigMcpServer(
  browserPool: WarmBrowserPool,
  version: string = '0.3.0'
): McpServer {
  const server = new McpServer({
    name: 'uirig',
    version,
  });

  for (const spec of MCP_TOOL_SPECS) {
    server.tool(
      spec.name,
      spec.description,
      AUDIT_INPUT_SHAPE,
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

          const report = await executeCheckCommand({
            target: rawArgs.target,
            selectors: rawArgs.selectors,
            configPath: rawArgs.configPath,
            tokensPath: rawArgs.tokensPath,
            autoTokens: rawArgs.autoTokens,
            themes: rawArgs.themes,
            changed: rawArgs.changed,
            baseRef: rawArgs.baseRef,
            fix: rawArgs.fix,
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

          const jsonText = formatAgenticJsonStream(report, {
            groupByRoot: rawArgs.groupByRoot,
            top: rawArgs.top,
            maxTokens: rawArgs.maxTokens,
            cwd: rawArgs.cwd,
          });

          return {
            content: [{ type: 'text' as const, text: jsonText }],
            isError: report.exitCode !== 0,
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

  server.tool(
    'uirig_a2ui_delta',
    'Synthesize a standard, catalog-neutral A2UI v1.0 updateComponents delta message from uirig violations attributed to an <a2ui-surface> or [data-a2ui-surface].',
    A2UI_DELTA_INPUT_SHAPE,
    async (rawArgs: A2uiDeltaToolArgs) => {
      const delta = buildA2uiUpdateComponentsDelta(
        rawArgs.surfaceId,
        rawArgs.violations as unknown as ReadonlyArray<IAgenticViolation>
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(delta, null, 2) }],
      };
    }
  );

  server.tool(
    'uirig_discover_tokens',
    'Auto-discover design tokens (colors, spacing, fontSizes, radii) from W3C *.tokens.json, Style Dictionary JSON, *token*.css stylesheets, and Tailwind v4 @theme CSS files in a workspace.',
    DISCOVER_TOKENS_INPUT_SHAPE,
    async (rawArgs: DiscoverTokensToolArgs) => {
      const scale = discoverWorkspaceTokens(rawArgs.cwd ?? process.cwd());
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(scale, null, 2) }],
      };
    }
  );

  return server;
}

export async function executeMcpCommand(options: IMcpServerOptions = {}): Promise<void> {
  process.env.UIRIG_JSON_MODE = '1';

  const transportMode = options.transport ?? 'stdio';
  const port = options.port ?? 3333;
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_BROWSER_IDLE_TIMEOUT_MS;
  const version = options.version ?? '0.3.0';

  const browserPool = new WarmBrowserPool({
    headless: true,
    idleTimeoutMs,
  });

  const cleanup = async (): Promise<void> => {
    await browserPool.dispose();
  };

  process.once('SIGINT', () => {
    void cleanup().finally(() => process.exit(0));
  });
  process.once('SIGTERM', () => {
    void cleanup().finally(() => process.exit(0));
  });

  if (transportMode === 'stdio') {
    const server = createUirigMcpServer(browserPool, version);
    const transport = new StdioServerTransport();
    logTelemetry('mcp:server', `uirig MCP server listening on stdio (idleTimeout=${idleTimeoutMs}ms)...`);

    await server.connect(transport);
    await new Promise<void>((resolveClose) => {
      transport.onclose = () => {
        resolveClose();
      };
    });
    await cleanup();
    return;
  }

  const activeTransports = new Map<string, SSEServerTransport>();
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const reqUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && reqUrl.pathname === '/sse') {
      const sseTransport = new SSEServerTransport('/messages', res);
      activeTransports.set(sseTransport.sessionId, sseTransport);
      res.on('close', () => {
        activeTransports.delete(sseTransport.sessionId);
      });
      const sessionServer = createUirigMcpServer(browserPool, version);
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
    httpServer.listen(port, '127.0.0.1', () => {
      logTelemetry('mcp:server', `uirig MCP SSE server listening on http://127.0.0.1:${port}/sse`);
      resolveListen();
    });
  });

  await new Promise<void>((resolveShutdown) => {
    httpServer.on('close', () => resolveShutdown());
  });
  await cleanup();
}
