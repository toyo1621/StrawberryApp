import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const secret = 'local-cli-test-secret-more-than-32-characters';
const id = '11111111-1111-4111-8111-111111111111';
const script = new URL('./moderate-rankings.mjs', import.meta.url).pathname;

test('operator commands use private authorization, explicit confirmation, and the intended endpoint', async () => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {chunks.push(chunk);}
    requests.push({ method: request.method, path: request.url, authorization: request.headers.authorization,
      body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null });
    response.writeHead(200, { 'content-type': 'application/json', connection: 'close' }).end('{"ok":true}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const env = { ...process.env, MODERATION_ADMIN_TOKEN: secret, MODERATION_API_URL: `http://127.0.0.1:${server.address().port}` };
    const run = async (...args) => {
      const result = await execute(process.execPath, [script, ...args], { env, timeout: 5000 });
      assert.deepEqual(JSON.parse(result.stdout), { ok: true });
      assert.equal(result.stdout.includes(secret), false);
    };
    await run('reports');
    await run('reports', 'hidden');
    await run('restrictions');
    await run('hide', id, '--confirm');
    await run('dismiss', id, '--confirm');
    await run('restore', id, '--confirm');
    await run('release', id, '--confirm');
    await run('ng-list');
    await run('ng-add', '禁止語', 'exact', '--confirm');
    await run('ng-remove', id, '--confirm');
    assert.equal(requests.every((request) => request.authorization === `Bearer ${secret}`), true);
    assert.deepEqual(requests.map(({ method, path }) => [method, path]), [
      ['GET', '/moderation/reports?status=open'], ['GET', '/moderation/reports?status=hidden'],
      ['GET', '/moderation/restrictions'], ...Array(4).fill(['POST', '/moderation/reports']),
      ['GET', '/moderation/name-rules'], ['POST', '/moderation/name-rules'], ['DELETE', '/moderation/name-rules'],
    ]);
    assert.deepEqual(requests[6].body, { enforcementId: id, decision: 'restore' });
    assert.deepEqual(requests[8].body, { term: '禁止語', matchType: 'exact' });
    const before = requests.length;
    for (const args of [['hide', id], ['release', 'bad', '--confirm'], ['ng-add', '語', 'regex', '--confirm']]) {
      await assert.rejects(execute(process.execPath, [script, ...args], { env, timeout: 5000 }));
    }
    assert.equal(requests.length, before);
  } finally {await new Promise((resolve) => server.close(resolve));}
});

test('the operator CLI rejects insecure origins and never follows a redirect with administrator credentials', async () => {
  const env = { ...process.env, MODERATION_ADMIN_TOKEN: secret, MODERATION_API_URL: 'http://not-local.example' };
  await assert.rejects(execute(process.execPath, [script, 'reports'], { env, timeout: 5000 }), /HTTPS origin/);
  const server = createServer((_request, response) => {
    response.writeHead(302, { location: 'https://example.com/', connection: 'close' }).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    env.MODERATION_API_URL = `http://127.0.0.1:${server.address().port}`;
    await assert.rejects(execute(process.execPath, [script, 'reports'], { env, timeout: 5000 }), (error) => {
      assert.equal(error.stderr.includes(secret), false);
      return error.stderr.includes('fetch failed');
    });
  } finally {await new Promise((resolve) => server.close(resolve));}
});
