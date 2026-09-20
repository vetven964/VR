/**
 * Unified candle data provider — routes to Twelve Data (free generic forex
 * feed) or MetaApi (exact MT5 broker prices) depending on `source`.
 */

const twelveData = require('./twelveDataProvider');
const metaApi = require('./metaApiProvider');
const yahooFinance = require('./yahooFinanceProvider');

async function fetchCandles(pair, interval = '15min', outputsize = 30, source = 'twelvedata') {
  if (source === 'metaapi') {
    return metaApi.fetchCandles(pair, interval, outputsize);
  }
  if (source === 'yahoo') {
    return yahooFinance.fetchCandles(pair, interval, outputsize);
  }
  return twelveData.fetchCandles(pair, interval, outputsize);
}

module.exports = { fetchCandles };
