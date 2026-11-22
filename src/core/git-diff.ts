/**
 * src/core/git-diff.ts
 * Incremental Git-Diff Component Scoping (`--changed` / `--base <ref>`) (Issue #14).
 * Inspects modified files in Git, applies optional `changedPaths` (`include` / `exclude` globs),
 * infers custom element tags and component selectors (`customElements.define(...)`,
 * `@customElement(...)`, hyphenated filenames/tags), and enables zero-overhead early exit
 * when no UI/component/template files changed.
 */

import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { basename, extname, resolve } from 'path';

export interface IChangedPathsConfig {
  /** Optional glob patterns (e.g. `["src/components/**", "app/views/**", "server/html_*.py"]`) that classify changed files as UI files. */
  include?: Array<string>;
  /** Optional glob patterns (e.g. `["src/toys/**", "src/experimental/**"]`) excluded from `--changed` triggers. */
  exclude?: Array<string>;
}

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
  '.erb',
  '.haml',
  '.slim',
  '.jinja',
  '.jinja2',
  '.j2',
  '.njk',
  '.hbs',
  '.handlebars',
  '.mustache',
  '.twig',
  '.heex',
  '.eex',
  '.cshtml',
  '.razor',
  '.tmpl',
  '.gohtml',
  '.liquid',
  '.pug',
  '.ejs',
  '.php',
]);

const IGNORED_TEST_OR_CONFIG_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/i,
  /\.spec\.[cm]?[jt]sx?$/i,
  /(?:^|\/)tests?\//i,
  /(?:^|\/)__tests__\//i,
  /\.config\.[cm]?[jt]s$/i,
  /\.d\.ts$/i,
];

function globPatternToRegExp(glob: string): RegExp {
  const normalized = glob.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  let regexStr = '^';
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized.charAt(i);
    if (ch === '*') {
      if (normalized.charAt(i + 1) === '*') {
        if (normalized.charAt(i + 2) === '/') {
          regexStr += '(?:.+/)?';
          i += 3;
          continue;
        }
        regexStr += '.*';
        i += 2;
        continue;
      }
      regexStr += '[^/]*';
      i++;
      continue;
    }
    if (ch === '?') {
      regexStr += '[^/]';
      i++;
      continue;
    }
    regexStr += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    i++;
  }

  regexStr += '$';
  return new RegExp(regexStr);
}

export function matchesAnyGlob(relPath: string, globs: ReadonlyArray<string>): boolean {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const glob of globs) {
    if (glob.trim().length === 0) {
      continue;
    }
    if (globPatternToRegExp(glob).test(normalized)) {
      return true;
    }
  }
  return false;
}

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
    addLines(runGitCommand(cwd, ['diff', '--name-only', cleanRef + '...HEAD']));
    addLines(runGitCommand(cwd, ['diff', '--name-only', cleanRef]));
  } else {
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

export function isUiComponentFile(
  relPath: string,
  changedPaths?: IChangedPathsConfig
): boolean {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '');

  if (changedPaths?.exclude && changedPaths.exclude.length > 0) {
    if (matchesAnyGlob(normalized, changedPaths.exclude)) {
      return false;
    }
  }

  if (changedPaths?.include && changedPaths.include.length > 0) {
    return matchesAnyGlob(normalized, changedPaths.include);
  }

  for (const pattern of IGNORED_TEST_OR_CONFIG_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }
  const ext = extname(normalized).toLowerCase();
  return UI_FILE_EXTENSIONS.has(ext);
}

export function inferSelectorsFromFile(
  relPath: string,
  fileContent: string | null
): Array<string> {
  const selectors = new Set<string>();

  if (fileContent && fileContent.length > 0) {
    const defineRegex = /customElements\.define\(\s*['"`]([a-z][a-z0-9-]*-[a-z0-9-]+)['"`]/g;
    let defineMatch: RegExpExecArray | null = defineRegex.exec(fileContent);
    while (defineMatch !== null) {
      if (defineMatch[1]) {
        selectors.add(defineMatch[1]);
      }
      defineMatch = defineRegex.exec(fileContent);
    }

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

export function resolveChangedComponentSelectors(
  cwd: string,
  baseRef?: string,
  changedPaths?: IChangedPathsConfig
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

  const changedUiFiles = files.filter((f) => isUiComponentFile(f, changedPaths));
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
