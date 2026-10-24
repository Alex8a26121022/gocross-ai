import { stores } from './maps.mjs';

const isText = (value) => typeof value === 'string';
const validDate = (value) => isText(value) && Number.isFinite(Date.parse(value));
const validPart = (part) => part && isText(part.answer) && isText(part.question) && ['considerations', 'next_steps'].every((key) => Array.isArray(part[key]) && part[key].every(isText));
const validProduct = (p) => p && isText(p.name) && (!p.image || isText(p.image)) && (!p.specification || isText(p.specification)) && (!p.quote || Number.isFinite(p.quote.amount) && isText(p.quote.currency) && isText(p.quote.channel) && validDate(p.quote.capturedAt) && (p.quote.cny === null || Number.isFinite(p.quote.cny)));
const validResult = (result) => result && validPart(result.zh) && validPart(result.en) && Array.isArray(result.sources) && result.sources.every((s) => s && ['id', 'label', 'en', 'url'].every((key) => isText(s[key]))) && Array.isArray(result.trace) && result.trace.every((entry) => entry && isText(entry.tool) && isText(entry.status)) && (!result.products || Array.isArray(result.products) && result.products.every(validProduct));
const mapUrl = (value) => isText(value) && value.startsWith('https://www.google.com/maps/dir/?');
const validRoute = (route) => route === null || route && ['walking', 'driving', 'transit'].includes(route.mode) && Array.isArray(route.stops) && route.stops.length > 0 && route.stops.length <= 3 && route.stops.every((s) => s && stores.some((store) => store.id === s.id) && Array.isArray(s.items) && s.items.every(isText)) && new Set(route.stops.map((s) => s.id)).size === route.stops.length && (route.url === null || mapUrl(route.url)) && Array.isArray(route.legs) && route.legs.every((leg) => leg && mapUrl(leg.url));
const validPlan = (plan) => plan === undefined || plan && Array.isArray(plan.selected) && plan.selected.every(isText) && new Set(plan.selected).size === plan.selected.length && plan.quantities && typeof plan.quantities === 'object' && !Array.isArray(plan.quantities) && Object.entries(plan.quantities).every(([id, quantity]) => plan.selected.includes(id) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 99);

export function validChat(chat) {
  return Boolean(chat && chat.version === 1 && isText(chat.id) && /^[\w-]{1,80}$/.test(chat.id) && validDate(chat.createdAt) && validDate(chat.updatedAt) && stores.some((s) => s.id === chat.storeId) && validRoute(chat.route) && validPlan(chat.plan) && Array.isArray(chat.turns) && chat.turns.length && chat.turns.every((turn) => turn && (turn.role === 'user' ? isText(turn.text) && (!turn.image || isText(turn.image) && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(turn.image)) : turn.role === 'assistant' && validResult(turn.result))));
}

export function chatSnapshot({ id, createdAt, turns, route, storeId, plan }, now = new Date().toISOString()) {
  const chat = structuredClone({ version: 1, id, createdAt: createdAt || now, updatedAt: now, turns, route, storeId, ...(plan ? { plan } : {}) });
  if (!validChat(chat)) throw new Error('INVALID_SAVED_CHAT');
  return chat;
}

export function chatSummary(chat) {
  const title = chat.turns.find((turn) => turn.role === 'user' && turn.text.trim())?.text.replace(/\s+/g, ' ').trim().slice(0, 72) || '';
  const preview = {};
  for (const lang of ['zh', 'en']) {
    const last = chat.turns.filter((turn) => turn.role === 'assistant').at(-1)?.result[lang];
    preview[lang] = (last?.answer || last?.question || '').replace(/\s+/g, ' ').slice(0, 100);
  }
  const searchable = chat.turns.flatMap((turn) => turn.role === 'user' ? [turn.text] : ['zh', 'en'].flatMap((lang) => [turn.result[lang].answer, turn.result[lang].question, ...turn.result[lang].considerations, ...turn.result[lang].next_steps]).concat((turn.result.products || []).map((product) => product.name))).join('\n').normalize('NFKC').toLowerCase();
  return { id: chat.id, title, updatedAt: chat.updatedAt, preview, searchable };
}

export function searchChats(summaries, query) {
  const term = query.trim().normalize('NFKC').toLowerCase();
  return summaries.filter((s) => !term || s.searchable.includes(term)).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function createChatStore(factory) {
  if (factory === undefined) { try { factory = globalThis.indexedDB; } catch { factory = null; } }
  let opening;
  function database() {
    if (!opening) opening = new Promise((resolve, reject) => {
      if (!factory) { reject(new Error('HISTORY_UNAVAILABLE')); return; }
      const request = factory.open('gocross-conversations', 1);
      request.onupgradeneeded = () => { for (const name of ['chats', 'summaries']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: 'id' }); };
      request.onerror = () => reject(new Error('HISTORY_UNAVAILABLE'));
      request.onblocked = () => reject(new Error('HISTORY_UNAVAILABLE'));
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    }).catch((error) => { opening = null; throw error; });
    return opening;
  }
  async function read(name, id) {
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(name, 'readonly'), request = id ? tx.objectStore(name).get(id) : tx.objectStore(name).getAll();
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('HISTORY_UNAVAILABLE'));
    });
  }
  return {
    list: async () => (await read('summaries')).filter((s) => s && isText(s.id) && isText(s.title) && isText(s.searchable) && validDate(s.updatedAt) && s.preview && isText(s.preview.zh) && isText(s.preview.en)),
    get: async (id) => { const chat = await read('chats', id); if (!validChat(chat)) throw new Error('INVALID_SAVED_CHAT'); return chat; },
    save: async (chat) => {
      if (!validChat(chat)) throw new Error('INVALID_SAVED_CHAT');
      const db = await database();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['chats', 'summaries'], 'readwrite');
        tx.objectStore('chats').put(chat); tx.objectStore('summaries').put(chatSummary(chat));
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(new Error('HISTORY_UNAVAILABLE'));
      });
    },
    remove: async (ids) => {
      if (!Array.isArray(ids) || !ids.length || ids.some(id => !isText(id) || !/^[\w-]{1,80}$/.test(id))) throw new Error('INVALID_CHAT_SELECTION');
      const db = await database();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['chats', 'summaries'], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(new Error('HISTORY_UNAVAILABLE'));
        try { for (const id of new Set(ids)) for (const name of ['chats', 'summaries']) tx.objectStore(name).delete(id); }
        catch { tx.abort(); reject(new Error('HISTORY_UNAVAILABLE')); }
      });
    },
  };
}
