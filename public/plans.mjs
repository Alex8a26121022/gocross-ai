export function planQuantity(quantities, id) {
  const value = quantities?.[id];
  return Number.isInteger(value) && value >= 1 && value <= 99 ? value : 1;
}

export function planTotals(products, selected, quantities) {
  const amounts = new Map();
  let cny = 0, units = 0, unpriced = 0, unconverted = 0, count = 0;
  for (const product of products) {
    if (!selected.has(product.id)) continue;
    count++;
    const quantity = planQuantity(quantities, product.id), quote = product.quote;
    units += quantity;
    if (!quote || !Number.isFinite(quote.amount) || quote.amount <= 0 || !/^[A-Z]{3}$/.test(quote.currency)) { unpriced += quantity; continue; }
    amounts.set(quote.currency, (amounts.get(quote.currency) || 0) + Math.round(quote.amount * 100) * quantity);
    const converted = quote.currency === 'CNY' ? quote.amount : quote.cny;
    if (Number.isFinite(converted) && converted > 0) cny += Math.round(converted * 100) * quantity;
    else unconverted += quantity;
  }
  return { count, units, amounts: [...amounts].map(([currency, cents]) => ({ currency, amount: cents / 100 })), cny: cny / 100, unpriced, unconverted };
}

export function planSnapshot(products, selected, quantities) {
  const ids = [...new Set(products.map(product => product.id))].filter(id => typeof id === 'string' && selected.has(id));
  return { selected: ids, quantities: Object.fromEntries(ids.map(id => [id, planQuantity(quantities, id)])) };
}

export function planItemText(product, quantities) {
  return `${product.name}${product.specification && !product.name.includes(product.specification) ? ` ${product.specification}` : ''} ×${planQuantity(quantities, product.id)}`;
}
