import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cdfOffer, comparableOffers, createCommerceService, parsePublicOffers, platformUrl } from '../commerce.mjs';
import { DAILY_PRICE_AGE } from '../public/quotes.mjs';

const time = Date.parse('2026-10-16T05:00:00Z');
const capturedAt = new Date(time).toISOString();
const product = { id: 'p1', name: 'SK-II 清莹嫩肤露', brand: 'SK-II', specification: '160ml', sourceUrl: 'https://glp.cdfgmo.com/', price: { minimum: 600, maximum: 600, currency: 'MOP' }, fetchedAt: capturedAt };
const fx = { rates: { MOP: { cnyPerUnit: 0.83 } } };
const structured = (changes = {}) => `<script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: product.name, brand: 'SK-II', size: '160ml', offers: { '@type': 'Offer', price: 480, priceCurrency: 'CNY', url: 'https://item.jd.com/123.html' }, ...changes })}</script>`;

test('仅解析平台公开 JSON-LD 固定价格，不执行脚本或混入不明链接、区间与资格价', () => {
  assert.equal(parsePublicOffers(structured(), 'jd', capturedAt)[0].amount, 480);
  assert.equal(parsePublicOffers('<script>alert(1)</script>', 'jd', capturedAt).length, 0);
  for (const offer of [{ price: 0 }, { price: -1 }, { price: '450-500' }, { priceCurrency: 'USD' }, { url: 'https://item.jd.com.evil.test/1' }, { url: 'javascript:alert(1)' }, { '@type': 'AggregateOffer' }, { eligibleCustomerType: 'new' }, { availability: 'https://schema.org/OutOfStock' }]) {
    assert.deepEqual(parsePublicOffers(structured({ offers: { '@type': 'Offer', price: 480, priceCurrency: 'CNY', url: 'https://item.jd.com/123.html', ...offer } }), 'jd', capturedAt), []);
  }
  assert.deepEqual(parsePublicOffers(structured({ name: 'SK-II 定金 160ml' }), 'jd', capturedAt), []);
  assert.equal(platformUrl('https://name:pass@item.jd.com/1', 'jd'), null);
  assert.equal(cdfOffer({ ...product, price: { minimum: 10, maximum: 100, currency: 'MOP' } }), null);
});

test('最低价只在同款、同规格、新鲜报价间排序，缺失汇率不产生零价', () => {
  const cdf = cdfOffer(product), domestic = parsePublicOffers(structured(), 'jd', capturedAt)[0];
  const offers = comparableOffers(product, [cdf, domestic, { ...domestic, amount: 1, specification: '28ml*20' }, { ...domestic, amount: 2, capturedAt: new Date(time - DAILY_PRICE_AGE).toISOString() }, { ...domestic, amount: 3, capturedAt: new Date(time + 6000).toISOString() }], fx, time);
  assert.deepEqual(offers.map((o) => o.cny), [480, 498]);
  assert.equal(comparableOffers(product, [cdf], null, time)[0].cny, null);
  assert.equal(comparableOffers(product, [domestic], fx, time + DAILY_PRICE_AGE - 1).length, 1);
  assert.equal(comparableOffers(product, [cdf], fx, time + 120000).length, 0);
});

function service(fetchImpl, extra = {}) {
  return createCommerceService({ catalogue: { refresh: async () => ({ products: [product] }) }, productSearch: { clear() {}, search: async (q) => ({ query: q, products: [product] }), detail: async () => product }, rates: { get: async () => fx }, now: () => time, fetchImpl, ...extra });
}

test('多平台同款合并一张卡；无关推荐不进入搜索或最低价', async () => {
  const commerce = service(async (url) => ({ ok: true, url, text: async () => url.includes('jd.com') ? structured() + structured({ name: '无线耳机', brand: 'SONY', offers: { price: 100, priceCurrency: 'CNY', url: 'https://item.jd.com/456.html' } }) : '' }));
  const result = await commerce.search('SK II');
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].offers.length, 2);
  assert.equal(result.products[0].bestOffer.channel, '京东');
  assert.equal(result.products[0].bestOffer.cny, 480);
  const compare = await commerce.compare('p1');
  assert.equal(compare.product.id, 'p1');
  assert.equal(compare.sources.length, 4);
});

