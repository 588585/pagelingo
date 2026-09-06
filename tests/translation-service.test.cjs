const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadService(fetch, timers = {}) {
  const listeners = [];
  const context = vm.createContext({
    fetch, AbortController, setTimeout, clearTimeout, ...timers,
    console: { error() {} },
    chrome: { runtime: { onMessage: { addListener: fn => listeners.push(fn) } } },
    translationCache: { get: async () => undefined, set() {} },
    twpLang: { getAlternativeService: (_, service) => service },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/background/translationService.js'), 'utf8'), context);
  return { service: vm.runInContext('translationService', context), listeners };
}

test('a failed request can be retried without reloading the extension', async () => {
  let calls = 0;
  const { service } = loadService(async () => {
    if (++calls === 1) throw new Error('Network unavailable');
    return { ok: true, json: async () => [['<pre>你好</pre>', 'en']] };
  });
  const translate = () => service.translateHTML('google', 'auto', 'zh-CN', [['Hello']]);
  await assert.rejects(translate());
  assert.equal(JSON.stringify(await translate()), JSON.stringify([['你好']]));
  assert.equal(calls, 2);
});

test('HTTP failures are reported to the caller with the service and status', async () => {
  const { service } = loadService(async () => ({ ok: false, status: 429, statusText: 'Too Many Requests' }));
  await assert.rejects(service.translateHTML('google', 'auto', 'zh-CN', [['Hello']]), /google.*429/i);
});

test('translation failures are returned through the extension message channel', async () => {
  const { listeners } = loadService(async () => { throw new Error('Network unavailable'); });
  const response = await new Promise(resolve => listeners[0]({
    action: 'translateHTML', translationService: 'google', targetLanguage: 'zh-CN', sourceArray2d: [['Hello']],
  }, { tab: { incognito: false } }, resolve));
  assert.match(response.error, /Network unavailable/);
});

test('concurrent identical requests still share a successful request', async () => {
  let calls = 0;
  const { service } = loadService(async () => {
    calls++;
    return { ok: true, json: async () => [['<pre>你好</pre>', 'en']] };
  });
  const results = await Promise.all([0, 1].map(() => service.translateHTML('google', 'auto', 'zh-CN', [['Hello']])));
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(results), JSON.stringify([[['你好']], [['你好']]]));
});

test('Google translates a public sample through the real service', { skip: !process.env.PAGELINGO_TEST_LIVE }, async () => {
  const { service } = loadService(fetch);
  const result = await service.translateHTML('google', 'auto', 'zh-CN', [['Hello world']]);
  assert.match(result[0][0], /[\u3400-\u9fff]/);
});

test('a stalled network request is aborted and can be retried', async () => {
  let calls = 0;
  const { service } = loadService(async (_, options) => {
    if (++calls === 1) return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('Request timed out')));
    });
    return {ok: true, json: async () => [['<pre>你好</pre>', 'en']]};
  }, {setTimeout: callback => setTimeout(callback, 1)});
  const translate = () => service.translateHTML('google', 'auto', 'zh-CN', [['Hello']]);
  await assert.rejects(translate(), /timed out/);
  assert.equal(JSON.stringify(await translate()), JSON.stringify([['你好']]));
});
