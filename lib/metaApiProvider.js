/**
 * Fetches MT5 broker candle (OHLC) data via MetaApi.cloud — this gives
 * prices that exactly match the user's real MT5 broker account, because
 * MetaApi runs a cloud copy of MT5 connected to that same broker login.
 *
 * Setup (see README.md):
 *  1. Sign up free at https://app.metaapi.cloud
 *  2. Add your MT5 account (broker login/password/server) — MetaApi deploys
 *     a cloud MT5 terminal connected to it (free for 1 account)
 *  3. Copy the API token + the Account ID from the MetaApi dashboard
 *  4. Set METAAPI_TOKEN, METAAPI_ACCOUNT_ID, METAAPI_REGION in .env
 */

const TIMEFRAME_MAP = {
  '5min': '5m',
  '15min': '15m',
  '30min': '30m',
  '1h': '1h',
  '4h': '4h',
};

async function fetchCandles(pair, interval = '15min', outputsize = 30) {
  const token = process.env.METAAPI_TOKEN;
  const accountId = process.env.METAAPI_ACCOUNT_ID;
  const region = process.env.METAAPI_REGION || 'new-york';

  if (!token || !accountId) {
    throw new Error('METAAPI_TOKEN ឬ METAAPI_ACCOUNT_ID មិនទាន់បានកំណត់ក្នុង .env ទេ');
  }

  const timeframe = TIMEFRAME_MAP[interval] || interval;
  // MT5 broker symbol names sometimes carry a suffix (e.g. EURUSDm, XAUUSD.);
  // pass the symbol through as-is so it must match the broker's exact name.
  const symbol = pair;

  const url = `https://mt-market-data-client-api-v1.${region}.agiliumtrade.ai/users/current/accounts/${accountId}/historical-market-data/symbols/${encodeURIComponent(symbol)}/timeframes/${timeframe}/candles?limit=${outputsize}`;

  const resp = await fetch(url, {
    headers: { 'auth-token': token, Accept: 'application/json' },
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`MetaApi error (${resp.status}) សម្រាប់ ${pair}: ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  if (!Array.isArray(data) || !data.length) {
    throw new Error(`MetaApi មិនបានត្រឡប់ទិន្នន័យសម្រាប់ ${pair} ទេ — ពិនិត្យឈ្មោះ Symbol ឲ្យត្រូវនឹង Broker`);
  }

  const candles = data
    .map((c) => ({
      time: c.time || c.brokerTime,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  return candles;
}

module.exports = { fetchCandles };
