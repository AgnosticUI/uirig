/**
 * src/utils/a2ui-self-heal.ts
 * AgnosticUI Support Center Studio Eval Gate & Opt-In Self-Healing Harness (Issue #32).
 * Translates out-of-band `IAgenticViolation` diagnostics into standard A2UI (Agent-to-UI) v1.0
 * `updateComponents` deltas and verifies closed-loop convergence (`exitCode === 0`).
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  executeCheckCommand,
  type ICheckExecutionReport,
  type IViewportConfig,
  type PosixExitCode,
} from '../commands/check.js';
import {
  formatAgenticJsonStream,
  type IAgenticJsonStreamPayload,
  type IAgenticViolation,
} from './agent-stream.js';

export interface IA2uiComponentSpec {
  id: string;
  component: string;
  children?: Array<string>;
  text?: string;
  label?: string;
  ariaLabel?: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
  contrastSafe?: boolean;
}

export interface IA2uiSupportSurfaceState {
  surfaceId: string;
  catalogId: string;
  components: Array<IA2uiComponentSpec>;
}

export interface IA2uiUpdateComponentsMessage {
  updateComponents: {
    surfaceId: string;
    components: Array<Partial<IA2uiComponentSpec> & { id: string }>;
  };
}

export interface IA2uiSelfHealTurnTrace {
  turn: number;
  exitCode: PosixExitCode;
  violationCount: number;
  appliedDelta: IA2uiUpdateComponentsMessage | null;
}

export interface IA2uiSelfHealResult {
  converged: boolean;
  turnsUsed: number;
  finalExitCode: PosixExitCode;
  finalState: IA2uiSupportSurfaceState;
  finalReport: ICheckExecutionReport;
  trace: Array<IA2uiSelfHealTurnTrace>;
}

/**
 * Translates `uirig` `IAgenticViolation` items attributed to `surfaceId` into a minimal,
 * standard A2UI v1.0 `updateComponents` delta message without modifying wire schemas.
 */
export function buildA2uiUpdateComponentsDelta(
  surfaceId: string,
  violations: ReadonlyArray<IAgenticViolation>
): IA2uiUpdateComponentsMessage {
  const patchMap = new Map<string, Partial<IA2uiComponentSpec> & { id: string }>();

  for (const violation of violations) {
    const attr = violation.a2ui;
    if (!attr || !attr.a2uiComponentId) {
      continue;
    }
    if (attr.surfaceId && attr.surfaceId !== surfaceId) {
      continue;
    }

    const compId = attr.a2uiComponentId;
    const existing = patchMap.get(compId) ?? { id: compId };

    if (
      violation.violationType === 'ax_empty_name' ||
      violation.violationType === 'unlabeled_control'
    ) {
      const readableLabel = compId
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
      existing.ariaLabel = readableLabel;
    } else if (
      violation.engine === 'contrast' ||
      violation.engine === 'dark-mode' ||
      violation.violationType === 'token_drift'
    ) {
      existing.contrastSafe = true;
    }

    patchMap.set(compId, existing);
  }

  return {
    updateComponents: {
      surfaceId,
      components: Array.from(patchMap.values()),
    },
  };
}

/**
 * Applies an A2UI v1.0 `updateComponents` delta immutably to a surface state.
 */
export function applyA2uiUpdateComponentsDelta(
  state: IA2uiSupportSurfaceState,
  delta: IA2uiUpdateComponentsMessage
): IA2uiSupportSurfaceState {
  if (delta.updateComponents.surfaceId !== state.surfaceId) {
    return state;
  }

  const updatesById = new Map<string, Partial<IA2uiComponentSpec> & { id: string }>();
  for (const patch of delta.updateComponents.components) {
    updatesById.set(patch.id, patch);
  }

  return {
    ...state,
    components: state.components.map((comp) => {
      const patch = updatesById.get(comp.id);
      return patch ? { ...comp, ...patch } : comp;
    }),
  };
}
/**
 * Opt-In Self-Healing Convergence Loop (Mode 2):
 * Repeatedly audits the rendered `<a2ui-surface>` across themes and viewports, synthesizes
 * minimal A2UI v1.0 `updateComponents` deltas from `uirig`'s `a2ui` diagnostics, and re-audits
 * until `exitCode === 0` or `maxTurns` is reached.
 */
