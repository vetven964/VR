/**
 * ICT / Smart Money Concepts signal engine — ported from the Pine Script
 * indicator "V-TRADE AI — ICT SMC V8.1 KHMER PRO" (© vetven168, MPL-2.0),
 * extended with a Retest + Rejection confirmation stage.
 *
 * Sequence required before a signal fires:
 *   1. Liquidity Sweep  (price wicks past recent high/low, closes back inside)
 *   2. MSS              (Market Structure Shift — close breaks internal high/low)
 *   3. BOS               (Break of Structure — confirms the shift again)
 *   4. Displacement      (a strong-bodied candle, >= dispBodyATR * ATR) + POI (FVG/displacement)
 *   5. Retest + Rejection (NEW): price must return to the POI/broken-structure
 *      zone and print a rejection wick candle (long wick against the trade
 *      direction, closing back in the trade's favor) before the signal fires.
 *      This avoids entering right at the displacement candle — instead it
 *      waits for a lower-risk pullback entry, like a real SMC trader would.
 *   + valid structural SL (beyond nearest swing/liquidity, ATR-padded)
 *   + valid TP1 (nearest opposing swing/liquidity beyond entry, min ATR distance)
 *   + (optional) Multi-timeframe EMA50 trend alignment
 *
 * This function replays the whole candle series in order (like Pine does
 * bar-by-bar) and only returns a signal if it is confirmed on the LAST
 * candle in the array — i.e. a brand new signal, not a historical one.
 *
 * This is a best-effort JS port for personal/educational use — not a
 * certified 1:1 clone of the Pine Script runtime, and not trading advice.
 */

const DEFAULTS = {
  swingLen: 3,
  liqLookback: 20,
  sequenceBars: 50,
  cooldownBars: 5,
  atrLen: 14,
  dispBodyATR: 0.70,
  slATRBuffer: 0.10,
  minTPATR: 0.30,
  requireRetest: true, // wait for a pullback + rejection wick before firing
  retestBars: 20, // give up waiting for the retest after this many bars
  rejectWickRatio: 0.5, // rejection wick must be >= this fraction of the candle's range
};

function computeATR(candles, length) {
  const n = candles.length;
  const tr = new Array(n).fill(null);
  const atr = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
  }
  if (n > length) {
    let sum = 0;
    for (let i = 1; i <= length; i++) sum += tr[i] || 0;
    atr[length] = sum / length;
    for (let i = length + 1; i < n; i++) {
      atr[i] = (atr[i - 1] * (length - 1) + tr[i]) / length;
    }
  }
  return atr;
}

function computeEMA(values, length) {
  const ema = new Array(values.length).fill(null);
  const k = 2 / (length + 1);
  let seeded = false;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (!seeded) {
      sum += values[i];
      if (i === length - 1) {
        ema[i] = sum / length;
        seeded = true;
      }
    } else {
      ema[i] = values[i] * k + ema[i - 1] * (1 - k);
    }
  }
  return ema;
}

/**
 * Checks EMA50 trend alignment on 1h/15m/5m closes — mirrors the Pine
 * script's requireMTF gate. Pass the three candle series pre-fetched by
 * the caller (see server.js).
 */
function checkMTFAlignment(htfCandles, mtfCandles, ltfCandles) {
  const last = (arr) => arr[arr.length - 1];
  const htfEma = computeEMA(htfCandles.map((c) => c.close), 50);
  const mtfEma = computeEMA(mtfCandles.map((c) => c.close), 50);
  const ltfEma = computeEMA(ltfCandles.map((c) => c.close), 50);

  const htfClose = last(htfCandles).close;
  const mtfClose = last(mtfCandles).close;
  const ltfClose = last(ltfCandles).close;
  const htfE = last(htfEma);
  const mtfE = last(mtfEma);
  const ltfE = last(ltfEma);

  if (htfE == null || mtfE == null || ltfE == null) return { bull: false, bear: false };

  return {
    bull: htfClose > htfE && mtfClose > mtfE && ltfClose > ltfE,
    bear: htfClose < htfE && mtfClose < mtfE && ltfClose < ltfE,
  };
}

/**
 * Runs the full ICT sequence over `candles` (oldest → newest). Returns a
 * signal object only if freshly confirmed on the LAST candle, else null.
 * `mtf` (optional): { bull: boolean, bear: boolean } from checkMTFAlignment.
 */
