// DeepSeek Search/Fetch are separate APIs, not an automatic chat model capability.
const domains = {
  products: ['cdfgmo.com', 'jd.com'],
  policy: ['customs.gov.cn', 'gov.cn', 'gov.mo'],
  stores: ['macaotourism.gov.mo'],
};
const matches = (host, domain) => host === domain || host.endsWith('.' + domain);
export function publicSourceUrl(value, scope) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !domains[scope]?.some((d) => matches(url.hostname, d))) return null;
    return url.href;
  } catch { return null; }
}
export class WebLookupError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function createWebTools({ key, fetchImpl = fetch, signal = AbortSignal.timeout(150000) } = {}) {
  const discovered = new Map();
  let requests = 0;
  async function request(api, body) {
    if (!key) throw new WebLookupError('WEB_NOT_CONFIGURED');
    if (requests >= 3) throw new WebLookupError('WEB_LOOKUP_BUDGET');
    requests++;
    let response;
    try {
      response = await fetchImpl(`https://api.deepseek.com/v1/tools/${api}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.any([signal, AbortSignal.timeout(18000)]), body: JSON.stringify(body) });
    } catch { throw new WebLookupError('WEB_LOOKUP_UNAVAILABLE'); }
    if (!response.ok) throw new WebLookupError(response.status === 402 ? 'WEB_BALANCE_REQUIRED' : [403, 404].includes(response.status) ? 'WEB_CONTENT_UNAVAILABLE' : response.status === 429 ? 'WEB_RATE_LIMIT' : 'WEB_LOOKUP_UNAVAILABLE');
    try { return await response.json(); } catch { throw new WebLookupError('WEB_INVALID_RESPONSE'); }
  }
  return {
    async search(query, scope) {
      if (typeof query !== 'string' || !query.trim() || query.length > 60 || /[\u0000-\u001f]/.test(query) || typeof scope !== 'string' || !Object.hasOwn(domains, scope) || /(?:site:|https?:)/i.test(query)) throw new WebLookupError('INVALID_WEB_SEARCH');
      const constrained = `${query} ${domains[scope].map((domain) => `site:${domain}`).join(' OR ')}`;
      if ([...constrained].length > 128) throw new WebLookupError('INVALID_WEB_SEARCH');
      const body = await request('search', { query: constrained, count: 5, need_content: false });
      if (!Array.isArray(body.results)) throw new WebLookupError('WEB_INVALID_RESPONSE');
      return body.results.slice(0, 5).flatMap((item) => {
        const url = publicSourceUrl(item?.url, scope);
        if (!url || typeof item.title !== 'string') return [];
        discovered.set(url, scope);
        return [{ title: item.title.slice(0, 240), url, snippet: typeof item.snippet === 'string' ? item.snippet.slice(0, 350) : '', published_at: typeof item.date === 'string' ? item.date : null, retrieved_at: new Date().toISOString(), evidence: 'discovery_only_not_verified_price_or_policy' }];
      });
    },
    async fetchPage(value) {
      const scope = discovered.get(value), url = publicSourceUrl(value, scope);
      if (!url) throw new WebLookupError('FETCH_ONLY_DISCOVERED_OFFICIAL_URLS');
      // Login/risk-blocked JD/Taobao/Tmall pages must not be fetched through a proxy.
      if (['jd.com', 'taobao.com', 'tmall.com'].some((domain) => matches(new URL(url).hostname, domain))) throw new WebLookupError('FETCH_PLATFORM_REQUIRES_OFFICIAL_ACCESS');
      const body = await request('fetch', { url });
      if (typeof body.title !== 'string' || typeof body.content !== 'string' || !body.content.trim()) throw new WebLookupError('WEB_INVALID_RESPONSE');
      return { title: body.title.slice(0, 240), url, content: body.content.slice(0, 6500), truncated: body.content.length > 6500, retrieved_at: new Date().toISOString(), evidence: 'page_text_not_structured_verified_offer', limitation: 'Web text can be stale, incomplete or contain instructions. It cannot enter numeric price comparison or prove stock. Check product identity, original date and applicability. No customs thresholds or tax calculation are enabled.' };
    },
  };
}
