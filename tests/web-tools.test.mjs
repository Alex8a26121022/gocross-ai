import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWebTools, publicSourceUrl } from '../web-tools.mjs';

const result = { title: 'Official guidance', url: 'https://www.customs.gov.cn/page', snippet: 'Public information', date: null };
test('来源只允许 HTTPS 官方域名，不接受相似域、凭据或内部地址', () => {
  assert.equal(publicSourceUrl(result.url, 'policy'), result.url);
  for (const url of ['http://www.customs.gov.cn/page', 'https://customs.gov.cn.evil.example/', 'https://user:secret@customs.gov.cn/', 'https://127.0.0.1/', 'https://customs.gov.cn:444/']) assert.equal(publicSourceUrl(url, 'policy'), null);
});
test('Search 限定来源、最多五条、只作为线索；Fetch 仅能读取本轮发现来源', async () => {
  const calls = [];
  const web = createWebTools({ key: 'test-only', fetchImpl: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => url.endsWith('/search') ? { results: [result, { ...result, url: 'https://evil.example/' }] } : { title: result.title, content: 'x'.repeat(7000) } };
  } });
  await assert.rejects(web.fetchPage(result.url), /FETCH_ONLY_DISCOVERED/);
  const found = await web.search('澳门旅客购物', 'policy');
  assert.equal(found.length, 1); assert.match(found[0].evidence, /discovery_only/);
  assert.equal(calls[0].url, 'https://api.deepseek.com/v1/tools/search'); assert.equal(calls[0].body.need_content, false); assert.equal(calls[0].body.count, 5); assert.match(calls[0].body.query, /site:customs.gov.cn/);
  const page = await web.fetchPage(found[0].url); assert.equal(page.truncated, true); assert.equal(page.content.length, 6500); assert.match(page.evidence, /not_structured/);
});
test('搜索发现京东链接后仍不代理抓取登录/风控来源', async () => {
  let calls = 0;
  const web = createWebTools({ key: 'x', fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ results: [{ ...result, url: 'https://item.jd.com/123.html' }] }) }; } });
  const found = await web.search('SK-II', 'products');
  await assert.rejects(web.fetchPage(found[0].url), /FETCH_PLATFORM_REQUIRES_OFFICIAL_ACCESS/); assert.equal(calls, 1);
});
test('每轮最多三次 Search/Fetch，错误脱敏且不重试', async () => {
  let calls = 0;
  const web = createWebTools({ key: 'secret', fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ results: [] }) }; } });
  for (let i = 0; i < 3; i++) await web.search('澳门', 'stores');
  await assert.rejects(web.search('澳门', 'stores'), /WEB_LOOKUP_BUDGET/); assert.equal(calls, 3);
  for (const status of [401, 402, 403, 404, 429, 500]) await assert.rejects(createWebTools({ key: 'secret', fetchImpl: async () => ({ ok: false, status }) }).search('澳门', 'stores'), (error) => error.code.startsWith('WEB_') && !error.message.includes('secret'));
});
test('无效查询不能去掉服务器限定域名', async () => {
  const web = createWebTools({ key: 'x', fetchImpl: async () => { throw Error('should not fetch'); } });
  for (const query of ['', 'site:evil.example', 'x'.repeat(61), 'https://evil.example/']) await assert.rejects(web.search(query, 'products'), /INVALID_WEB_SEARCH/);
  await assert.rejects(web.search('澳门', 'unknown'), /INVALID_WEB_SEARCH/);
});
