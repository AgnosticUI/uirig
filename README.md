# uipipe

### Invariant Semantic Structure meets Composable Style Vectors.

`uipipe` is a modular command-line toolchain built explicitly to destroy **AI Slop**—those fragile, bloated interfaces generated in a single prompt turn that collapse the second real text overflows, layout viewports scale, or input containers are dynamically populated.

By adapting the **Unix Tools Philosophy** directly to AI-driven front-end engineering, `uipipe` splits the structural architecture from the visual skin. It allows you to pipe unstyled layout logic into variant token systems, run local adversarial fuzz tests to harden code resilience, and bundle clean context environments regardless of your AI platform tier.

```text
       [Prompt Intent]
              │
              ▼
   :::   uipipe layout   ==>  [01_layout.html] (Grayscale, Rigid CSS Grid/Flex DOM Tree)
              │
              ▼
   :::   uipipe paint    ==>  [02_painted.html] (Token-Injected Skin, Variant Synthesis)
              │
              ▼
   :::   uipipe break    ==>  [03_hardened.html] (Defensive DOM Wrappers, Overflows Sealed)
              │
              ▼
   :::   uipipe handoff  ==>  [.uipipe/copy_paste_pack.md] (Context Engine Proxy)
```

---

## The System Architecture

### 📐 1. `uipipe layout` (Structural Blueprint Engine)
Forces the AI model into a single responsibility parameter: **Generate DOM node relationships and responsive bounding paths.** It operates entirely in grayscale, emitting structurally invariant markup devoid of color variables, font families, shadows, animations, or styling details.

### 🎨 2. `uipipe paint` (The Style Tensor Mixer)
Fuses the grayscale layout framework with a design system definition configuration (`tokens.json`). By appending an optional `--shuffle` flag, it acts as an **"I'm Feeling Lucky" style explorer**, generating 3 to 5 distinct token configurations (compact vs. roomy densities, light/dark maps, corner-radius spectrum flips) across your unchanged markup frame. To cleanly target React frameworks without layout degradation, it completely drops old regex transformations in favor of a native, ultra-fast Rust processing layer via `oxc-parser`.

### 💥 3. `uipipe break` (Adversarial Robustness Linter)
A strict, locally executed stress injector (accessible via `uipipe break`, `breakit`, or `uibreakit`). It targets your styled interface component and applies automated boundary conditions:
*   **String Expansion Fuzzing:** Feeds elements long textual strings with zero white space or scales languages to simulate extreme translation variance (+30% tracking characters).
*   **Scale Fuzzing:** Simulates deep browser font-scaling alterations up to 200%.
*   **Phase Interruption Testing:** Audits structural interaction behaviors when async updates drop out of sequence.
It outputs hardened, defensive wrappers or exits with status code `2` while printing structural layout violations onto terminal screens (`[!] Fail: Container overflow at element badge_list`).

### 📋 4. `uipipe handoff` & `uipipe manifest` (Context Engine Proxy)
Allows developers to transport their exact execution snapshots out of the local terminal environment directly into decoupled browser instances (Google AI Studio, ChatGPT, web tabs) with zero environment context decay.

## Token Economy Profiles (Built for Your Budget)

`uipipe` handles AI token tracking and computational resources as a critical execution property. The tool runs completely offline and requires zero paid API tier commitments to operate.

*   **The Enterprise Sovereign (`--agent`):** Uncapped context budgets. Runs `uipipe` fully integrated inside automated workflow pipelines or continuous integration triggers via tools like Claude Code or Cursor agent interfaces.
*   **The Metered Pragmatist (`--api`):** Standard subscription limitations ($20/month caps). `uipipe` strips conversational fluff, minifies templates, and optimizes prompt payloads locally before stream execution—reducing active token context overhead by up to 80%.
*   **The Free-Tier Alchemist (`--local-only`):** $0 AI computational access. `uipipe manifest` compiles project tree hierarchies (omitting blackholes like `node_modules/` or `.git/`) and captures snapshots into a single, ultra-dense markdown block (`.uipipe/copy_paste_pack.md`) ready for seamless clipboard injection into free browser LLMs.

---

## Typographic Interface Standards

`uipipe` strictly enforces an emoji-free, highly readable visual syntax across your shell matrix to preserve optimal console clarity:
*   `::: ` System Boundary Markers / Stable State Checkpoints
*   `==> ` Stream Pipelines / Successful Transformations
*   `[+] ` Appended DOM Tokens / Injected Modifiers
*   `[!] ` Adversarial Structural Violations / Linter Breaks
*   `_ \ | /` Multi-frame background engine spinners

---

## Quickstart

Initialize a local workspace ecosystem on any front-end path:
```bash
uipipe init --platform=html-tailwind
```

Generate your grayscale structural grid mapping:
```bash
uipipe layout "Create an unstyled layout blueprint for a healthcare metrics side-nav dashboard"
```

Apply your theme parameters with style token mixing:
```bash
cat .uipipe/snapshots/01_layout.html | uipipe paint --tokens=brand.json --shuffle
```

Inject defensive, robust code modifiers against stress criteria:
```bash
uipipe break --target=.uipipe/snapshots/02_painted.html
```

## License
MIT