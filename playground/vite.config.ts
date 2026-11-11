/**
 * playground/vite.config.ts
 * Vite configuration for the isolated AgnosticUI spot-checking sandbox.
 *
 * Automatically triggers `runLivePlaygroundSpotCheck` once the dev server starts
 * listening during `npm run playground:dev`, printing the 4-tool diagnostic summary
 * in the terminal while keeping `http://localhost:5173` open for manual browser inspection.
 */

import { defineConfig, type Plugin } from 'vite';
import { runLivePlaygroundSpotCheck, formatSpotCheckSummary } from './src/spot-check.js';

function uirigAutoSpotCheckPlugin(): Plugin {
  return {
    name: 'uirig-auto-spotcheck',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        const port =
          typeof address === 'object' && address !== null ? address.port : 5173;
        const devUrl = `http://localhost:${port}`;

        void runLivePlaygroundSpotCheck(port, {
          headless: true,
          existingUrl: devUrl,
        })
          .then((report) => {
            console.log(formatSpotCheckSummary(report));
            console.log(`[playground:dev] Live sandbox ready for manual browser inspection at ${devUrl}\n`);
          })
          .catch((err: unknown) => {
            console.error('[playground:dev] Spot-check reporter encountered an error:', err);
          });
      });
    },
  };
}

export default defineConfig({
  plugins: [uirigAutoSpotCheckPlugin()],
});
