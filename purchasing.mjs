import { usableQuote } from './public/quotes.mjs';
import { shoppingRoute, stores } from './public/maps.mjs';

// Public CDF website quotes are online quotes; they never establish an in-store price.
export function comparePurchaseChannels(product, now = Date.now()) {
  const offers = (product.offers || []).filter((offer) => usableQuote(offer, now) && Number.isFinite(offer.cny) && offer.cny > 0);
  const online = offers.filter((o) => o.method === 'online').sort((a, b) => a.cny - b.cny);
  const inStore = offers.filter((o) => o.method === 'in_store' && stores.some((s) => s.id === o.storeId)).sort((a, b) => a.cny - b.cny);
  const choice = online.length && inStore.length ? online[0].cny < inStore[0].cny ? 'online' : inStore[0].cny < online[0].cny ? 'in_store' : 'tie' : 'unresolved';
  return { product_id: product.id, name: product.name, best_online: online[0] || null, best_in_store: inStore[0] || null, cheaper_verified_channel: choice, difference_cny: online.length && inStore.length ? Math.round(Math.abs(online[0].cny - inStore[0].cny) * 100) / 100 : null, limitation: 'Only collected same-product offers, before unknown shipping/travel/tax costs. An online listing is not an in-store price. Missing either channel prevents an online-versus-store saving claim.' };
}

export function planPurchaseRoute(purchases, origin, mode) {
  if (!Array.isArray(purchases) || purchases.length < 1 || purchases.length > 10 || purchases.some((p) => !p || typeof p.item !== 'string' || !p.item.trim() || p.item.length > 120 || !['online', 'in_store', 'unresolved', 'suggested'].includes(p.channel) || typeof p.store_id !== 'string' || (p.channel === 'in_store' || p.channel === 'suggested') && !stores.some((s) => s.id === p.store_id) || p.channel !== 'in_store' && p.channel !== 'suggested' && p.store_id !== '') || new Set(purchases.map((p) => p.item.trim().toLowerCase())).size !== purchases.length) throw new Error('INVALID_PURCHASE_PLAN');
  const inStore = purchases.filter((p) => p.channel === 'in_store');
  const ids = [...new Set(inStore.map((p) => p.store_id))];
  const suggested = purchases.filter((p) => p.channel === 'suggested');
  // 建议到店点也由系统排最顺路顺序（最多 3 个目的地），让顾客能直接照着走。
  const suggestedIds = [...new Set(suggested.map((p) => p.store_id))].slice(0, 3);
  const suggestedRoute = suggestedIds.length ? shoppingRoute(origin, suggestedIds, mode) : null;
  const suggestedStops = (suggestedRoute ? suggestedRoute.stops.map((s) => s.id) : suggestedIds).map((id) => {
    const store = stores.find((s) => s.id === id);
    return { store_id: id, name: store.name, en: store.en, address: store.address, address_en: store.addressEn, items: suggested.filter((p) => p.store_id === id).map((p) => p.item) };
  });
  return { purchases, online_items: purchases.filter((p) => p.channel === 'online').map((p) => p.item), unresolved_items: purchases.filter((p) => p.channel === 'unresolved').map((p) => p.item), suggested_items: suggested.map((p) => p.item), suggested_stops: suggestedStops, suggested_route: suggestedRoute ? { stops: suggestedStops.map((s) => ({ store_id: s.store_id, name: s.name, en: s.en, items: s.items })), url: suggestedRoute.url, legs: suggestedRoute.legs, order_basis: suggestedRoute.orderBasis } : null, route: ids.length ? shoppingRoute(origin, ids, mode) : null, availability: 'unverified', limitation: 'Only in_store items enter the confirmed route. Suggested stops are ordered by the same route planner so the customer can follow the shortest order.' };
}
