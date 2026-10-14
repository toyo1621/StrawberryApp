import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
import sharp from 'sharp';
import shellQuote from 'shell-quote';
import sourceMap from 'source-map-js';

const { SourceMapConsumer, SourceNode } = sourceMap;
const require = createRequire(import.meta.url);
const sharpRequire = createRequire(require.resolve('sharp'));
const semver = sharpRequire('semver');
const flatMap = () => ({ version: 3, sources: ['fixture.js'], names: [], mappings: 'AAAA' });
const indexedMap = (line, column = 0, map = flatMap()) => ({
  version: 3,
  sections: [{ offset: { line, column }, map }],
});

test('shell quoting rejects every line terminator after a comment and preserves ordinary arguments', () => {
  for (const separator of ['\n', '\r', '\u2028', '\u2029']) {
    assert.throws(() => shellQuote.quote(['echo', { comment: 'fixture' }, `a${separator}b`]), TypeError);
  }
  const args = ['node', 'a b', 'x#y', 'literal'];
  assert.deepEqual(shellQuote.parse(shellQuote.quote(args)), args);
});

test('indexed source maps reject negative, fractional, non-finite, and non-numeric offsets', () => {
  for (const offset of [-1, 1.5, NaN, Infinity, '1', null]) {
    assert.throws(() => new SourceMapConsumer(indexedMap(offset)), /non-negative integers/);
    assert.throws(() => new SourceMapConsumer(indexedMap(0, offset)), /non-negative integers/);
  }
});

test('indexed source maps reject excessive section line offsets', () => {
  assert.throws(() => new SourceMapConsumer(indexedMap(1e7 + 1)), /must not exceed/);
});

test('indexed source maps bound the sum of nested section offsets', () => {
  assert.throws(() => new SourceMapConsumer(indexedMap(6e6, 0, indexedMap(6e6))), /nested sections/);
});

test('ordinary source maps preserve generated code and original positions', () => {
  const consumer = new SourceMapConsumer(flatMap());
  assert.equal(SourceNode.fromStringWithSourceMap('x;\n', consumer).toString(), 'x;\n');
  assert.deepEqual(consumer.originalPositionFor({ line: 1, column: 0 }), {
    source: 'fixture.js', line: 1, column: 0, name: null,
  });
});

test('source-node conversion stops at the end of generated code even with distant mappings', () => {
  // An in-process timer cannot interrupt the vulnerable synchronous loop.
  const child = spawnSync(process.execPath, ['--max-old-space-size=128', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import sourceMap from 'source-map-js';
    const consumer = {
      eachMapping(callback) {
        callback({ generatedLine: 1e9, generatedColumn: 0, originalLine: 1,
          originalColumn: 0, source: 'fixture.js', name: null });
      },
      sources: ['fixture.js'],
      sourceContentFor() { return 'x;'; }
    };
    assert.equal(sourceMap.SourceNode.fromStringWithSourceMap('x;\\n', consumer).toString(), 'x;\\n');
  `], { cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 3000, maxBuffer: 10000 });
  assert.equal(child.error, undefined, 'Conversion must complete within the deadline');
  assert.equal(child.status, 0, child.stderr);
});

test('sharp loads the fixed native SVG decoder and preserves raster pixel output', async () => {
  assert.ok(semver.gte(sharp.versions.rsvg, '2.63.2'), 'The loaded librsvg must contain the upstream fix');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>');
  const { data, info } = await sharp(svg).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual({ width: info.width, height: info.height, channels: info.channels }, {
    width: 2, height: 2, channels: 4,
  });
  assert.deepEqual([...data], Array(4).fill([255, 0, 0, 255]).flat());
});
