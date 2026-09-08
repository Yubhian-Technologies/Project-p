import { QUOTES, type Quote } from "../data/quotes";

export function getDailyQuote(): Quote {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
