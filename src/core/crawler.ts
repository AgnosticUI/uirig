/**
 * src/core/crawler.ts
 * Framework-blind deep directory crawler core.
 * Anchored to the November 10, 2026 system timeline baseline.
 */

import { readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

export interface IFSNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: IFSNode[];
}

const BLOCKLIST_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build', 'docs_old']);

/**
 * Depth-first directory tree crawler spider.
 * Recursively filters out blackhole directories to isolate relevant code assets.
 */
export function generateDirectoryTree(dirPath: string): IFSNode {
  const nodeName = basename(dirPath);
  const stats = statSync(dirPath);

  if (!stats.isDirectory()) {
    return {
      name: nodeName,
      path: dirPath,
      type: 'file'
    };
  }

  const childrenNodes: IFSNode[] = [];
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    if (BLOCKLIST_DIRECTORIES.has(entry)) {
      continue; // Skip the directory subtree block entirely
    }

    const fullChildPath = join(dirPath, entry);
    childrenNodes.push(generateDirectoryTree(fullChildPath));
  }

  return {
    name: nodeName,
    path: dirPath,
    type: 'directory',
    children: childrenNodes
  };
}

/**
 * Serializes a structured file tree graph into an aligned plaintext ASCII visual trace layout.
 */
export function serializeTreeToAscii(node: IFSNode, depthIndent: string = ''): string {
  let asciiRepresentation = `${depthIndent}├── ${node.name}${node.type === 'directory' ? '/' : ''}\n`;
  
  if (node.children) {
    for (const child of node.children) {
      asciiRepresentation += serializeTreeToAscii(child, depthIndent + '│   ');
    }
  }
  
  return asciiRepresentation;
}
