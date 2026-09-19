/**
 * FVG (Fair Value Gap) detection — ICT-style 3-candle imbalance.
 *
 * Bullish FVG: candle[i-2].high < candle[i].low
 *   → gap zone = [candle[i-2].high, candle[i].low]
 * Bearish FVG: candle[i-2].low > candle[i].high
 *   → gap zone = [candle[i].high, candle[i-2].low]
 *
 * candles must be sorted OLDEST → NEWEST, each item: { time, open, high, low, close }
 */

function detectFVGs(candles) {
  const gaps = [];
  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];

    if (c1.high < c3.low) {
      gaps.push({
        type: 'bullish',
        index: i,
        time: c3.time,
        gapBottom: c1.high,
        gapTop: c3.low,
      });
    } else if (c1.low > c3.high) {
      gaps.push({
        type: 'bearish',
        index: i,
        time: c3.time,
        gapBottom: c3.high,
        gapTop: c1.low,
      });
    }
  }
  return gaps;
}

/**
 * Returns only the most recently formed FVG (if the last candle in the
 * series is what completed it) — this is what we alert on, so we don't
 * spam old/already-mitigated gaps every scan cycle.
 */
function detectLatestFVG(candles) {
  if (candles.length < 3) return null;
  const gaps = detectFVGs(candles);
  if (!gaps.length) return null;
  const last = gaps[gaps.length - 1];
  // Only fresh if it was formed by the most recent candle
  if (last.index !== candles.length - 1) return null;
  return last;
}

module.exports = { detectFVGs, detectLatestFVG };
