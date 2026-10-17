import { canonicalQuery, normalise, productFamily, specification } from './public/identity.mjs';
const tokens = (value = '') => [...canonicalQuery(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().matchAll(/[a-z0-9][a-z0-9-]{2,}|[\p{Script=Han}]{2,}/gu)].flatMap(([word]) => /\p{Script=Han}/u.test(word) ? Array.from({ length: word.length - 1 }, (_, i) => word.slice(i, i + 2)) : [word]);

export function validateIdentification(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('INVALID_SEARCH');
  if (item.is_product != null && typeof item.is_product !== 'boolean') throw new Error('INVALID_SEARCH');
  for (const field of ['brand', 'product_name', 'specification', 'category']) if (item[field] != null && (typeof item[field] !== 'string' || item[field].length > 300)) throw new Error('INVALID_SEARCH');
  for (const field of ['search_keywords', 'visible_text']) if (item[field] != null && (!Array.isArray(item[field]) || item[field].length > 20 || item[field].some((word) => typeof word !== 'string' || word.length > 400))) throw new Error('INVALID_SEARCH');
  return item;
}

export function hasProductIdentity(item) {
  const name = normalise(item.product_name);
  return item.is_product !== false && name.length >= 3 && name !== normalise(item.brand) && name !== normalise(item.category);
}

export function matchesIdentification(item, product) {
  const ranked = rankProducts(item, [product])[0];
  if (!ranked || ranked.matchKind === 'brand') return false;
  const wanted = specification(item.specification || item.product_name);
  const actual = specification(product.specification || product.name);
  return !wanted || !actual || wanted.key === actual.key;
}

export function rankProducts(item, products) {
  const keywords = [item.brand, item.product_name, ...(item.search_keywords || [])].filter(Boolean);
  const wanted = new Set(tokens([item.product_name, ...(item.search_keywords || [])].filter(Boolean).join(' ')));
  const reference = [item.product_name, item.category, ...(item.search_keywords || [])].filter(Boolean).join(' ');
  const family = productFamily(reference);
  return products.map((product) => {
    const name = normalise(product.name);
    const brand = normalise(`${product.brand} ${product.brandEn || ''}`);
    const brandMatch = keywords.some((word) => normalise(word).length >= 2 && brand.includes(normalise(word)));
    const productTokens = new Set(tokens(`${product.name} ${product.brand} ${product.brandEn || ''} ${product.specification || ''}`));
    const overlap = [...wanted].filter((word) => productTokens.has(word)).length;
    const direct = keywords.some((word) => normalise(word).length >= 2 && name.includes(normalise(word)) && !brand.includes(normalise(word)));
    const candidateFamily = productFamily(product.name);
    const familyMatch = family && candidateFamily === family;
    let score = (brandMatch ? 4 : 0) + (direct ? 5 : 0) + Math.min(overlap, 6) + (familyMatch ? 5 : family ? -3 : 0);
    if (family && candidateFamily && candidateFamily !== family) score = -1;
    if (item.brand && !brandMatch && !direct) score = -1;
    return { ...product, matchScore: score, matchKind: familyMatch || direct ? 'similar' : 'brand' };
  }).filter((product) => product.matchScore >= 3).sort((a, b) => b.matchScore - a.matchScore);
}

export async function matchProducts(item, service) {
  validateIdentification(item);
  const queries = [...new Set([...(item.search_keywords || []), item.product_name, item.brand].filter((word) => typeof word === 'string' && word.trim()).map((word) => canonicalQuery(word).slice(0, 120)))].slice(0, 3);
  if (!queries.length) return { query: '', page: 1, pages: 1, products: [], matched: true };
  const results = await Promise.allSettled(queries.map((query) => service.search(query)));
  const successful = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  if (!successful.length) throw new Error('OFFICIAL_SEARCH_UNAVAILABLE');
  const candidates = [...new Map(successful.flatMap((result) => result.products).map((product) => [product.id, product])).values()];
  const ranked = rankProducts(item, candidates);
  const selected = ranked.filter((product) => product.matchScore >= (ranked[0]?.matchScore || 0) - 2).slice(0, 3);
  const detailed = await Promise.all(selected.map(async (product) => {
    try { return { ...product, ...await service.detail(product.id) }; } catch { return product; }
  }));
  const products = detailed.filter((product) => matchesIdentification(item, product));
  return { query: item.product_name || queries[0], queries, page: 1, pages: 1, products, matched: true, sourceError: !products.length && successful.length < results.length, hasMore: false, fetchedAt: new Date().toISOString() };
}

export async function searchProductsText(query, service, page = 1) {
  if (typeof query !== 'string' || !query.trim() || query.length > 120) throw new Error('INVALID_SEARCH');
  query = canonicalQuery(query);
  const result = await service.search(query, page);
  const products = rankProducts({ product_name: query, search_keywords: [query] }, result.products);
  return { ...result, products, related: false };
}
