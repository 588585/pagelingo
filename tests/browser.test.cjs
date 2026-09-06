const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Point PLAYWRIGHT_MODULE at an installed Playwright package when it is not local.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
let browser;
test.before(async () => { browser = await chromium.launch({ channel: process.env.TEST_BROWSER_CHANNEL || 'msedge', headless: true }); });
test.after(async () => { if (browser) await browser.close(); });

async function fixture(t, html, url = 'https://github.com/codespaces', detectedLanguage = 'en', fullTranslator = false) {
  const page = await browser.newPage();
  page.on('pageerror', error => console.error('Fixture page error:', error.message));
  t.after(() => page.close());
  await page.route('**/*', route => route.fulfill({
    contentType: 'text/html', body: html,
    headers: { 'Content-Security-Policy': "script-src 'none'" },
  }));
  const bootstrap = `
    window.detectedLanguage = ${JSON.stringify(detectedLanguage)};
    const settings = {neverTranslateLangs: [], targetLanguage: 'zh-CN', targetLanguages: ['zh-CN'], isShowDualLanguage: 'no',
      translateTag_pre: 'no', specialRules: [], pageTranslatorService: 'google', customDictionary: new Map(),
      translateDynamicallyCreatedContent: 'yes', alwaysTranslateSites: [], neverTranslateSites: [], alwaysTranslateLangs: []};
    window.twpConfig = {get: key => settings[key], set: (key, value) => {settings[key] = value}, onReady: () => Promise.resolve(), onChanged() {}};
    window.twpLang = { fixTLanguageCode: language => language };
    window.translationStates = [];
    window.failTranslation = false;
    window.showOriginal = {enable() {}, disable() {}, add() {}};
    window.chrome = {extension: {inIncognitoContext: false}, runtime: {
      onMessage: {addListener() {}},
      sendMessage: (request, done = () => {}) => {
        if (request.action === 'getTabUrl') return done(location.href);
        if (request.action === 'detectLanguage' || request.action === 'detectTabLanguage') return done(window.detectedLanguage);
        if (request.action === 'setPageLanguageState') return window.translationStates.push(request.pageLanguageState);
        if (request.action === 'translateHTML') return done(window.failTranslation ? {error: 'Temporary connection failure'} : request.sourceArray2d.map(row => row.map(text => '译：' + text)));
        if (request.action === 'translateText') return done(request.sourceArray.map(text => '译：' + text));
        if (request.action === 'translateSingleText') return done('译：' + request.source);
        done();
      }
    }};
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.cspViolations.push(event.violatedDirective));
  `;
  const files = ['src/lib/specialRules.js', 'src/contentScript/enhance.js'];
  if (fullTranslator) files.push('src/contentScript/pageTranslator.js');
  const sources = files.map(file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8'));
  await page.addInitScript({ content: bootstrap + '\n' + sources.join('\n') + '\nwindow.getNodesThatNeedToTranslate = getNodesThatNeedToTranslate;' + (fullTranslator ? '\nwindow.pageTranslator = pageTranslator;' : '') });
  await page.goto(url);
  if (fullTranslator) await page.waitForFunction(() => typeof pageTranslator.translatePage === 'function');
  return page;
}

async function selected(page, selector = 'body') {
  return page.evaluate(async selector => (await getNodesThatNeedToTranslate(document.querySelector(selector), {
    tabUrl: location.href, tabHostName: location.hostname, twpConfig,
  })).map(node => node.id), selector);
}

test('GitHub pages without Markdown fall back to ordinary paragraphs under strict CSP', async t => {
  const page = await fixture(t, '<main><h1 id="title">Your development environment</h1><p id="description">Create a development environment for your projects.</p></main>');
  assert.ok((await selected(page)).includes('description'));
  assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
});

test('a newly added paragraph is considered even when it is the selection root', async t => {
  const page = await fixture(t, '<main><p id="new">This paragraph was inserted dynamically.</p></main>', 'https://example.org/article');
  assert.deepEqual(await selected(page, '#new'), ['new']);
});

test('a Markdown container passed as the root is recognized', async t => {
  const page = await fixture(t, '<article class="markdown-body"><p id="readme">Read the documentation for this project.</p></article>', 'https://github.com/588585/pagelingo');
  assert.deepEqual(await selected(page, '.markdown-body'), ['readme']);
});

test('uncertain language detection does not silently discard a paragraph', async t => {
  const page = await fixture(t, '<article class="markdown-body"><p id="readme">Read the documentation.</p></article>', undefined, null);
  assert.deepEqual(await selected(page), ['readme']);
});

test('translate=no and editable ancestors remain excluded in fallback selection', async t => {
  const page = await fixture(t, '<main><p id="yes">Translate this description.</p><div translate="no"><p id="no">Leave this content unchanged.</p></div><div contenteditable="true"><p id="edit">Do not translate editing content.</p></div></main>');
  const nodes = await selected(page);
  assert.ok(nodes.includes('yes'));
  assert.ok(!nodes.includes('no'));
  assert.ok(!nodes.includes('edit'));
});

test('TIMI-style footer widget text is included outside the main article', async t => {
  const page = await fixture(t, `<main><p>${'The main research article has substantial content. '.repeat(30)}</p></main>
    <div class="widget-wrapper"><section class="widget widget_text"><h2 id="widget-title">Search Our Trials</h2>
    <div class="textwidget"><p id="widget-text">Search the entire index using <a href="/keyword-search/">KEYWORDS</a>.</p></div></section></div>`, 'https://timi.org/');
  const nodes = await selected(page);
  assert.ok(nodes.includes('widget-title'));
  assert.ok(nodes.includes('widget-text'));
});

test('a paragraph taller than the viewport is translated while its edges are off screen', async t => {
  const page = await fixture(t, '<p id="long" style="height:2000px;margin-top:-200px">A long visible paragraph.</p>', 'https://example.org/article', 'en', true);
  await page.evaluate(() => pageTranslator.translatePage('zh-CN'));
  await page.waitForFunction(() => document.querySelector('#long').textContent.includes('译：'));
});

test('a failed translation shows an error and can be retried on the same page', async t => {
  const page = await fixture(t, '<main><p id="paragraph">Translate this paragraph.</p></main>', 'https://example.org/article', 'en', true);
  await page.evaluate(async () => { twpConfig.set('isShowDualLanguage', 'yes'); window.failTranslation = true; await pageTranslator.translatePage('zh-CN'); });
  await page.waitForFunction(() => window.translationStates.at(-1) === 'error');
  await page.evaluate(async () => { window.failTranslation = false; await pageTranslator.translatePage('zh-CN'); });
  await page.waitForFunction(() => document.querySelector('#paragraph font')?.textContent.includes('译：'));
  assert.equal(await page.locator('[data-translationmark="copiedNode"]').count(), 1);
  assert.equal(await page.locator('[data-translationmark="copiedNode"]').textContent(), 'Translate this paragraph.');
});

test('a paragraph inserted after translation starts is translated automatically', async t => {
  const page = await fixture(t, '<main><p>Existing article text.</p></main>', 'https://example.org/article', 'en', true);
  await page.evaluate(() => pageTranslator.translatePage('zh-CN'));
  await page.waitForFunction(() => document.querySelector('main').textContent.includes('译：'));
  await page.evaluate(() => {
    const paragraph = document.createElement('p');
    paragraph.id = 'added'; paragraph.textContent = 'Newly loaded article text.';
    document.querySelector('main').append(paragraph);
  });
  await page.waitForFunction(() => document.querySelector('#added').textContent.includes('译：'));
});