test('登录验证、动态页面、禁用来源不生成报价；刷新不绕过每日采集限制', async () => {
  let calls = 0;
  const commerce = service(async (url) => { calls++; return { ok: true, url: 'https://cfe.m.jd.com/risk_handler', text: async () => structured() }; }, { disabledPlatforms: new Set(['taobao', 'tmall']) });
  const [a] = await Promise.all([commerce.search('SK II'), commerce.search('SK-II')]);
  assert.equal(calls, 1);
  assert.equal(a.products[0].offers.length, 1);
  assert.equal(a.sources.find((s) => s.id === 'jd').status, 'verification_required');
  assert.equal(a.sources.find((s) => s.id === 'taobao').status, 'browser_restricted');
  await commerce.search('SK-II'); assert.equal(calls, 1);
  await commerce.search('SK-II', 1, null, true); assert.equal(calls, 1);
  const dynamic = await service(async (url) => ({ ok: true, url, text: async () => '<html>Loading</html>' })).search('SK II');
  assert.equal(dynamic.sources.find((s) => s.id === 'jd').status, 'browser_required');
  for (const query of ['', null, 'x'.repeat(121), 'a\u0001']) await assert.rejects(commerce.search(query), /INVALID_SEARCH/);
});

test('识图只接收对应商品与规格，中免无匹配才提供线上入口，不宣称平台有货', async () => {
  const item = { is_product: true, brand: 'SK-II', product_name: 'SK-II 清莹嫩肤露', specification: '160ml', search_keywords: ['SK-II 清莹嫩肤露'] };
  const unrelated = { ...product, name: 'SK-II 护肤面膜', specification: '28ml*20' };
  const queries = [];
  const commerce = service(async (url) => { queries.push(url); return { ok: true, url, text: async () => structured({ description: '官方商品详情' }) + structured({ size: '230ml', offers: { price: 1, priceCurrency: 'CNY', url: 'https://item.jd.com/456.html' } }) }; }, { productSearch: { clear() {}, search: async () => ({ products: [unrelated] }), detail: async () => unrelated }, disabledPlatforms: new Set(['taobao', 'tmall']) });
  const result = await commerce.search('SK-II', 1, item);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].bestOffer.amount, 480);
  assert.equal(result.products[0].description, '官方商品详情');
  assert.equal(result.onlineFallback.reason, 'cdf_no_match');
  assert.equal(result.onlineFallback.platforms.length, 3);
  assert.ok(!('inStock' in result.onlineFallback));
  assert.match(new URL(queries[0]).searchParams.get('keyword'), /160ml/);
  assert.equal(result.sources.find((source) => source.id === 'taobao').checkedAt, null);
  const home = await commerce.home();
  assert.equal(home.products[0].bestOffer.amount, 480);
});

test('非商品、仅品牌识别不触发商城采集；官网故障不误报无同款', async () => {
  let calls = 0;
  const commerce = service(async () => { calls++; throw Error('offline'); });
  for (const item of [{ is_product: false, product_name: '风景照片' }, { is_product: true, brand: 'SK-II', product_name: 'SK II' }]) {
    const result = await commerce.search('SK-II', 1, item);
    assert.equal(result.insufficientIdentity, true);
    assert.equal(result.onlineFallback, null);
    assert.deepEqual(result.products, []);
  }
  assert.equal(calls, 0);
  const failed = service(async () => { throw Error('offline'); }, { productSearch: { search: async () => { throw Error('offline'); } } });
  const result = await failed.search('SK-II', 1, { product_name: 'SK-II 清莹嫩肤露', brand: 'SK-II' });
  assert.equal(result.onlineFallback, null);
  assert.equal(result.sourceError, true);
});

test('首页复用每日快照，同一平台商品多关键词采到不同价格时只用最近一次', async () => {
  let clock = time, amount = 480;
  const commerce = service(async (url) => ({ ok: true, url, text: async () => structured({ offers: { price: amount, priceCurrency: 'CNY', url: 'https://item.jd.com/123.html' } }) }), { now: () => clock, disabledPlatforms: new Set(['taobao', 'tmall']) });
  await commerce.search('SK II');
  clock += 1000; amount = 500;
  await commerce.search('清莹嫩肤露');
  const home = await commerce.home();
  const offers = home.products[0].offers;
  assert.equal(offers.filter((offer) => offer.platform === 'jd').length, 1);
  assert.equal(offers.find((offer) => offer.platform === 'jd').amount, 500);
  assert.equal(home.products[0].bestOffer.platform, 'cdf');
  assert.equal(new Set(home.sources.map((source) => source.id)).size, home.sources.length);
});
