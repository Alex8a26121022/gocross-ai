import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseProduct, crawlCatalogue, createCatalogueService, createProductSearch } from '../catalogue.mjs';

const listing = { id: 'p123', name: '护肤品', hiddenPrice: null };
const detail = { id: 'p123', title: '护肤品 30ml', brandName: '品牌', subTitle: '30ml', description: '官方介绍', price: { interval: [180, 220], currency: 'MOP' }, skus: [{ skuId: 'SKU1', barCode: '123456', price: 180, properties: [] }] };
const extra = { moduleList: [{ title: '介绍', text: '详细介绍', propertyList: [{ name: '容量', value: '30ml' }] }] };

test('清理官网 SK-II 标题的异常问号，保留其他正常问号', async () => {
  assert.equal(normaliseProduct(listing, { ...detail, title: 'SK-II？护肤面膜豪华装' }, extra, 'now').name, 'SK-II护肤面膜豪华装');
  assert.equal(normaliseProduct(listing, { ...detail, title: 'Who am I? 香水' }, extra, 'now').name, 'Who am I? 香水');
  const service = createProductSearch({ fetchImpl: async () => Response.json({ count: 1, recordCount: 1, list: [{ id: 'p123', name: 'SK-II？护肤面膜豪华装' }] }) });
  assert.equal((await service.search('SK-II')).products[0].name, 'SK-II护肤面膜豪华装');
});
test('提取原币价格区间、规格、官方详情、SKU 和来源，不猜测单一价格', () => {
  const product = normaliseProduct(listing, detail, extra, '2026-10-15T14:00:00Z');
  assert.equal(product.price.minimum, 180); assert.equal(product.price.maximum, 220); assert.equal(product.price.currency, 'MOP');
  assert.equal(product.specification, '30ml'); assert.equal(product.sections[0].text, '详细介绍');
  assert.equal(product.variants[0].barcode, '123456'); assert.equal(product.sourceUrl, 'https://glp.cdfgmo.com/item/p123');
});
test('登录价格和不可见商品不读取隐藏价格或 SKU 价格', () => {
  for (const patch of [{ loginShowPrice: true }, { invisible: true }]) {
    const product = normaliseProduct(listing, { ...detail, ...patch }, extra, '2026-10-15');
    assert.equal(product.price, null); assert.deepEqual(product.variants, []); assert.equal(product.priceStatus, 'login_required');
  }
});
test('拒绝不匹配的商品身份和未知币种', () => {
  assert.throws(() => normaliseProduct({ id: '../private' }, detail, extra, 'now'));
  assert.throws(() => normaliseProduct(listing, { ...detail, id: 'p999' }, extra, 'now'));
  assert.throws(() => normaliseProduct(listing, { ...detail, price: { currency: 'UNKNOWN' } }, extra, 'now'));
});
test('价格异常明确缺失，页面介绍去掉脚本标签', () => {
  const product = normaliseProduct(listing, { ...detail, price: { currency: 'MOP', interval: [0, 10] } }, { moduleList: [{ text: '<script>alert(1)</script><b>成分说明</b>' }] }, 'now');
  assert.equal(product.price, null); assert.equal(product.sections[0].text, '成分说明');
});
test('图片型详情保留官网说明链接，不下载图片或伪造文字介绍', () => {
  const product = normaliseProduct(listing, detail, { moduleList: [{ picList: ['https://pic.cdfmembers.com/description.jpg', 'https://untrusted.example/image.jpg'] }] }, 'now');
  assert.deepEqual(product.descriptionImages, ['https://pic.cdfmembers.com/description.jpg']);
});
test('小爬虫只读取首批六件，并在介绍缺失时保留真实公开价格', async () => {
  const requested = [];
  const result = await crawlCatalogue({ fetchImpl: async (url) => {
    requested.push(url);
    if (url.includes('shophomeproducts')) return Response.json({ list: Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}` })) });
    const id = new URL(url).searchParams.get('productid');
    if (url.includes('sqdetail')) return Response.json({ ...detail, id });
    return new Response('', { status: 503 });
  } });
  assert.equal(result.products.length, 6); assert.equal(requested.length, 13); assert.equal(result.failures.length, 6);
  assert.ok(result.products.every((product) => product.price.minimum === 180));
});
test('采集失败保留上一份官方数据，不改为示例商品', async () => {
  let failed = false;
  const service = createCatalogueService({ storage: null, fetchImpl: async (url) => {
    if (failed) throw new Error('offline');
    return Response.json(url.includes('shophomeproducts') ? { list: [listing] } : url.includes('sqdetail') ? detail : extra);
  } });
  const first = await service.refresh(); failed = true; const next = await service.refresh();
  assert.equal(next.status, 'stale'); assert.deepEqual(next.products, first.products);
});

test('公开检索传入任意关键词与页码，结果不限制为六件，重复请求合并缓存', async () => {
  const seen = [];
  const service = createProductSearch({ fetchImpl: async (url, options) => {
    assert.equal(new URL(url).hostname, 'glp.cdfgmo.com');
    seen.push(JSON.parse(options.body));
    return Response.json({ count: 3, recordCount: 45, list: Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, name: `香水${i}`, price: 100, currency: 'MOP' })) });
  } });
  const [first, duplicate] = await Promise.all([service.search('香水', 2), service.search('香水', 2)]);
  assert.deepEqual(first, duplicate); assert.equal(seen.length, 1);
  assert.equal(seen[0].keyword, '香水'); assert.equal(seen[0].pageIndex, 2);
  assert.equal(first.products.length, 20); assert.equal(first.hasMore, true); assert.equal(first.related, false);
  assert.equal(first.products[0].price.minimum, 100);
  await service.search('手表'); assert.equal(seen[1].keyword, '手表');
});
test('零精确匹配时标注官网推荐；隐藏价格缺失，拒绝异常请求和非公开来源', async () => {
  const service = createProductSearch({ fetchImpl: async () => Response.json({ count: 1, recordCount: 0, list: [{ id: 'p123', name: '推荐商品', price: 100, currency: 'MOP', hiddenPrice: true }, { id: '../../secret', name: 'bad' }] }) });
  const result = await service.search('未知商品');
  assert.equal(result.related, true); assert.equal(result.products.length, 1); assert.equal(result.products[0].price, null);
  for (const [q, page] of [['', 1], ['a'.repeat(121), 1], ['x', -1], ['x', 1.5]]) await assert.rejects(service.search(q, page), /INVALID_SEARCH/);
  await assert.rejects(service.detail('https://private.example/'), /INVALID_SEARCH/);
});
test('商品详情按实际商品 ID 查询，不依赖本地预览名单', async () => {
  const service = createProductSearch({ fetchImpl: async (url) => Response.json(url.includes('sqdetail') ? { ...detail, id: 'p98765' } : extra) });
  const result = await service.detail('p98765');
  assert.equal(result.id, 'p98765'); assert.equal(result.detailsLoaded, true); assert.equal(result.sections[0].text, '详细介绍');
});
