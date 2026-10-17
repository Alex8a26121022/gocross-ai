import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { DAILY_PRICE_AGE } from './public/quotes.mjs';

// Only searched keywords are watched. Failed attempts also wait 24 hours;
// refreshing the page must not turn a daily collector into a live scraper.
export function createDailyMarket({ collect, cacheFile = null, now = Date.now, maximum = 60 } = {}) {
  const records = new Map(), pending = new Map();
  let timer, saving = Promise.resolve();
  const ready = (async () => {
    if (!cacheFile) return;
    try {
      const text = await readFile(cacheFile, 'utf8');
      if (text.length > 4 * 1024 * 1024) return;
      const saved = JSON.parse(text);
      if (saved.version !== 1 || !Array.isArray(saved.records)) return;
      for (const entry of saved.records.slice(-maximum)) {
        if (!['jd', 'taobao', 'tmall'].includes(entry.platform) || typeof entry.query !== 'string' || !entry.query || entry.query.length > 120 || !Number.isFinite(Date.parse(entry.attemptedAt)) || !Array.isArray(entry.data?.offers)) continue;
        records.set(`${entry.platform}:${entry.query}`, entry);
      }
    } catch { /* Missing or damaged snapshots do not become invented prices. */ }
  })();
  function save() {
    if (!cacheFile) return Promise.resolve();
    const content = JSON.stringify({ version: 1, records: [...records.values()] });
    saving = saving.catch(() => {}).then(async () => {
      await mkdir(path.dirname(cacheFile), { recursive: true });
      await writeFile(`${cacheFile}.tmp`, content, { mode: 0o600 });
      await rename(`${cacheFile}.tmp`, cacheFile);
    });
    return saving.catch(() => console.warn('Daily price snapshot could not be saved.'));
  }
  async function get(platform, query) {
    await ready;
    const key = `${platform}:${query}`;
    if (pending.has(key)) return pending.get(key);
    const previous = records.get(key);
    const elapsed = now() - Date.parse(previous?.attemptedAt);
    if (previous && elapsed >= -5000 && elapsed < DAILY_PRICE_AGE) return previous.data;
    const task = (async () => {
      const attemptedAt = new Date(now()).toISOString();
      let collected;
      try { collected = await collect(platform, query); }
      catch { collected = { id: platform, status: 'unavailable', offers: [], checkedAt: attemptedAt }; }
      const success = collected.status === 'ok' && collected.offers.length > 0;
      const data = {
        ...collected,
        offers: success ? collected.offers.slice(0, 50) : previous?.data.offers || [],
        lastSuccessAt: success ? attemptedAt : previous?.data.lastSuccessAt || null,
        nextUpdateAt: new Date(Date.parse(attemptedAt) + DAILY_PRICE_AGE).toISOString(),
        cadence: 'daily',
      };
      if (!records.has(key) && records.size >= maximum) records.delete(records.keys().next().value);
      records.set(key, { platform, query, attemptedAt, data });
      await save();
      return data;
    })().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }
  async function refreshDue() {
    await ready;
    const due = [...records.values()].filter((entry) => now() - Date.parse(entry.attemptedAt) >= DAILY_PRICE_AGE);
    // Bounded parallelism protects both this server and source websites.
    for (let i = 0; i < due.length; i += 2) await Promise.allSettled(due.slice(i, i + 2).map((entry) => get(entry.platform, entry.query)));
  }
  return {
    get, refreshDue,
    async cached() { await ready; return [...records.values()].map((entry) => entry.data); },
    start() { if (!timer) { void refreshDue(); timer = setInterval(() => void refreshDue(), 5 * 60 * 1000); timer.unref(); } },
    stop() { clearInterval(timer); timer = null; },
  };
}
