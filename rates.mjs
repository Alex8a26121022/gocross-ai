import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RATE_INTERVAL_MS = 30 * 60 * 1000;
export const RATE_SOURCE_URL = 'https://www.boc.cn/sourcedb/whpj/';
const cacheFile = fileURLToPath(new URL('./.runtime/rates.json', import.meta.url));
const plainText = (value) => value.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export function parseBocRates(html) {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const header = rows.map((row) => [...row[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((cell) => plainText(cell[1]))).find((cells) => cells.includes('货币名称') && cells.includes('现汇卖出价'));
  if (!header) throw new Error('RATE_FORMAT_CHANGED');
  const rates = {};
  for (const [name, currency] of [['澳门元', 'MOP'], ['港币', 'HKD']]) {
    const cells = rows.map((row) => [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => plainText(cell[1]))).find((cells) => cells[0] === name);
    if (!cells) throw new Error('RATE_CURRENCY_MISSING');
    const quote = Number(cells[header.indexOf('现汇卖出价')]);
    const rawDate = cells[header.indexOf('发布日期')];
    const rawTime = cells[header.indexOf('发布时间')];
    const timestamp = rawDate?.includes(':') ? rawDate : `${rawDate} ${rawTime}`;
    const sourcePublishedAt = timestamp?.replace(/\//g, '-').replace(' ', 'T') + '+08:00';
    if (!Number.isFinite(quote) || quote <= 0 || !Number.isFinite(Date.parse(sourcePublishedAt))) throw new Error('RATE_INVALID');
    const cnyPerUnit = Math.round(quote / 100 * 1000000) / 1000000;
    if (cnyPerUnit < 0.1 || cnyPerUnit > 2) throw new Error('RATE_INVALID');
    rates[currency] = { currency, cnyPerUnit, quotePer100: quote, sourcePublishedAt };
  }
  return { rates, source: { name: '中国银行外汇牌价', url: RATE_SOURCE_URL, quoteType: '现汇卖出价', quoteUnit: '100 外币兑人民币' } };
}

export function createRateService({ fetchImpl = fetch, now = Date.now, storage = cacheFile } = {}) {
  let data = null;
  let lastAttemptAt = null;
  let lastError = null;
  let pending = null;
  let timer;
  const snapshot = () => ({
    status: !data ? 'unavailable' : lastError ? 'stale' : 'ok',
    ...data,
    lastAttemptAt,
    nextRefreshAt: lastAttemptAt ? new Date(Date.parse(lastAttemptAt) + RATE_INTERVAL_MS).toISOString() : null,
    refreshIntervalMinutes: 30,
    error: lastError,
  });
  async function refresh() {
    if (pending) return pending;
    lastAttemptAt = new Date(now()).toISOString();
    pending = (async () => {
      try {
        const response = await fetchImpl(RATE_SOURCE_URL, { signal: AbortSignal.timeout(15000), headers: { Accept: 'text/html' } });
        if (!response.ok) throw new Error('RATE_FETCH_FAILED');
        const parsed = parseBocRates(await response.text());
        data = { ...parsed, fetchedAt: new Date(now()).toISOString() };
        lastError = null;
        if (storage) {
          await mkdir(path.dirname(storage), { recursive: true });
          await writeFile(`${storage}.tmp`, JSON.stringify(data, null, 2));
          await rename(`${storage}.tmp`, storage);
        }
      } catch { lastError = 'OFFICIAL_RATE_UNAVAILABLE'; }
      return snapshot();
    })().finally(() => { pending = null; });
    return pending;
  }
  async function get() {
    if (!lastAttemptAt || now() - Date.parse(lastAttemptAt) >= RATE_INTERVAL_MS) await refresh();
    if (pending) await pending;
    return snapshot();
  }
  async function start() {
    if (storage) {
      try {
        const saved = JSON.parse(await readFile(storage, 'utf8'));
        if (saved.rates?.MOP?.cnyPerUnit > 0 && saved.rates?.HKD?.cnyPerUnit > 0 && Number.isFinite(Date.parse(saved.fetchedAt)) && saved.source?.url === RATE_SOURCE_URL) data = saved;
      } catch { /* 初次启动没有缓存。 */ }
    }
    if (!timer) { timer = setInterval(() => { void refresh(); }, RATE_INTERVAL_MS); timer.unref(); }
    return refresh();
  }
  return { get, refresh, start, stop() { clearInterval(timer); timer = null; } };
}
