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

/**
 * Computes a rough trade plan (Entry/SL/TP1-3) from a detected FVG zone.
 *  - Entry: midpoint of the gap
 *  - SL: just beyond the far edge of the gap, padded by slBufferPercent
 *  - TP1/TP2/TP3: risk:reward 1:1, 1:2, 1:3 from Entry
 * This is a mechanical estimate, not trading advice — always verify
 * against your own broker's live price before entering a trade.
 */
function computeTradeLevels(fvg, slBufferPercent = 0.15) {
  const entry = (fvg.gapTop + fvg.gapBottom) / 2;
  const bufferAmount = entry * (slBufferPercent / 100);

  let sl, tp1, tp2, tp3;
  if (fvg.type === 'bullish') {
    sl = fvg.gapBottom - bufferAmount;
    const risk = entry - sl;
    tp1 = entry + risk * 1;
    tp2 = entry + risk * 2;
    tp3 = entry + risk * 3;
  } else {
    sl = fvg.gapTop + bufferAmount;
    const risk = sl - entry;
    tp1 = entry - risk * 1;
    tp2 = entry - risk * 2;
    tp3 = entry - risk * 3;
  }

  // Rough decimal precision based on price magnitude (Gold/BTC/JPY-style
  // pairs use fewer decimals than EURUSD-style pairs).
  const decimals = entry >= 100 ? 2 : entry >= 1 ? 4 : 6;
  const round = (n) => Number(n.toFixed(decimals));

  return {
    entry: round(entry),
    sl: round(sl),
    tp1: round(tp1),
    tp2: round(tp2),
    tp3: round(tp3),
  };
}

module.exports = { detectFVGs, detectLatestFVG, computeTradeLevels };
