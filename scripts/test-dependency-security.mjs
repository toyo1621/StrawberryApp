import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const root = fileURLToPath(new URL('../', import.meta.url));

function instances(name, version) {
  const paths = Object.keys(lock.packages).filter(path => path.endsWith(`node_modules/${name}`));
  assert.ok(paths.length > 0, `${name} must be covered by security regression tests`);
  return paths.map(path => {
    assert.equal(lock.packages[path].version, version, `Review security patch for ${path}`);
    return { path, library: require(resolve(root, path)) };
  });
}

function nestedAst(depth) {
  let node = { type: 'text', value: 'x', nodes: [] };
  for (let index = 0; index < depth; index++) {
    node = { type: 'root', nodes: [node] };
  }
  return node;
}

for (const { path, library: braces } of instances('braces', '3.0.3')) {
  test(`${path}: normal patterns and literals retain their behavior`, () => {
    assert.deepEqual(braces.expand('src/{app,worker}/*.{js,ts}'), [
      'src/app/*.js', 'src/app/*.ts', 'src/worker/*.js', 'src/worker/*.ts',
    ]);
    assert.equal(braces.compile('{a,b}'), '(a|b)');
    assert.deepEqual(braces.expand('{1..3}'), ['1', '2', '3']);
    assert.equal(braces.stringify('\\{literal\\}'), '{literal}');
    assert.equal(braces.stringify('"' + '{'.repeat(150) + '"'), '{'.repeat(150));
    assert.equal(braces.stringify('('.repeat(50) + 'x' + ')'.repeat(50)), '('.repeat(50) + 'x' + ')'.repeat(50));
    assert.equal(braces.stringify('{'.repeat(100) + 'a,b' + '}'.repeat(100)), '{'.repeat(100) + 'a,b' + '}'.repeat(100));
    assert.throws(() => braces.parse('{'.repeat(101) + 'a,b' + '}'.repeat(101)), /nesting depth/);
  });

  for (const method of ['parse', 'compile', 'expand', 'stringify']) {
    test(`${path}: ${method} rejects excessive pattern nesting predictably`, () => {
      for (const [open, close] of [['{', '}'], ['(', ')'], ['{(', ')}']]) {
        const pattern = open.repeat(4000 / open.length) + 'a,b' + close.repeat(4000 / close.length);
        assert.throws(() => braces[method](pattern), error =>
          error instanceof SyntaxError && /nesting depth/.test(error.message));
      }
      assert.throws(() => braces[method]('{'.repeat(150)), /nesting depth/);
    });
  }

  for (const method of ['compile', 'expand', 'stringify']) {
    test(`${path}: ${method} also bounds caller-supplied AST depth`, () => {
      assert.throws(() => braces[method](nestedAst(4000)), error =>
        error instanceof SyntaxError && /nesting depth/.test(error.message));
    });
  }
}

for (const { path, library: forge } of instances('node-forge', '1.4.0')) {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 3 });
  const digest = () => forge.md.sha256.create().update('security regression fixture');
  const asn1 = forge.asn1;
  const element = (type, value, constructed = false) =>
    asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);

  function signature({ parameters = true, nestedExtra = false, outerExtra = false } = {}) {
    const algorithm = [element(asn1.Type.OID, asn1.oidToDer(forge.pki.oids.sha256).getBytes())];
    if (parameters) {
      algorithm.push(element(asn1.Type.NULL, ''));
    }
    if (nestedExtra) {
      algorithm.push(element(asn1.Type.OCTETSTRING, 'unconsumed bytes'));
    }
    const info = [element(asn1.Type.SEQUENCE, algorithm, true), element(asn1.Type.OCTETSTRING, digest().digest().getBytes())];
    if (outerExtra) {
      info.push(element(asn1.Type.OCTETSTRING, 'unconsumed bytes'));
    }
    return keys.privateKey.sign(asn1.toDer(element(asn1.Type.SEQUENCE, info, true)).getBytes(), 'NONE');
  }

  test(`${path}: valid RSA signatures with optional NULL remain accepted`, () => {
    for (const parameters of [true, false]) {
      assert.equal(keys.publicKey.verify(digest().digest().getBytes(), signature({ parameters })), true);
    }
    assert.equal(keys.publicKey.verify(digest().digest().getBytes(), keys.privateKey.sign(digest())), true);
    const wrongDigest = forge.md.sha256.create().update('different message').digest().getBytes();
    assert.equal(keys.publicKey.verify(wrongDigest, signature()), false);
  });

  test(`${path}: nested DigestAlgorithm garbage is rejected with and without NULL`, () => {
    for (const parameters of [true, false]) {
      assert.throws(() => keys.publicKey.verify(digest().digest().getBytes(), signature({ parameters, nestedExtra: true })), /valid RSASSA-PKCS1-v1_5 DigestInfo/);
    }
  });

  test(`${path}: outer DigestInfo garbage remains rejected`, () => {
    assert.throws(() => keys.publicKey.verify(digest().digest().getBytes(), signature({ outerExtra: true })), /valid RSASSA-PKCS1-v1_5 DigestInfo/);
  });

  test(`${path}: normal self-signed certificate verification remains valid`, () => {
    const certificateKeys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 65537 });
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = certificateKeys.publicKey;
    certificate.serialNumber = '01';
    certificate.validity.notBefore = new Date('2026-01-01T00:00:00Z');
    certificate.validity.notAfter = new Date('2027-01-01T00:00:00Z');
    certificate.setSubject([{ name: 'commonName', value: 'dependency-test.invalid' }]);
    certificate.setIssuer(certificate.subject.attributes);
    certificate.setExtensions([{ name: 'basicConstraints', cA: true }]);
    certificate.sign(certificateKeys.privateKey, forge.md.sha256.create());
    const decoded = forge.pki.certificateFromPem(forge.pki.certificateToPem(certificate));
    assert.equal(decoded.verify(decoded), true);
  });
}
