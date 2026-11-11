/**
 * playground/vite.config.ts
 * Vite configuration for the isolated AgnosticUI spot-checking sandbox.
 *
 * Runs `runLivePlaygroundSpotCheck` on initial dev-server startup AND
 * automatically re-audits (debounced) whenever files in `playground/` change,
 * giving a live Red -> Green terminal feedback loop on every save.
 */

import { defineConfig, type Plugin } from 'vite';
import { runLivePlaygroundSpotCheck, formatSpotCheckSummary } from './src/spot-check.js';

function uirigAutoSpotCheckPlugin(): Plugin {
  return {
    name: 'uirig-auto-spotcheck',
    apply: 'serve',
    configureServer(server) {
      let activeUrl = 'http://localhost:5173';
      let isAuditing = false;
      let rerunQueued = false;
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      const triggerAudit = (reason: string): void => {
        if (isAuditing) {
          rerunQueued = true;
          return;
        }

        isAuditing = true;
        console.log(`\n[playground:dev] Running 4-tool spot-check (${reason})...`);

        void runLivePlaygroundSpotCheck(5173, {
          headless: true,
          existingUrl: activeUrl,
        })
          .then((report) => {
            console.log(formatSpotCheckSummary(report));
            console.log(`[playground:dev] Watching for file edits at ${activeUrl}\n`);
          })
          .catch((err: unknown) => {
            console.error('[playground:dev] Spot-check reporter encountered an error:', err);
          })
          .finally(() => {
            isAuditing = false;
            if (rerunQueued) {
              rerunQueued = false;
              triggerAudit('queued file save');
            }
          });
      };

      // 1. Run immediately once Vite binds its port
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        const port =
          typeof address === 'object' && address !== null ? address.port : 5173;
        activeUrl = `http://localhost:${port}`;
        triggerAudit('initial server boot');
      });

      // 2. Re-run automatically (debounced 300ms) whenever you save a file in playground/
      server.watcher.on('change', (changedPath: string) => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          triggerAudit(`saved ${changedPath.split('/').pop() ?? 'file'}`);
        }, 300);
      });
    },
  };
}

export default defineConfig({
  plugins: [uirigAutoSpotCheckPlugin()],
});
