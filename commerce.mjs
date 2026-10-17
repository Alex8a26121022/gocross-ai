import { canonicalQuery, sameProduct } from './public/identity.mjs';
import { searchProductsText, matchProducts, rankProducts, hasProductIdentity, matchesIdentification } from './matching.mjs';
import { createDailyMarket } from './daily-market.mjs';
import { usableQuote } from './public/quotes.mjs';

export const platforms = [
  { id: 'jd', name: '京东', search: (q) => `https://search.jd.com/Search?${new URLSearchParams({ keyword: q, enc: 'utf-8' })}`, hosts: ['item.jd.com', 'item.m.jd.com'] },
  { id: 'taobao', name: '淘宝', search: (q) => `https://s.taobao.com/search?${new URLSearchParams({ q })}`, hosts: ['item.taobao.com'] },
  { id: 'tmall', name: '天猫', search: (q) => `https://list.tmall.com/search_product.htm?${new URLSearchParams({ q })}`, hosts: ['detail.tmall.com', 'chaoshi.detail.tmall.com'] },
];

export function platformUrl(url, platform) {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password && platforms.find((p) => p.id === platform)?.hosts.includes(parsed.hostname) ? parsed.href : null; } catch { return null; }
}

export function parsePublicOffers(html, platform, capturedAt) {
  const results = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value['@type'] === 'Product' && typeof value.name === 'string') {
      for (const offer of Array.isArray(value.offers) ? value.offers : value.offers ? [value.offers] : []) {
        const price = typeof offer.price === 'number' || typeof offer.price === 'string' && /^\d+(?:\.\d{1,2})?$/.test(offer.price) ? Number(offer.price) : NaN;
        const url = platformUrl(offer.url || value.url, platform);
        if (!url || offer['@type'] === 'AggregateOffer' || offer.eligibleCustomerType || !Number.isFinite(price) || price <= 0 || offer.priceCurrency !== 'CNY' || /OutOfStock|PreOrder|Discontinued/.test(offer.availability || '') || /定金|订金|二手|小样|试用装|预售|会员专享|新客专享/.test(value.name)) continue;
        const name = value.name.replace(/<[^>]*>/g, '').slice(0, 300);
        const description = typeof value.description === 'string' ? value.description.replace(/<[^>]*>/g, '').slice(0, 4000) : '';
        results.push({ id: `${platform}:${url}`, name, description, brand: typeof value.brand === 'string' ? value.brand : value.brand?.name || '', specification: typeof value.size === 'string' ? value.size : '', platform, channel: platforms.find((p) => p.id === platform).name, method: 'online', amount: price, currency: 'CNY', url, capturedAt, kind: 'public', variants: value.gtin13 ? [{ barcode: String(value.gtin13) }] : [] });
      }
    }
    for (const item of Object.values(value)) if (item && typeof item === 'object') { if (Array.isArray(item)) item.forEach(walk); else walk(item); }
  }
  for (const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(script[1])); } catch { /* 页面脚本仅按 JSON 读取，绝不执行。 */ }
  }
  return [...new Map(results.map((offer) => [offer.id, offer])).values()];
}

export function cdfOffer(product) {
  const price = product.price;
  if (!price || price.minimum !== price.maximum || price.minimum <= 0) return null;
  return { id: `cdf:${product.id}`, name: product.name, brand: product.brand, specification: product.specification, variants: product.variants || [], platform: 'cdf', channel: '中免澳门官网', method: 'online', amount: price.minimum, currency: price.currency, url: product.sourceUrl, capturedAt: product.fetchedAt, kind: 'public' };
}

export function comparableOffers(product, offers, fx, now = Date.now()) {
  return offers.filter((offer) => offer.kind === 'public' && sameProduct(product, offer) && Number.isFinite(offer.amount) && offer.amount > 0 && usableQuote(offer, now)).map((offer) => {
    const rate = offer.currency === 'CNY' ? 1 : fx?.rates?.[offer.currency]?.cnyPerUnit;
    return { ...offer, cny: Number.isFinite(rate) && rate > 0 ? Math.round(offer.amount * rate * 100) / 100 : null };
  }).sort((a, b) => (a.cny ?? Infinity) - (b.cny ?? Infinity));
}

