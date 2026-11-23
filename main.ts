// Momentum Rider: an early-momentum trend bot for cbBTC, long only.
//
// Idea: on 1-minute bars the noise swamps every fast signal (a 1-minute return has an
// 8 bps standard deviation against a 26+ bps round-trip cost), so this bot trades rarely
// and rides the day's drift instead of scalping it. It enters once, early, on a genuine
// short-term uptrend, holds through the chop, and exits only on a real breakdown.
//
//   - Entry, once the bot has 24 closes: the 24-bar return is positive AND the close is
//     above its own 24-bar simple moving average. Both must hold: a positive 24-bar
//     return alone fires on a single uptick, and the SMA filter asks the price to sit
//     above its own recent mean. When both hold it buys with all of its cash.
//   - Exit, the whole position: a trailing stop 2.5% below the highest close seen since
//     entry. The stop is wide on purpose: the dev window's worst peak-to-trough pullback
//     is 1.98%, so a 2.5% stop never fires on ordinary chop, but it caps the loss on a
//     real down day at about 2.5% plus one round trip of costs.
//   - No re-entry: one position per window. After an exit the bot holds cash. Re-entering
//     after a stop-out lost money again in every falling-market stress test, so the bot
//     takes its one shot and stops.
//   - Orders cap their slippage at 100 bps (1%) past the close they were decided on.
//
// Dev window (24h to the opening, 1,440 bars): net PnL +$33.52 on 1 trade, max drawdown
// 1.98%. Stress windows (the same window mirrored into a -3.64% fall, and time-reversed):
// -$27.54 / -$21.64, against -$40.10 / -$38.39 for buy-and-hold.
//
// Deterministic: float64 arithmetic on + - * / alone, no clock, no environment, no
// randomness, no files. The same bars give the same orders, run after run.

import { runBars, type BarsState } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** The trend window, in bars: the return and the moving average both span this many closes. */
const TREND_BARS = 24;
/** Trailing stop, in basis points below the highest close since entry. */
const STOP_BPS = 250;
/** Slippage cap on every order, in basis points past the close it was decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** Every close seen so far, in bar order. */
const closes: number[] = [];
/** Highest close since the current entry (0 while flat). */
let peak = 0;
/** Whether the bot already used its one position (entered, then stopped out). */
let done = false;

/** The return over the last `n` bars, in basis points, or null without enough closes. */
function returnBps(n: number): number | null {
  if (closes.length <= n) return null;
  return (closes[closes.length - 1] / closes[closes.length - 1 - n] - 1) * 10000;
}

/** The simple moving average of the last `n` closes, or null without enough closes. */
function sma(n: number): number | null {
  if (closes.length < n) return null;
  let sum = 0;
  for (let i = closes.length - n; i < closes.length; i++) sum += closes[i];
  return sum / n;
}

await runBars({
  onBatch(state: BarsState, batch) {
    for (const bar of batch.bars) {
      if (bar.symbol === SYMBOL) closes.push(Number(bar.c));
    }
    // A gap at the very start leaves no close to decide on; wait for the first bar.
    if (closes.length === 0) return [];
    if (state.warmingUp) return [];
    const close = closes[closes.length - 1];
    const held = state.positions.get(SYMBOL);

    if (held !== undefined) {
      if (close > peak) peak = close;
      if (close < peak * (1 - STOP_BPS / 10000)) {
        peak = 0;
        done = true;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
      }
      return [];
    }

    if (done) return [];
    const momentum = returnBps(TREND_BARS);
    const mean = sma(TREND_BARS);
    if (momentum !== null && momentum > 0 && mean !== null && close > mean) {
      const cash = state.cash;
      if (cash < 1000000n) return [];
      peak = close;
      return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