export async function runA2uiSelfHealingLoop(options: {
  initialState: IA2uiSupportSurfaceState;
  cwd: string;
  maxTurns?: number;
  themes?: Array<string>;
  viewports?: Array<IViewportConfig>;
}): Promise<IA2uiSelfHealResult> {
  const maxTurns = options.maxTurns ?? 2;
  const themes = options.themes ?? ['light', 'dark'];
  const viewports = options.viewports ?? [
    { name: 'mobile', width: 375, height: 812 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  let currentState = options.initialState;
  const trace = new Array<IA2uiSelfHealTurnTrace>();
  let latestReport: ICheckExecutionReport | null = null;

  for (let turn = 1; turn <= maxTurns; turn++) {
    const htmlFileName = 'support-center-turn-' + String(turn) + '.html';
    const htmlPath = join(options.cwd, htmlFileName);
    writeFileSync(htmlPath, renderSupportCenterSurfaceHtml(currentState), 'utf8');

    const report = await executeCheckCommand({
      target: './' + htmlFileName,
      cwd: options.cwd,
      selectors: ['a2ui-surface'],
      themes,
      viewportsOverride: viewports,
      headless: true,
      silentStdout: true,
      reportOutputPath: join(options.cwd, '.uirig', 'github_pr_comment.md'),
    });
    latestReport = report;

    const payload = JSON.parse(formatAgenticJsonStream(report)) as IAgenticJsonStreamPayload;

    if (report.exitCode === 0) {
      trace.push({
        turn,
        exitCode: 0,
        violationCount: 0,
        appliedDelta: null,
      });
      return {
        converged: true,
        turnsUsed: turn,
        finalExitCode: 0,
        finalState: currentState,
        finalReport: report,
        trace,
      };
    }

    const delta = buildA2uiUpdateComponentsDelta(currentState.surfaceId, payload.violations);
    trace.push({
      turn,
      exitCode: report.exitCode,
      violationCount: payload.violations.length,
      appliedDelta: delta.updateComponents.components.length > 0 ? delta : null,
    });

    if (delta.updateComponents.components.length === 0) {
      break;
    }

    currentState = applyA2uiUpdateComponentsDelta(currentState, delta);
  }

  return {
    converged: false,
    turnsUsed: trace.length,
    finalExitCode: latestReport ? latestReport.exitCode : 1,
    finalState: currentState,
    finalReport: latestReport as ICheckExecutionReport,
    trace,
  };
}

export function createBrokenSupportCenterSurfaceFixture(): IA2uiSupportSurfaceState {
  return {
    surfaceId: 'support-ticket',
    catalogId: 'agnosticui-v1',
    components: [
      {
        id: 'root',
        component: 'Card',
        children: ['ticket_header', 'close_drawer_btn', 'escalation_status_badge', 'ticket_summary'],
      },
      {
        id: 'ticket_header',
        component: 'Text',
        text: 'Ticket #4821 — Production SSO Timeout',
      },
      {
        id: 'close_drawer_btn',
        component: 'IconButton',
      },
      {
        id: 'escalation_status_badge',
        component: 'Badge',
        text: 'Escalated — Tier 2',
        tone: 'warning',
        contrastSafe: false,
      },
      {
        id: 'ticket_summary',
        component: 'Text',
        text: 'Enterprise tenant reports SAML assertion failures on mobile and desktop logins.',
      },
    ],
  };
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderSupportCenterSurfaceHtml(state: IA2uiSupportSurfaceState): string {
  const renderedChildren = state.components
    .filter((c) => c.id !== 'root')
    .map((comp) => {
      const commonAttrs =
        'data-a2ui-id="' +
        escapeHtmlAttr(comp.id) +
        '" data-a2ui-component="' +
        escapeHtmlAttr(comp.component) +
        '"';

      if (comp.component === 'IconButton') {
        const ariaAttr =
          comp.ariaLabel && comp.ariaLabel.trim().length > 0
            ? ' aria-label="' + escapeHtmlAttr(comp.ariaLabel.trim()) + '"'
            : '';
        return '<ag-icon-button ' + commonAttrs + ariaAttr + '></ag-icon-button>';
      }

      if (comp.component === 'Badge') {
        const badgeClass = comp.contrastSafe ? 'badge badge-safe' : 'badge badge-low-contrast';
        return (
          '<div ' +
          commonAttrs +
          '><span class="' +
          badgeClass +
          '">' +
          escapeHtmlAttr(comp.text ?? '') +
          '</span></div>'
        );
      }

      return (
        '<p ' +
        commonAttrs +
        ' class="copy">' +
        escapeHtmlAttr(comp.text ?? '') +
        '</p>'
      );
    })
    .join('\n        ');

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <title>AgnosticUI Support Center Studio</title>',
    '    <style>',
    '      body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; background: #ffffff; color: #0f172a; }',
    '      html[data-theme="dark"] body, html[data-theme="enterprise-dark"] body { background: #0f172a; color: #f8fafc; }',
    '      a2ui-surface { display: block; max-width: 640px; padding: 16px; border: 1px solid #cbd5e1; border-radius: 8px; }',
    '      .copy { margin: 8px 0; font-size: 16px; line-height: 1.5; }',
    '      .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 14px; font-weight: 600; }',
    '      .badge-low-contrast { background: #fef3c7; color: #92400e; }',
    '      html[data-theme="dark"] .badge-low-contrast, html[data-theme="enterprise-dark"] .badge-low-contrast { background: #1e293b; color: #475569; }',
    '      .badge-safe { background: #0f172a; color: #ffffff; }',
    '      html[data-theme="dark"] .badge-safe, html[data-theme="enterprise-dark"] .badge-safe { background: #f8fafc; color: #0f172a; }',
    '    </style>',
    '  </head>',
    '  <body>',
    '    <main>',
    '      <a2ui-surface id="' +
      escapeHtmlAttr(state.surfaceId) +
      '" catalog-id="' +
      escapeHtmlAttr(state.catalogId) +
      '">',
    '        ' + renderedChildren,
    '      </a2ui-surface>',
    '    </main>',
    '    <script>',
    '      class AgIconButton extends HTMLElement {',
    '        constructor() {',
    '          super();',
    '          const root = this.attachShadow({ mode: "open" });',
    '          root.innerHTML = \'<button type="button" style="min-width:32px;min-height:32px;"><svg width="16" height="16" aria-hidden="true"></svg></button>\';',
    '        }',
    '      }',
    '      customElements.define("ag-icon-button", AgIconButton);',
    '    </script>',
    '  </body>',
    '</html>',
  ].join('\n');
}
