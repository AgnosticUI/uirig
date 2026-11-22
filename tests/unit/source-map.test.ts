/**
 * tests/unit/source-map.test.ts
 * Unit specs for Base64 VLQ (Variable-Length Quantity) Source Map v3 decoder and
 * framework dev-mode source location parser (Issue #9 — Chunk 1).
 */

import { describe, it, expect } from 'vitest';
import {
  parseDevSourceLocationAttribute,
  parseRawSourceMap,
  resolveOriginalPositionFromSourceMap,
  type IRawSourceMapV3,
} from '../../src/core/source-map.js';

describe('::: ISSUE #9 (CHUNK 1): VLQ SOURCE-MAP DECODER & DEV METADATA PARSER :::', () => {
  it('==> Should decode inline Base64 data-URI source maps and resolve 1-based file:line:column', () => {
    // Source map mapping generated line 0, col 0 -> sources[0] ("src/styles/card.scss"), line 11 (1-based: 12), col 4 (1-based: 5)
    // VLQ for: 0 -> A, 0 -> A, 11 (<<1 = 22 -> 'W'), 4 (<<1 = 8 -> 'I') => "AAWI"
    const sampleMap: IRawSourceMapV3 = {
      version: 3,
      sources: ['../src/styles/card.scss'],
      sourceRoot: '/workspace/app/dist',
      mappings: 'AAWI',
    };
    const encoded = Buffer.from(JSON.stringify(sampleMap), 'utf8').toString('base64');
    const dataUri = 'data:application/json;charset=utf-8;base64,' + encoded;

    const parsed = parseRawSourceMap(dataUri);
    expect(parsed).not.toBeNull();

    const resolved = resolveOriginalPositionFromSourceMap(
      parsed as IRawSourceMapV3,
      0,
      2,
      '/workspace/app'
    );
    expect(resolved).toEqual({
      sourceFile: 'src/styles/card.scss',
      lineNumber: 12,
      columnNumber: 5,
    });
  });

  it('==> Should parse framework dev-mode data-source-loc attributes and handle unmapped/corrupt inputs safely', () => {
    expect(
      parseDevSourceLocationAttribute('/workspace/app/src/components/TicketCard.tsx:48:12', '/workspace/app')
    ).toEqual({
      sourceFile: 'src/components/TicketCard.tsx',
      lineNumber: 48,
      columnNumber: 12,
    });

    expect(parseDevSourceLocationAttribute('src/App.svelte:19', '/workspace/app')).toEqual({
      sourceFile: 'src/App.svelte',
      lineNumber: 19,
      columnNumber: 1,
    });

    // Production fallback: corrupt or missing source maps return null without throwing
    expect(parseRawSourceMap('not-valid-json')).toBeNull();
    expect(parseRawSourceMap('data:application/json;base64,%%%invalid%%%')).toBeNull();
    expect(parseDevSourceLocationAttribute(null, '/workspace/app')).toBeNull();
  });
});
