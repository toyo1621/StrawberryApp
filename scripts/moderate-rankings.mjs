const args = process.argv.slice(2);
const [command, id, option] = args;
const allowed = ['reports', 'restrictions', 'hide', 'dismiss', 'restore', 'release', 'ng-list', 'ng-add', 'ng-remove'];
if (!allowed.includes(command)) {
  throw new Error('Usage: reports [STATUS] | restrictions | hide|dismiss|restore REPORT_ID --confirm | release RESTRICTION_ID --confirm | ng-list | ng-add TERM exact|contains --confirm | ng-remove RULE_ID --confirm');
}
const writing = !['reports', 'restrictions', 'ng-list'].includes(command);
if (writing && (args.at(-1) !== '--confirm' || (command !== 'ng-add' && !/^[0-9a-f-]{36}$/i.test(id ?? '')))) {
  throw new Error('A valid ID and --confirm are required for a moderation change.');
}
const url = new URL(process.env.MODERATION_API_URL ?? '');
if (url.username || url.password || url.search || url.hash || url.pathname !== '/'
  || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) {
  throw new Error('MODERATION_API_URL must be an HTTPS origin (or local test origin).');
}
const secret = process.env.MODERATION_ADMIN_TOKEN ?? '';
if (secret.length < 32 || secret.length > 256) {throw new Error('Set MODERATION_ADMIN_TOKEN privately in the environment.');}
let path = '/moderation/reports';
if (command === 'restrictions') {path = '/moderation/restrictions';}
if (command.startsWith('ng-')) {path = '/moderation/name-rules';}
if (command === 'reports') {
  const status = id || 'open';
  if (!['open', 'hidden', 'dismissed', 'restored'].includes(status)) {throw new Error('Invalid report status.');}
  path += `?status=${status}`;
}
if (command === 'ng-add' && (!id || !['exact', 'contains'].includes(option))) {throw new Error('Specify the NG term and exact or contains explicitly.');}
const body = !writing ? undefined : command === 'release' ? { enforcementId: id, decision: 'restore' }
  : command === 'ng-add' ? { term: id, matchType: option }
    : command === 'ng-remove' ? { ruleId: id } : { reportId: id, decision: command };
const response = await fetch(new URL(path, url), {
  redirect: 'error',
  method: command === 'ng-remove' ? 'DELETE' : writing ? 'POST' : 'GET',
  headers: { authorization: `Bearer ${secret}`, ...(writing ? { 'content-type': 'application/json' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
  signal: AbortSignal.timeout(10_000),
});
if (!response.ok) {throw new Error(`Moderation request failed (${response.status}). No secret was printed.`);}
console.log(JSON.stringify(await response.json(), null, 2));
