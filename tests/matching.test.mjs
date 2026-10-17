import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankProducts, matchProducts } from '../matching.mjs';

const item = { brand: 'ESTÉE LAUDER', product_name: 'Nutritious Radiant Essence Lotion', category: 'lotion', search_keywords: ['雅诗兰黛', '鲜活亮采精华水'] };
const products = [
  { id: 'p1', name: '雅诗兰黛特润眼霜', brand: '雅诗兰黛', brandEn: 'ESTEE LAUDER' },
  { id: 'p2', name: '雅诗兰黛鲜活亮采精华水 200ml', brand: '雅诗兰黛', brandEn: 'ESTEE LAUDER' },
  { id: 'p3', name: '古驰香水', brand: '古驰', brandEn: 'GUCCI' },
];
test('去除音调与标点，中文片段和品类让对应护肤水排在眼霜前', () => {
  const ranked = rankProducts(item, products);
  assert.equal(ranked[0].id, 'p2');
  assert.equal(ranked.some((product) => product.id === 'p3'), false);
});
test('多个检索词自动搜索、去重排序并读取官网详情，无需用户确认', async () => {
  const queries = []; const details = [];
  const result = await matchProducts(item, { search: async (query) => { queries.push(query); return { products }; }, detail: async (id) => { details.push(id); return { id, specification: '200ml', detailsLoaded: true }; } });
  assert.equal(queries.length, 3); assert.equal(result.products[0].id, 'p2');
  assert.equal(result.products[0].specification, '200ml'); assert.deepEqual(details, ['p2']);
});
test('官网推荐与目标无关时不强行匹配，完全不可连接时返回错误', async () => {
  const result = await matchProducts({ product_name: '无线耳机', brand: 'Sony' }, { search: async () => ({ products: [products[2]] }), detail: () => assert.fail('must not request') });
  assert.deepEqual(result.products, []);
  assert.deepEqual(rankProducts({ brand: 'CHANEL', product_name: 'perfume' }, [products[2]]), []);
  await assert.rejects(matchProducts(item, { search: async () => { throw Error('offline'); } }), /OFFICIAL_SEARCH_UNAVAILABLE/);
});
test('部分官网搜索或详情失败时保留已获取商品，不生成虚构详情', async () => {
  const result = await matchProducts(item, { search: async (query) => { if (query === '雅诗兰黛') throw Error('offline'); return { products }; }, detail: async () => { throw Error('offline'); } });
  assert.equal(result.products[0].id, 'p2'); assert.equal(result.products[0].detailsLoaded, undefined);
});
test('检索边界拒绝错误字段与超长数组', async () => {
  for (const bad of [null, [], { brand: {} }, { search_keywords: 'x' }, { visible_text: Array(21).fill('x') }]) await assert.rejects(matchProducts(bad, {}), /INVALID_SEARCH/);
});

test('识图剔除同品牌其他商品与规格冲突；部分搜索失败不当作确定无匹配', async () => {
  const target = { brand: 'SK-II', product_name: 'SK-II 清莹嫩肤露', specification: '160ml', search_keywords: ['清莹嫩肤露'] };
  const wrongSize = { id: 'p1', name: 'SK-II 清莹嫩肤露', brand: 'SK-II', specification: '230ml' };
  const result = await matchProducts(target, { search: async () => ({ products: [wrongSize] }), detail: async () => wrongSize });
  assert.deepEqual(result.products, []);
  const partial = await matchProducts(target, { search: async (q) => { if (q === 'SK-II') return { products: [] }; throw Error('offline'); } });
  assert.deepEqual(partial.products, []);
  assert.equal(partial.sourceError, true);
});
