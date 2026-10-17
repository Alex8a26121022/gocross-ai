export const DAILY_PRICE_AGE = 24 * 60 * 60 * 1000;

export function usableQuote(offer, now = Date.now()) {
  const captured = Date.parse(offer?.capturedAt);
  const lifetime = offer?.platform === 'cdf' ? 120000 : DAILY_PRICE_AGE;
  return Number.isFinite(captured) && now >= captured - 5000 && now - captured < lifetime;
}
