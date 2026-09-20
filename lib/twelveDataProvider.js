/**
 * Fetches forex candle (OHLC) data from Twelve Data's free API.
 * Sign up for a free key at https://twelvedata.com (no card required).
 * Free tier: 8 requests/minute, 800/day — plenty for a few pairs on a
 * 15min/1h timeframe.
 *
 * Note: prices here are an aggregated market feed, not your specific
 * broker's quotes — they can differ slightly from MT5. For exact broker
 * prices, use the MetaApi source instead (see metaApiProvider.js).
 */

const TWELVEDATA_KEY = process.env.TWELVEDATA_API_KEY;

async function fetchCandles(pair, interval = '15min', outputsize = 30) {
  if (!TWELVEDATA_KEY) {
    throw new Error('TWELVEDATA_API_KEY មិនទាន់បានកំណត់ក្នុង .env ទេ');
  }

  // Twelve Data expects "EUR/USD" style symbols for forex pairs.
  const symbol = pair.includes('/') ? pair : `${pair.slice(0, 3)}/${pair.slice(3)}`;

  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVEDATA_KEY}`;

  const resp = await fetch(url);
  const data = await resp.json();

  if (data.status === 'error' || !data.values) {
    throw new Error(data.message || `មិនអាចទាញយកទិន្នន័យ ${pair} បានទេ`);
  }

  // Twelve Data returns newest → oldest; we need oldest → newest.
  const candles = data.values
    .map((v) => ({
      time: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
    }))
    .reverse();

  return candles;
}

module.exports = { fetchCandles };