function runIctEngine(candles, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const n = candles.length;
  const minBars = Math.max(cfg.atrLen, cfg.liqLookback, cfg.swingLen * 4) + 5;
  if (n < minBars) return null;

  const atr = computeATR(candles, cfg.atrLen);

  let swingHigh1 = null, swingHigh2 = null, swingHigh3 = null;
  let swingLow1 = null, swingLow2 = null, swingLow3 = null;

  let bullState = 0, bearState = 0;
  let bullStartBar = null, bearStartBar = null;
  // Retest-stage tracking (state 4 → waiting for pullback + rejection wick)
  let bullRetestStartBar = null, bearRetestStartBar = null;
  let bullZoneTop = null, bullZoneBottom = null;
  let bearZoneTop = null, bearZoneBottom = null;
  let bullPOISnapshot = false, bearPOISnapshot = false;
  let lastSignalBar = null;
  let result = null;

  for (let i = cfg.swingLen; i < n; i++) {
    // --- confirmed swing pivot at p = i - swingLen ---
    const p = i - cfg.swingLen;
    if (p - cfg.swingLen >= 0) {
      const ws = p - cfg.swingLen, we = p + cfg.swingLen;
      let isHigh = true, isLow = true;
      const hp = candles[p].high, lp = candles[p].low;
      for (let k = ws; k <= we; k++) {
        if (k === p) continue;
        if (candles[k].high >= hp) isHigh = false;
        if (candles[k].low <= lp) isLow = false;
      }
      if (isHigh) { swingHigh3 = swingHigh2; swingHigh2 = swingHigh1; swingHigh1 = hp; }
      if (isLow) { swingLow3 = swingLow2; swingLow2 = swingLow1; swingLow1 = lp; }
    }

    if (atr[i] == null) continue;
    if (i - cfg.liqLookback < 0) continue;
    if (i - cfg.swingLen * 2 < 0) continue;

    const cur = candles[i];
    const body = Math.abs(cur.close - cur.open);
    const bullCandle = cur.close > cur.open;
    const bearCandle = cur.close < cur.open;
    const bullDisplacement = bullCandle && body >= atr[i] * cfg.dispBodyATR;
    const bearDisplacement = bearCandle && body >= atr[i] * cfg.dispBodyATR;

    let sellSideLiquidity = Infinity, buySideLiquidity = -Infinity;
    for (let k = i - cfg.liqLookback; k < i; k++) {
      sellSideLiquidity = Math.min(sellSideLiquidity, candles[k].low);
      buySideLiquidity = Math.max(buySideLiquidity, candles[k].high);
    }

    const bullSweep = cur.low < sellSideLiquidity && cur.close > sellSideLiquidity;
    const bearSweep = cur.high > buySideLiquidity && cur.close < buySideLiquidity;

    let internalHigh = -Infinity, internalLow = Infinity;
    for (let k = i - cfg.swingLen * 2; k < i; k++) {
      internalHigh = Math.max(internalHigh, candles[k].high);
      internalLow = Math.min(internalLow, candles[k].low);
    }
    const bullMSS = cur.close > internalHigh;
    const bearMSS = cur.close < internalLow;

    // --- bull sequence state machine ---
    if (bullSweep) { bullState = 1; bullStartBar = i; }
    if (bullState > 0 && bullState < 4 && bullStartBar != null && i - bullStartBar > cfg.sequenceBars) { bullState = 0; bullStartBar = null; }
    if (bullState === 1 && bullMSS) bullState = 2;
    const bullBOS = bullState === 2 && cur.close > internalHigh;
    if (bullBOS) bullState = 3;
    const bullDisp = bullState === 3 && bullDisplacement;

    // --- bear sequence state machine ---
    if (bearSweep) { bearState = 1; bearStartBar = i; }
    if (bearState > 0 && bearState < 4 && bearStartBar != null && i - bearStartBar > cfg.sequenceBars) { bearState = 0; bearStartBar = null; }
    if (bearState === 1 && bearMSS) bearState = 2;
    const bearBOS = bearState === 2 && cur.close < internalLow;
    if (bearBOS) bearState = 3;
    const bearDisp = bearState === 3 && bearDisplacement;

    // --- FVG / POI ---
    let bullFVG = false, bearFVG = false;
    if (i >= 2) {
      bullFVG = candles[i].low > candles[i - 2].high;
      bearFVG = candles[i].high < candles[i - 2].low;
    }
    const bullPOI = bullFVG || (bullDisplacement && cur.close > cur.open);
    const bearPOI = bearFVG || (bearDisplacement && cur.close < cur.open);

    // --- displacement confirmed: arm state 4 (wait for retest) or, if
    // requireRetest is off, treat as immediately signal-ready (legacy) ---
    if (bullDisp) {
      bullState = 4;
      bullPOISnapshot = bullPOI;
      bullZoneBottom = bullFVG ? candles[i - 2].high : cur.low;
      bullZoneTop = bullFVG ? cur.low : cur.high;
      bullRetestStartBar = i;
    }
    if (bearDisp) {
      bearState = 4;
      bearPOISnapshot = bearPOI;
      bearZoneTop = bearFVG ? candles[i - 2].low : cur.high;
      bearZoneBottom = bearFVG ? cur.high : cur.low;
      bearRetestStartBar = i;
    }

    // give up waiting for a retest after retestBars without one occurring
    if (bullState === 4 && bullRetestStartBar != null && i - bullRetestStartBar > cfg.retestBars) {
      bullState = 0; bullStartBar = null; bullRetestStartBar = null;
    }
    if (bearState === 4 && bearRetestStartBar != null && i - bearRetestStartBar > cfg.retestBars) {
      bearState = 0; bearStartBar = null; bearRetestStartBar = null;
    }

    // --- retest + rejection wick check (only on bars AFTER the displacement bar) ---
    let bullRetestReject = false;
    if (cfg.requireRetest && bullState === 4 && bullRetestStartBar != null && i > bullRetestStartBar) {
      const touchesZone = cur.low <= bullZoneTop && cur.high >= bullZoneBottom;
      const range = cur.high - cur.low;
      const lowerWick = Math.min(cur.open, cur.close) - cur.low;
      const isRejection = range > 0 && lowerWick >= cfg.rejectWickRatio * range && cur.close > cur.open;
      if (touchesZone && isRejection) bullRetestReject = true;
    }
    let bearRetestReject = false;
    if (cfg.requireRetest && bearState === 4 && bearRetestStartBar != null && i > bearRetestStartBar) {
      const touchesZone = cur.high >= bearZoneBottom && cur.low <= bearZoneTop;
      const range = cur.high - cur.low;
      const upperWick = cur.high - Math.max(cur.open, cur.close);
      const isRejection = range > 0 && upperWick >= cfg.rejectWickRatio * range && cur.close < cur.open;
      if (touchesZone && isRejection) bearRetestReject = true;
    }

    // --- structural SL (computed fresh at the potential signal bar) ---
    const buySLBase = swingLow1 != null ? swingLow1 : swingLow2 != null ? swingLow2 : sellSideLiquidity;
    const buySL = buySLBase - atr[i] * cfg.slATRBuffer;
    const sellSLBase = swingHigh1 != null ? swingHigh1 : swingHigh2 != null ? swingHigh2 : buySideLiquidity;
    const sellSL = sellSLBase + atr[i] * cfg.slATRBuffer;

    const buyEntry = cur.close;
    const sellEntry = cur.close;

    // --- TP1: nearest valid opposing swing/liquidity beyond entry ---
    const buyCandidates = [swingHigh1, swingHigh2, swingHigh3, buySideLiquidity].filter((v) => v != null && v > buyEntry);
    const buyTP1 = buyCandidates.length ? Math.min(...buyCandidates) : null;
    const sellCandidates = [swingLow1, swingLow2, swingLow3, sellSideLiquidity].filter((v) => v != null && v < sellEntry);
    const sellTP1 = sellCandidates.length ? Math.max(...sellCandidates) : null;

    const minDist = atr[i] * cfg.minTPATR;
    const buyTargetOK = buyTP1 != null && buyTP1 > buyEntry && buyTP1 - buyEntry >= minDist;
    const sellTargetOK = sellTP1 != null && sellTP1 < sellEntry && sellEntry - sellTP1 >= minDist;

    const buySLValid = buySL < buyEntry;
    const sellSLValid = sellSL > sellEntry;

    const cooldownOK = lastSignalBar == null || i - lastSignalBar > cfg.cooldownBars;

    const buyReadyState = cfg.requireRetest ? bullRetestReject : bullState >= 4 && bullCandle;
    const sellReadyState = cfg.requireRetest ? bearRetestReject : bearState >= 4 && bearCandle;
    const buyPOIActive = cfg.requireRetest ? bullPOISnapshot : bullPOI;
    const sellPOIActive = cfg.requireRetest ? bearPOISnapshot : bearPOI;

    const buySignal = buyReadyState && buyPOIActive && buySLValid && buyTargetOK && cooldownOK;
    const sellSignal = sellReadyState && sellPOIActive && sellSLValid && sellTargetOK && cooldownOK;

    if (buySignal) {
      result = { direction: 'BUY', entry: buyEntry, sl: buySL, tp1: buyTP1, barIndex: i, time: cur.time, retestConfirmed: cfg.requireRetest };
      lastSignalBar = i; bullState = 0; bullStartBar = null; bullRetestStartBar = null;
    }
    if (sellSignal) {
      result = { direction: 'SELL', entry: sellEntry, sl: sellSL, tp1: sellTP1, barIndex: i, time: cur.time, retestConfirmed: cfg.requireRetest };
      lastSignalBar = i; bearState = 0; bearStartBar = null; bearRetestStartBar = null;
    }
  }

  if (result && result.barIndex === n - 1) return result;
  return null;
}

module.exports = { runIctEngine, checkMTFAlignment, computeATR, computeEMA };
