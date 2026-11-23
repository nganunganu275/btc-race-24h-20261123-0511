[![make.fun](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/nganunganu275/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/nganunganu275/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)

# Momentum Rider — a cbBTC trading bot for [make.fun](https://make.fun)

An entry for make.fun's **Race a BTC trading bot live for 24 hours**
(`btc-race-24h-20261123-0511`): a bot that trades Coinbase Wrapped BTC (cbBTC)
against USDC on 1-minute on-chain prices with $1,000 of paper money.

## Strategy

On 1-minute bars the noise swamps every fast signal: a 1-minute return has an
8 bps standard deviation against a 26+ bps round-trip cost, so fast crossover
and breakout bots churn themselves to death (the kit's EMA-cross baseline loses
$114.83 on the dev window on 76 trades). Momentum Rider trades rarely and rides
the day's drift instead:

- **Entry, once it has 24 closes:** the 24-bar return is positive **and** the
  close is above its own 24-bar simple moving average. Both must hold — a
  positive 24-bar return alone fires on a single uptick, and the SMA filter
  asks the price to sit above its own recent mean. When both hold it buys with
  all of its cash.
- **Exit, the whole position:** a trailing stop 2.5% below the highest close
  seen since entry. The stop is wide on purpose: the dev window's worst
  peak-to-trough pullback is 1.98%, so it never fires on ordinary chop, but it
  caps the loss on a real down day at about 2.5% plus one round trip of costs.
- **No re-entry:** one position per window. After an exit the bot holds cash.
  Re-entering after a stop-out lost money again in every falling-market stress
  test, so the bot takes its one shot and stops.
- Orders cap their slippage at 100 bps (1%) past the close they were decided on.

## Results (local replay, kit harness fill model, dev window)

| | |
|---|---|
| Net PnL | **+$33.52** |
| Trades | 1 (buy at bar 39, held to the flatten) |
| Fees | $0.81 |
| Max drawdown | 1.98% |
| Sharpe (per bar) | 0.029 |

Stress tests on the same window mirrored into a −3.64% fall and time-reversed:
−$27.54 / −$21.64, against −$40.10 / −$38.39 for buy-and-hold.

## Files

- `main.ts` — the bot (Node 22, erasable TypeScript). Speaks
  `agent-fun/bars-replay/v1` over stdin/stdout via the kit SDK shim.
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's SDK shim.
- `package.json` — `{"type": "module"}` so Node treats the entry as ESM.

Deterministic: float64 arithmetic on `+ - * /` alone, no clock, no
environment, no randomness, no files. Two runs on the same bars produce
byte-identical action logs.
