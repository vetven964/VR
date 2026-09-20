/**
 * Fetches candle data from Yahoo Finance's public (UNOFFICIAL) chart API.
 * This is the easiest free way to reach CME futures like Gold Futures
 * (ticker "GC=F"), Silver ("SI=F"), Crude Oil ("CL=F"), etc.
 *
 * ⚠️ Important caveats:
 *  - This is not an official/supported API — Yahoo can rate-limit, block,
 *    or change/remove it at any time without notice.
 *  - Not affiliated with CME Group. For official, licensed CME market
 *    data you need a paid CME Market Data / DataMine subscription.
 *  - No API key needed, but don't hammer it — respect the scan interval.
 *
 * When using this source, set your Pair using the Yahoo ticker symbol
 * directly, e.g. "GC=F" for Gold Futures (not "XAUUSD").
 */

const INTERVAL_MAP = {
  '5min': '5m',
  '15min': '15m',
  '30min': '30m',
  '1h': '60m',
  '4h': '60m', // Yahoo has no native 4h intraday bucket; falls back to 60m
};

const RANGE_MAP = {
  '5m': '5d',
  '15m': '5d',
  '30m': '1mo',
  '60m': '3mo',
};

async function fetchCandles(pair, interval = '15min', outputsize = 30) {
  const symbol = pair; // pass through as-is, e.g. "GC=F"
  const yInterval = INTERVAL_MAP[interval] || '15m';
  const range = RANGE_MAP[yInterval] || '5d';

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${yInterval}&range=${range}`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SignalBot/1.0)',
      Accept: 'application/json',
    },
  });

  if (!resp.ok) {
    throw new Error(`Yahoo Finance error (${resp.status}) សម្រាប់ ${pair} — ពិនិត្យ Ticker ត្រូវ (ឧ. GC=F)`);
  }

  const data = await resp.json();
  const result = data?.chart?.result?.[0];
  if (!result || !result.timestamp) {
    const errMsg = data?.chart?.error?.description;
    throw new Error(errMsg || `Yahoo Finance មិនបានត្រឡប់ទិន្នន័យសម្រាប់ ${pair} ទេ`);
  }

  const timestamps = result.timestamp;
  const quote = result.indicators?.quote?.[0] || {};

  const candles = timestamps
    .map((t, i) => ({
      time: new Date(t * 1000).toISOString(),
      open: quote.open?.[i],
      high: quote.high?.[i],
      low: quote.low?.[i],
      close: quote.close?.[i],
    }))
    .filter((c) => c.open != null && c.high != null && c.low != null && c.close != null);

  return candles.slice(-outputsize);
}

module.exports = { fetchCandles };
