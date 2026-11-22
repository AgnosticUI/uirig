/**
 * src/core/git-diff.ts
 * Incremental Git-Diff Component Scoping (`--changed` / `--base <ref>`) (Issue #14).
 * Inspects modified files in Git, infers custom element tags and component selectors
 * (`customElements.define(...)`, `@customElement(...)`, hyphenated filenames/tags),
 * and enables zero-overhead early exit when no UI/component files changed.
 */

import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { basename, extname, resolve } from 'path';

export interface IChangedComponentsResolution {
  /** Whether the working directory is inside a valid Git repository. */
  isGitRepo: boolean;
  /** All modified/untracked file paths (workspace-relative, forward-slashed). */
  changedFiles: Array<string>;
  /** Subset of `changedFiles` that represent UI/component/style/template files. */
  changedUiFiles: Array<string>;
  /** Deduplicated CSS/custom-element selectors inferred from `changedUiFiles`. */
  inferredSelectors: Array<string>;
}

const UI_FILE_EXTENSIONS = new Set<string>([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.vue',
  '.svelte',
  '.astro',
]);

const IGNORED_TEST_OR_CONFIG_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/i,
  /\.spec\.[cm]?[jt]sx?$/i,
  /(?:^|\/)tests?\//i,
  /(?:^|\/)__tests__\//i,
  /\.config\.[cm]?[jt]s$/i,
  /\.d\.ts$/i,
];

function runGitCommand(cwd: string, args: Array<string>): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/**
 * Collects modified (staged, unstaged, untracked, or against `baseRef`) workspace-relative file paths.
 */
export function getGitChangedFiles(
  cwd: string,
  baseRef?: string
): { isGitRepo: boolean; files: Array<string> } {
  const insideWorkTree = runGitCommand(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (!insideWorkTree || insideWorkTree.trim() !== 'true') {
    return { isGitRepo: false, files: new Array<string>() };
  }

  const collected = new Set<string>();

  const addLines = (output: string | null): void => {
    if (!output) {
      return;
    }
    for (const rawLine of output.split(/\r?\n/)) {
      const trimmed = rawLine.trim().replace(/\\/g, '/');
      if (trimmed.length > 0) {
        collected.add(trimmed);
      }
    }
  };

  if (baseRef && baseRef.trim().length > 0) {
    const cleanRef = baseRef.trim();
    // Compare baseRef...HEAD plus any uncommitted working tree changes
    addLines(runGitCommand(cwd, ['diff', '--name-only', cleanRef + '...HEAD']));
    addLines(runGitCommand(cwd, ['diff', '--name-only', cleanRef]));
  } else {
    // Working tree + staged changes against HEAD (falling back to index diff if initial commit)
    const headDiff = runGitCommand(cwd, ['diff', '--name-only', 'HEAD']);
    if (headDiff !== null) {
      addLines(headDiff);
    } else {
      addLines(runGitCommand(cwd, ['diff', '--name-only']));
      addLines(runGitCommand(cwd, ['diff', '--name-only', '--cached']));
    }
  }

  addLines(runGitCommand(cwd, ['ls-files', '--others', '--exclude-standard']));

  return {
    isGitRepo: true,
    files: Array.from(collected).sort(),
  };
}

function isUiComponentFile(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  for (const pattern of IGNORED_TEST_OR_CONFIG_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }
  const ext = extname(normalized).toLowerCase();
  return UI_FILE_EXTENSIONS.has(ext);
}

/**
 * Infers custom element tag names or CSS selectors from a single UI/component file's
 * source content and filename (e.g. `customElements.define('ag-card', ...)`,
 * `@customElement('ag-button')`, or `ag-pricing-card.ts` -> `ag-pricing-card`).
 */
export function inferSelectorsFromFile(
  relPath: string,
  fileContent: string | null
): Array<string> {
  const selectors = new Set<string>();

  if (fileContent && fileContent.length > 0) {
    // 1. Standard Web Component `customElements.define('tag-name', ...)`
    const defineRegex = /customElements\.define\(\s*['"`]([a-z][a-z0-9-]*-[a-z0-9-]+)['"`]/g;
    let defineMatch: RegExpExecArray | null = defineRegex.exec(fileContent);
    while (defineMatch !== null) {
      if (defineMatch[1]) {
        selectors.add(defineMatch[1]);
      }
      defineMatch = defineRegex.exec(fileContent);
    }

    // 2. Lit / Fast / Stencil `@customElement('tag-name')` or `@Component({ tag: 'tag-name' })`
    const decoratorRegex =
      /(?:@customElement\(\s*['"`]([a-z][a-z0-9-]*-[a-z0-9-]+)['"`]\s*\)|@Component\(\s*\{[^}]*\btag\s*:\s*['"`]([a-z][a-z0-9-]*-[a-z0-9-]+)['"`])/g;
    let decMatch: RegExpExecArray | null = decoratorRegex.exec(fileContent);
    while (decMatch !== null) {
      const tag = decMatch[1] ?? decMatch[2];
      if (tag) {
        selectors.add(tag);
      }
      decMatch = decoratorRegex.exec(fileContent);
    }

    // 3. CSS host/custom-element rules in stylesheets (`.css`, `.scss`)
    const ext = extname(relPath).toLowerCase();
    if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') {
      const cssTagRegex = /(?:^|[\s,{])([a-z][a-z0-9]*-[a-z0-9-]+)(?=[\s.{:#[,>+~])/gm;
      let cssMatch: RegExpExecArray | null = cssTagRegex.exec(fileContent);
      while (cssMatch !== null) {
        if (cssMatch[1]) {
          selectors.add(cssMatch[1]);
        }
        cssMatch = cssTagRegex.exec(fileContent);
      }
    }
  }

  // 4. Fallback: hyphenated custom element filename (`ag-pricing-card.ts` -> `ag-pricing-card`)
  if (selectors.size === 0) {
    const stem = basename(relPath, extname(relPath))
      .replace(/\.stories$/i, '')
      .replace(/\.styles?$/i, '')
      .toLowerCase();
    if (/^[a-z][a-z0-9]*-[a-z0-9-]+$/.test(stem)) {
      selectors.add(stem);
    }
  }

  return Array.from(selectors);
}

/**
 * Resolves changed Git files and maps modified UI/component files to their
 * corresponding custom element tags / CSS selectors.
 */
export function resolveChangedComponentSelectors(
  cwd: string,
  baseRef?: string
): IChangedComponentsResolution {
  const { isGitRepo, files } = getGitChangedFiles(cwd, baseRef);
  if (!isGitRepo) {
    return {
      isGitRepo: false,
      changedFiles: new Array<string>(),
      changedUiFiles: new Array<string>(),
      inferredSelectors: new Array<string>(),
    };
  }

  const changedUiFiles = files.filter((f) => isUiComponentFile(f));
  const selectorSet = new Set<string>();

  for (const relFile of changedUiFiles) {
    const absFile = resolve(cwd, relFile);
    let content: string | null = null;
    if (existsSync(absFile)) {
      try {
        content = readFileSync(absFile, 'utf8');
      } catch {
        content = null;
      }
    }
    for (const sel of inferSelectorsFromFile(relFile, content)) {
      selectorSet.add(sel);
    }
  }

  return {
    isGitRepo: true,
    changedFiles: files,
    changedUiFiles,
    inferredSelectors: Array.from(selectorSet).sort(),
  };
}
