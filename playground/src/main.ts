/// <reference path="./vite-env.d.ts" />
/**
 * playground/src/main.ts
 * Entry point for the isolated Vite + Lit + AgnosticUI spot-checking sandbox.
 *
 * Responsibilities:
 * 1. Load AgnosticUI light (`ag-tokens.css`) and dark (`ag-tokens-dark.css`) token stylesheets.
 * 2. Load source-mapped adversarial trap styles (`traps.css`) for CSS source-map attribution.
 * 3. Register local AgnosticUI Lit Web Components (`<ag-button>`, `<ag-card>`, `<ag-input>`).
 * 4. Wire `#theme-toggle` to switch `data-theme="dark"` on `document.documentElement`.
 * 5. Schedule a deterministic post-paint un-sized banner injection inside `#cls-trap-slot`.
 */

// 1. Import AgnosticUI light & dark CSS custom property sheets
import './components/ag/styles/ag-tokens.css';
import './components/ag/styles/ag-tokens-dark.css';

// 2. Import source-mapped trap stylesheet for CDP CSS.getMatchedStylesForNode attribution
import './traps.css';

// 3. Register local AgnosticUI Lit custom elements (open Shadow DOM)
import './components/ag/Button/core/Button.js';
import './components/ag/Card/core/Card.js';
import './components/ag/Input/core/Input.js';

// 4. Import theme toggle controller & CLS trap injector
import { wireThemeToggleButton } from './theme-toggle.js';
import { scheduleClsTrapInjection } from './cls-trap.js';

// Bootstrap interactive sandbox when running in a browser document
if (typeof document !== 'undefined') {
  wireThemeToggleButton(document);
  scheduleClsTrapInjection(document);
  console.log('[playground:boot] AgnosticUI Lit sandbox initialized cleanly.');
}