export function createCommerceService({ catalogue, productSearch, rates, fetchImpl = fetch, now = Date.now, disabledPlatforms = new Set(), cacheFile = null } = {}) {
  async function collect(platformId, query) {
    const platform = platforms.find((item) => item.id === platformId);
    if (disabledPlatforms.has(platform.id)) return { id: platform.id, name: platform.name, status: 'browser_restricted', offers: [], searchUrl: platform.search(query), checkedAt: null };
    const url = platform.search(query), capturedAt = new Date(now()).toISOString();
    let data;
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'text/html' } });
      const html = await response.text();
      const blocked = !response.ok || /risk_handler|passport|captcha|verify|punish|login\.(?:taobao|tmall)\.com/i.test(response.url);
      const offers = blocked ? [] : parsePublicOffers(html, platform.id, capturedAt);
      data = { id: platform.id, name: platform.name, status: blocked ? 'verification_required' : offers.length ? 'ok' : 'browser_required', offers, searchUrl: url, checkedAt: capturedAt };
    } catch { data = { id: platform.id, name: platform.name, status: 'unavailable', offers: [], searchUrl: url, checkedAt: capturedAt }; }
    return data;
  }
  const daily = createDailyMarket({ collect, now, cacheFile });
  function readPlatform(platform, query) {
    if (disabledPlatforms.has(platform.id)) return collect(platform.id, query);
    return daily.get(platform.id, query);
  }
  async function attach(result, domestic = [], fx = null) {
    const validOffers = [...new Map(domestic.flatMap((source) => source.offers).filter((offer) => usableQuote(offer, now()) && platformUrl(offer.url, offer.platform) && offer.kind === 'public' && Number.isFinite(offer.amount) && offer.amount > 0 && offer.currency === 'CNY').sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt)).map((offer) => [offer.id, offer])).values()];
    const domesticOffers = (result.query ? rankProducts(result.identification || { product_name: result.query }, validOffers) : validOffers.filter((offer) => result.products.some((product) => sameProduct(product, offer)))).filter((offer) => !result.identification || matchesIdentification(result.identification, offer));
    const allOffers = result.products.map(cdfOffer).filter(Boolean).concat(domesticOffers);
    const unique = result.products.filter((product, index, items) => !items.slice(0, index).some((previous) => sameProduct(previous, product)));
    const products = unique.map((product) => {
      const offers = comparableOffers(product, allOffers, fx, now());
      // 同一官网 SKU 本身可比较；其他平台必须通过规格与身份匹配。
      const own = cdfOffer(product);
      if (own && !offers.some((offer) => offer.id === own.id) && usableQuote(own, now())) {
        const rate = own.currency === 'CNY' ? 1 : fx?.rates?.[own.currency]?.cnyPerUnit;
        offers.push({ ...own, cny: Number.isFinite(rate) && rate > 0 ? Math.round(own.amount * rate * 100) / 100 : null });
        offers.sort((a, b) => (a.cny ?? Infinity) - (b.cny ?? Infinity));
      }
      return { ...product, offers, bestOffer: offers.find((offer) => offer.cny !== null) || offers[0] || null };
    });
    for (const offer of domesticOffers) {
      if (products.some((product) => sameProduct(product, offer))) continue;
      const product = { id: offer.id, name: offer.name, description: offer.description, brand: offer.brand, specification: offer.specification, sourceUrl: offer.url, variants: offer.variants, sections: [], descriptionImages: [], offers: comparableOffers(offer, domesticOffers, fx, now()) };
      if (!product.offers.some((item) => item.id === offer.id)) product.offers.push({ ...offer, cny: offer.amount });
      product.bestOffer = product.offers[0] || null; products.push(product);
    }
    const sources = [{ id: 'cdf', name: '中免澳门官网', status: result.sourceError ? 'unavailable' : 'ok', checkedAt: new Date(now()).toISOString() }, ...new Map(domestic.slice().sort((a, b) => (Date.parse(a.checkedAt) || 0) - (Date.parse(b.checkedAt) || 0)).map(({ offers, ...source }) => [source.id, source])).values()];
    const onlineFallback = result.matched && !result.sourceError && !result.products.length && !result.insufficientIdentity
      ? { reason: 'cdf_no_match', query: result.query, platforms: platforms.map((platform) => ({ id: platform.id, name: platform.name, searchUrl: platform.search(result.marketQuery || result.query) })) }
      : null;
    const { identification, marketQuery, ...publicResult } = result;
    return { ...publicResult, products, sources, onlineFallback, priceCadence: 'daily' };
  }
  return {
    start: () => daily.start(),
    stop: () => daily.stop(),
    async home() {
      const [result, fx, cached] = await Promise.all([catalogue.refresh(), rates.get(), daily.cached()]);
      return attach({ ...result, products: result.products || [], sourceError: result.status === 'unavailable', query: '', page: 1, hasMore: false }, cached.filter((source) => !disabledPlatforms.has(source.id)), fx);
    },
    async compare(id, fresh = false) {
      if (!/^p\d+$/.test(id)) throw new Error('INVALID_SEARCH');
      if (fresh) productSearch.clear();
      const product = await productSearch.detail(id);
      const [fx, ...domestic] = await Promise.all([rates.get(), ...platforms.map((platform) => readPlatform(platform, canonicalQuery(product.name), fresh))]);
      const result = await attach({ products: [product], query: product.name }, domestic, fx);
      return { product: result.products.find((p) => p.id === id), sources: result.sources };
    },
    async search(query, page = 1, identification = null, fresh = false) {
      query = canonicalQuery(query);
      if (!query || query.length > 120 || /[\u0000-\u001f]/.test(query) || !Number.isInteger(page) || page < 1 || page > 1000) throw new Error('INVALID_SEARCH');
      if (fresh) productSearch.clear();
      const insufficientIdentity = identification && !hasProductIdentity(identification);
      const marketQuery = identification ? canonicalQuery([identification.brand, identification.product_name, identification.specification].filter(Boolean).join(' ')).slice(0, 120) : query;
      const cdf = insufficientIdentity ? Promise.resolve({ products: [], query, page, hasMore: false, matched: true, insufficientIdentity: true }) : identification ? matchProducts(identification, productSearch) : searchProductsText(query, productSearch, page);
      const results = await Promise.allSettled([cdf, rates.get(), ...(!insufficientIdentity ? platforms.map((platform) => readPlatform(platform, marketQuery)) : [])]);
      const result = results[0].status === 'fulfilled' ? results[0].value : { products: [], query, page, hasMore: false, sourceError: true };
      const fx = results[1].status === 'fulfilled' ? results[1].value : null;
      return attach({ ...result, identification, marketQuery }, results.slice(2).filter((r) => r.status === 'fulfilled').map((r) => r.value), fx);
    },
  };
}
