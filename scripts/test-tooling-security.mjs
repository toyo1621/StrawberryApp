import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
import sharp from 'sharp';
import shellQuote from 'shell-quote';
import sourceMap from 'source-map-js';
import braces from 'braces';
import forge from 'node-forge';

const { SourceMapConsumer, SourceNode } = sourceMap;
const require = createRequire(import.meta.url);
const sharpRequire = createRequire(require.resolve('sharp'));
const semver = sharpRequire('semver');
const flatMap = () => ({ version: 3, sources: ['fixture.js'], names: [], mappings: 'AAAA' });
const indexedMap = (line, column = 0, map = flatMap()) => ({
  version: 3,
  sections: [{ offset: { line, column }, map }],
});

test('deep brace and parenthesis patterns fail with a bounded syntax error, not stack exhaustion', () => {
  for (const [open, close] of [['{', '}'], ['(', ')']]) {
    const pattern = open.repeat(4000) + 'a,b' + close.repeat(4000);
    for (const operation of [braces, braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => operation(pattern), { name: 'SyntaxError', message: /safe depth limit/ });
    }
  }
  assert.deepEqual(braces.expand('src/{app,worker}/{a,b}.ts'), [
    'src/app/a.ts', 'src/app/b.ts', 'src/worker/a.ts', 'src/worker/b.ts',
  ]);
  assert.equal(braces.compile('a/{b,c}/d'), 'a/(b|c)/d');
});

test('RSA rejects nested DigestAlgorithm garbage while accepting normal signatures and optional NULL', () => {
  const { asn1, md, pki, util } = forge;
  const keys = pki.rsa.generateKeyPair({ bits: 1024, e: 3 });
  const digest = md.sha256.create().update('tooling security fixture').digest().getBytes();
  const node = (type, value, constructed = false) => asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);
  const oid = node(asn1.Type.OID, asn1.oidToDer(pki.oids.sha256).getBytes());
  const nullNode = node(asn1.Type.NULL, '');
  const signatureFor = (algorithm) => keys.privateKey.sign(asn1.toDer(
    node(asn1.Type.SEQUENCE, [node(asn1.Type.SEQUENCE, algorithm, true), node(asn1.Type.OCTETSTRING, digest)], true),
  ).getBytes(), 'NONE');
  for (const algorithm of [[oid], [oid, nullNode]]) {
    assert.equal(keys.publicKey.verify(digest, signatureFor(algorithm)), true);
  }
  for (const algorithm of [[oid, nullNode, node(asn1.Type.OCTETSTRING, 'padding')], [oid, node(asn1.Type.SEQUENCE, [], true)]]) {
    assert.throws(() => keys.publicKey.verify(digest, signatureFor(algorithm)), /valid RSASSA/);
  }
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 60_000);
  cert.setSubject([{ name: 'commonName', value: 'local-fixture' }]);
  cert.setIssuer(cert.subject.attributes);
  cert.sign(keys.privateKey, md.sha256.create());
  assert.equal(cert.verify(pki.certificateFromPem(pki.certificateToPem(cert))), true);
  assert.ok(util.encode64(cert.signature).length > 0);
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
