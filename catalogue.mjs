import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalQuery } from './public/identity.mjs';

export const CATALOGUE_SOURCE = 'https://glp.cdfgmo.com';
export const CATALOGUE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const cacheFile = fileURLToPath(new URL('./.runtime/catalogue.json', import.meta.url));
const headers = { 'app-key': 'pcsqbuyer_600667208', 'ymt-pars': 'format=json&appid=77&mchId=600667208&language=zh_HK' };
// 以上是官网公开页面使用的商户标识；不使用登录凭据、会员会话或签名接口。
const text = (value) => typeof value === 'string' ? value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim().slice(0, 12000) : '';
const productTitle = (value) => text(value).replace(/SK-II[?？](?=[\p{Script=Han}])/gu, 'SK-II');

export function createProductSearch({ fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  async function cached(key, request) {
    const saved = cache.get(key);
    if (saved && now() - saved.at < 60000) return saved.value;
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 6) throw new Error('SEARCH_BUSY');
    const promise = request().then((value) => {
      if (cache.size >= 150) cache.delete(cache.keys().next().value);
      cache.set(key, { at: now(), value }); return value;
    }).finally(() => pending.delete(key));
    pending.set(key, promise); return promise;
  }
  async function request(route, body) {
    const response = await fetchImpl(CATALOGUE_SOURCE + route, { method: body ? 'POST' : 'GET', headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('OFFICIAL_SEARCH_UNAVAILABLE');
    return response.json();
  }
  return {
    clear() { cache.clear(); },
    async search(query, page = 1) {
      query = typeof query === 'string' ? canonicalQuery(query) : '';
      if (!query || query.length > 120 || /[\u0000-\u001f]/.test(query) || !Number.isInteger(page) || page < 1 || page > 1000) throw new Error('INVALID_SEARCH');
      return cached(`search:${query}:${page}`, async () => {
        const body = await request('/api/nodesearch/sqsearch', { keyword: query, pageIndex: page, pageSize: 20, refreshProduct: true });
        if (!Array.isArray(body.list)) throw new Error('OFFICIAL_SEARCH_UNAVAILABLE');
        const fetchedAt = new Date(now()).toISOString();
        const products = body.list.filter((item) => /^p\d+$/.test(item.id) && typeof item.name === 'string' && !item.deleted).map((item) => ({
          id: item.id, name: productTitle(item.name), brand: text(item.brandName), brandEn: text(item.brandEnName), specification: '', description: '', sections: [], variants: [], descriptionImages: [],
          price: !item.hiddenPrice && ['MOP', 'HKD', 'CNY'].includes(item.currency) && Number.isFinite(item.price) && item.price > 0 ? { minimum: item.price, maximum: item.price, currency: item.currency, kind: '官网搜索公开标价' } : null,
          priceStatus: item.hiddenPrice ? 'login_required' : Number.isFinite(item.price) && item.price > 0 ? 'public' : 'unavailable',
          image: typeof item.pic === 'string' && item.pic.startsWith('https://pic.cdfmembers.com/') ? item.pic : null,
          sourceUrl: `${CATALOGUE_SOURCE}/item/${item.id}`, fetchedAt, detailsLoaded: false,
        }));
        // 官网在零精确结果时也返回推荐商品，不能冒充同款匹配。
        return { query, page, pages: Number.isInteger(body.count) ? body.count : page, exactCount: Number.isInteger(body.recordCount) ? body.recordCount : null, related: body.recordCount === 0, products, fetchedAt, hasMore: Number.isInteger(body.count) ? page < body.count : body.list.length === 20 };
      });
    },
    async detail(id) {
      if (!/^p\d+$/.test(id)) throw new Error('INVALID_SEARCH');
      return cached(`detail:${id}`, async () => {
        const detail = await request(`/api/prod/sqdetail?MerchantId=600667208&productid=${id}`);
        let extra = null;
        try { extra = await request(`/api/prod/sqproductdescextra?productid=${id}&getRichText=true`); } catch { /* 商品页仍可访问完整图文。 */ }
        return { ...normaliseProduct({ id }, detail, extra, new Date(now()).toISOString()), detailsLoaded: true };
      });
    },
  };
}

export function normaliseProduct(listItem, detail, extra, fetchedAt) {
  if (!/^p\d+$/.test(listItem.id) || detail.id !== listItem.id || typeof detail.title !== 'string' || !detail.title.trim()) throw new Error('CATALOGUE_INVALID_PRODUCT');
  const currency = detail.price?.currency;
  if (!['MOP', 'HKD', 'CNY'].includes(currency)) throw new Error('CATALOGUE_INVALID_CURRENCY');
  const interval = detail.price?.interval;
  const restricted = Boolean(detail.loginShowPrice || listItem.hiddenPrice || detail.invisible);
  const validPrice = Array.isArray(interval) && interval.length === 2 && interval.every((amount) => typeof amount === 'number' && Number.isFinite(amount) && amount > 0) && interval[1] >= interval[0];
  const sections = (Array.isArray(extra?.moduleList) ? extra.moduleList : []).slice(0, 12).map((section) => ({
    title: text(section.title),
    text: [section.text, ...(section.mixedContentList || []).filter((item) => item.type === 'text').map((item) => item.content || item.text)].map(text).filter(Boolean).join('\n'),
    properties: (Array.isArray(section.propertyList) ? section.propertyList : []).slice(0, 20).map((item) => ({ name: text(item.name), value: text(item.value) })).filter((item) => item.name || item.value),
  })).filter((section) => section.text || section.properties.length);
  return {
    id: listItem.id,
    name: productTitle(detail.title),
    brand: text(detail.brandName || listItem.brandName),
    specification: text(detail.subTitle),
    image: (Array.isArray(detail.pics) ? detail.pics : []).find((url) => typeof url === 'string' && url.startsWith('https://pic.cdfmembers.com/')) || null,
    description: text(detail.intro || detail.description),
    sections,
    descriptionImages: [...new Set((Array.isArray(extra?.moduleList) ? extra.moduleList : []).flatMap((section) => section.picList || []))].filter((url) => typeof url === 'string' && url.startsWith('https://pic.cdfmembers.com/')).slice(0, 12),
    price: restricted || !validPrice ? null : { minimum: interval[0], maximum: interval[1], currency, kind: '官网公开标价' },
    priceStatus: restricted ? 'login_required' : validPrice ? 'public' : 'unavailable',
    variants: restricted ? [] : (detail.skus || []).slice(0, 12).map((sku) => ({ sku: text(sku.skuId), barcode: text(sku.barCode), specifications: (sku.properties || []).map((property) => text(property.value || property.name)).filter(Boolean), price: typeof sku.price === 'number' && Number.isFinite(sku.price) && sku.price > 0 ? sku.price : null })),
    sourceUrl: `${CATALOGUE_SOURCE}/item/${listItem.id}`,
    channel: 'cdf中免集團 澳門官方商城',
    region: '澳门',
    fetchedAt,
  };
}

export async function crawlCatalogue({ fetchImpl = fetch, now = Date.now } = {}) {
  async function getJson(route) {
    const response = await fetchImpl(CATALOGUE_SOURCE + route, { headers, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('CATALOGUE_FETCH_FAILED');
    return response.json();
  }
  const listing = await getJson('/api/prod/shophomeproducts?MerchantId=600667208&PageIndex=1&pageSize=6&QueryActivityFlag=true');
  if (!Array.isArray(listing.list) || !listing.list.length) throw new Error('CATALOGUE_EMPTY');
  const products = [];
  const failures = [];
  // 固定首批 6 件，每件依次取详情和介绍；不跟随任意 URL、不遍历整站。
  for (const item of listing.list.slice(0, 6)) {
    if (!/^p\d+$/.test(item.id)) { failures.push('invalid_id'); continue; }
    try {
      const detail = await getJson(`/api/prod/sqdetail?MerchantId=600667208&productid=${item.id}`);
      let extra = null;
      try { extra = await getJson(`/api/prod/sqproductdescextra?productid=${item.id}&getRichText=true`); }
      catch { failures.push(`${item.id}:description_unavailable`); }
      products.push(normaliseProduct(item, detail, extra, new Date(now()).toISOString()));
    } catch { failures.push(`${item.id}:unavailable`); }
  }
  if (!products.length) throw new Error('CATALOGUE_EMPTY');
  return { products, failures, fetchedAt: new Date(now()).toISOString(), source: { name: 'cdf中免集團 澳門官方商城', url: CATALOGUE_SOURCE, region: '澳门' }, scope: '官网首页首批 6 件商品；非全站目录', refreshIntervalMinutes: 360 };
}

export function createCatalogueService({ fetchImpl = fetch, now = Date.now, storage = cacheFile } = {}) {
  let data = null;
  let lastAttemptAt = null;
  let lastError = null;
  let pending;
  const snapshot = () => ({ status: !data ? 'unavailable' : lastError ? 'stale' : data.failures?.length ? 'partial' : 'ok', ...data, lastAttemptAt, nextRefreshAt: lastAttemptAt ? new Date(Date.parse(lastAttemptAt) + CATALOGUE_INTERVAL_MS).toISOString() : null, error: lastError });
  async function refresh() {
    if (pending) return pending;
    lastAttemptAt = new Date(now()).toISOString();
    pending = (async () => {
      try {
        data = await crawlCatalogue({ fetchImpl, now });
        lastError = null;
        if (storage) {
          await mkdir(path.dirname(storage), { recursive: true });
          await writeFile(`${storage}.tmp`, JSON.stringify(data, null, 2));
          await rename(`${storage}.tmp`, storage);
        }
      } catch { lastError = 'OFFICIAL_CATALOGUE_UNAVAILABLE'; }
      return snapshot();
    })().finally(() => { pending = null; });
    return pending;
  }
  async function get() {
    if (!lastAttemptAt || now() - Date.parse(lastAttemptAt) >= CATALOGUE_INTERVAL_MS) await refresh();
    return snapshot();
  }
  async function start() {
    if (storage) {
      try {
        const saved = JSON.parse(await readFile(storage, 'utf8'));
        if (saved.source?.url === CATALOGUE_SOURCE && Array.isArray(saved.products) && saved.products.length && saved.products.every((p) => /^p\d+$/.test(p.id) && p.sourceUrl === `${CATALOGUE_SOURCE}/item/${p.id}`)) data = saved;
        if (data) data.products = data.products.map((product) => ({ ...product, name: productTitle(product.name) }));
      } catch { /* 初次采集没有缓存。 */ }
    }
    if (data && now() - Date.parse(data.fetchedAt) < CATALOGUE_INTERVAL_MS) { lastAttemptAt = data.fetchedAt; return snapshot(); }
    return refresh();
  }
  return { get, refresh, start };
}
