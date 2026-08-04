# PNB 15m Signal Engine

PNB NSE 15-minute signal engine using Bollinger Bands, RSI, MACD, and Stochastic Momentum. This document describes the **Deepak decision rules** (BB/RSI scenario trail), the **Deeppro** Stch Mtm exhaustion rules, **RulePNB** / **RuleSUNPHARMA**, and per-symbol favourable rules (**RuleLTM**, **RuleICICIGI**, **RuleTECHM**, **RuleTVSMOTOR**, **RulePOLICYBZR**) — how buy/sell signals are generated, how entries and exits are priced, and which quality gates apply on Day Scan / Post-Mortem.

Implementation (Deepak): `src/rules/deepakDecision.ts`, `src/rules/deepakCore.ts`, `src/rules/deepakTarget.ts`, `src/rules/bollingerUtils.ts`.

Implementation (Deeppro): `src/rules/deepproDecision.ts`, `src/indicators/stochasticMomentum.ts`, `config.deeppro` in `src/config.ts`.

Implementation (RulePNB): `src/rules/rulePnbDecision.ts`, `config.rulePnb` in `src/config.ts`.

Implementation (RuleSUNPHARMA): `src/rules/ruleSunpharmaDecision.ts`, `config.ruleSunpharma` in `src/config.ts`.

Implementation (per-symbol favourable rules): `src/rules/favourableSymbolRule.ts`, `config.favourableSymbolRules` in `src/config.ts`.


---

## Session and candles

| Setting | Value |
|--------|--------|
| Session window | **09:15 – 15:30 IST** |
| Candle interval | 15 minutes |
| Initial run size | **4 consecutive candles** from the 09:15 open |

Only candles inside the session with valid Bollinger upper/lower bands are used. Both a **bearish path** (starting from lower-band activity) and a **bullish path** (starting from upper-band activity) are evaluated independently on the same day.

---

## Bollinger band matching

Each candle is classified against the Bollinger upper and lower bands:

| Term | Meaning |
|------|---------|
| **BB lower active** | Low **crossed** the lower band (`low ≤ lower`) or is **close** to it (within `bbClosePctThreshold`, default **0.3%** of close) |
| **BB upper active** | High **crossed** the upper band (`high ≥ upper`) or is **close** to it |
| **BB lower only** | Lower active, upper **not** active |
| **BB upper only** | Upper active, lower **not** active |
| **BB both active** | Both upper and lower active on the same candle |

Match type on each event is either **`crossed`** (price pierced the band) or **`close`** (within the proximity threshold).

---

## Scenario trail (direction detection)

These scenarios describe the **pattern trail** for the day. Only some of them produce trades (see [Buy and sell signals](#buy-and-sell-signals)).

### Bearish path — starts with “downward direction 1”

**Anchor:** four consecutive **BB-lower-active** candles beginning at **09:15** (the 09:15 candle must itself be lower-active).

After the anchor, the engine races two branches from the anchor candle:

1. **Direction switch – up** — first candle with **BB both active**
2. **Continue downward direction – 2** — first candle with **BB lower only**

Whichever appears **first** determines the branch.

#### Branch A — switch up wins

| Step | Scenario | BB condition |
|------|----------|--------------|
| 1 | `deepak direction switch - up` | BB both active |
| 2a | `deepak strong direction switch - up` | First **BB upper only** after step 1 → **BUY entry** |
| 2b | `deepak continue upward direction - 3` | Same candle as 2a → **BUY entry** (second signal) |
| 3 | `deepak continue downward direction - 4` | First **BB lower only** after step 1 → **SELL entry** |

#### Branch B — continue down 2 wins

| Step | Scenario | BB condition |
|------|----------|--------------|
| 1 | `deepak continue downward direction - 2` | BB lower only → **SELL entry** |

### Bullish path — starts with “upward direction 1”

**Anchor:** four consecutive **BB-upper-active** candles beginning at **09:15**.

After the anchor, race:

1. **Direction switch – down** — first **BB both active**
2. **Continue upward direction – 2** — first **BB upper only**

#### Branch A — switch down wins

| Step | Scenario | BB condition |
|------|----------|--------------|
| 1 | `deepak direction switch - down` | BB both active |
| 2a | `deepak strong direction switch - down` | First **BB lower only** after step 1 → **SELL entry** |
| 2b | `deepak continue downward direction - 3` | Same candle as 2a → **SELL entry** (second signal) |
| 3 | `deepak continue upward direction - 4` | First **BB upper only** after step 1 → **BUY entry** |

#### Branch B — continue up 2 wins

| Step | Scenario | BB condition |
|------|----------|--------------|
| 1 | `deepak continue upward direction - 2` | BB upper only → **BUY entry** |

---

## Buy and sell signals

Only the scenarios below create tradable signals. Scenario numbers are stable labels used in the dashboard and backtest.

| Scenario key | Side | Scenario # |
|--------------|------|------------|
| `deepak strong direction switch - up` | **BUY** | 1 |
| `deepak continue upward direction - 3` | **BUY** | 2 |
| `deepak continue upward direction - 4` | **BUY** | 3 |
| `deepak continue upward direction - 2` | **BUY** | 4 |
| `deepak strong direction switch - down` | **SELL** | 1 |
| `deepak continue downward direction - 3` | **SELL** | 2 |
| `deepak continue downward direction - 4` | **SELL** | 3 |
| `deepak continue downward direction - 2` | **SELL** | 4 |

**Dual signals:** On a strong switch (up or down), scenarios **1 and 2** fire on the **same candle** at the **same price** — two separate signal records, one per scenario number.

---

## Entry logic

| Field | Rule |
|-------|------|
| **Entry candle** | The candle where the trade scenario is detected (no wait for the next candle) |
| **Entry time** | That candle’s timestamp in **IST** |
| **Entry price** | **Candle mid price:** `(high + low) / 2` |

---

## Profit target

Before simulating exit, a per-trade **profit target** (in price points) is computed (`src/rules/deepakTarget.ts`):

| Mode | Formula |
|------|---------|
| **Fixed** (adaptive disabled) | `profitTarget` from config — default **0.7** |
| **Adaptive** (default **on**) | Average of the last **20** prior trading days' daily ranges: for each day, `dayHigh − dayLow` across session candles, then mean of those 20 values |

If fewer than **20** prior trading days with valid range exist, the fixed default **0.7** is used.

**Target price from entry:**

- **BUY:** `entryPrice + profitTarget`
- **SELL:** `entryPrice − profitTarget`

---

## Exit and target-hit logic

After entry, the engine scans **forward** through later session candles on the **same trading day** (after entry time, still within 09:15–15:30).

### When is the target considered hit?

The target is hit on the **first** candle where the **candle mid price** reaches the target — **not** when only the wick touches it.

| Side | Target hit condition |
|------|----------------------|
| **BUY** | `(high + low) / 2 ≥ targetPrice` |
| **SELL** | `(high + low) / 2 ≤ targetPrice` |

**Important:** If the wick crosses the target but mid price has not, the target is **not** hit and scanning continues.

### On target hit

| Field | Value |
|-------|--------|
| `targetHit` | `true` |
| Exit time | IST time of the **first** hitting candle |
| Exit price | **Mid price** of that candle |
| Profit | `exitPrice − entryPrice` (BUY) or `entryPrice − exitPrice` (SELL) |

Reported profit is always **≥ profitTarget** when `targetHit` is true (mid must reach or exceed the target level).

### When target is not hit

If no later session candle satisfies the mid-price condition, `exit` is **`null`** (exit **pending** for that signal).

There is no stop-loss or time-based forced exit in the Deepak simulator — only profit-target exits within the session.

---

## Live decision (`BUY` / `SELL` / `HOLD`)

The dashboard decision is derived from open signals:

1. Consider only signals whose target has **not** been hit (`exit` is null or `targetHit` is false).
2. If **every** signal has hit its target → **`HOLD`**
3. Otherwise → side (**`BUY`** or **`SELL`**) of the **last** still-open signal by time

---

## Configuration reference

From `config.deepakDecision` in `src/config.ts`:

```ts
deepakDecision: {
  sessionStart: "09:15",
  sessionEnd: "15:30",
  initialRunSize: 4,
  profitTarget: 0.7,
  adaptiveTarget: {
    enabled: true,
    lookback: 20,
  },
}
```

BB proximity uses `config.thresholds.bbClosePctThreshold` (**0.3%**).

---

## Backtest

`runDeepakBacktest` in `src/backtest/runDeepakBacktest.ts` replays these rules day by day. Each signal becomes a trade row with entry, optional exit, `targetHit`, `profit`, and `profitTarget`.

Tests covering entry, exit, adaptive target, and mid-vs-wick behavior: `tests/rules/deepakDecision.test.ts`.

---

## Deepak morning rules add-on (09:15 Deepak only)

In addition to the legacy scenario trail above, **Deepak** (09:15 session) can emit **morning buy** and **morning sell** signals (scenario **5**) from BB + RSI conditions in the first hour. Deepak-2 and Deepak-3 do **not** use these rules.

Implementation: `src/rules/deepakMorningRules.ts`, wired in `analyzeDayWithVariant()` when `config.deepakDecision.morningRules.enabled` is true.

### Setup window (09:15–10:15 IST)

Five 15-minute candles from session open through 10:15.

**Morning BUY setup — Lower-Band Support Recovery (LBSR):**

| Check | Rule |
|-------|------|
| a | All 5 candles in **BB lower** zone (crossed or close) |
| b | **09:15** candle **crosses** BB lower (opening pierce / session low) |
| c | No candle after 09:15 makes a **lower low** than 09:15 |
| d | RSI at **09:15** ≤ 40; RSI at **10:15** > 09:15 RSI and < 50; majority RSI pairs rising |
| e | All closes below **BB middle**; last two candles (10:00, 10:15) are **green** |

**Morning SELL setup — Upper-Band Resistance Rejection (UBRR):**

| Check | Rule |
|-------|------|
| a | All 5 candles in **BB upper** zone (crossed or close) |
| b | **09:15** candle **crosses** BB upper (opening extension / session high) |
| c | No candle after 09:15 makes a **higher high** than 09:15 |
| d | RSI at **09:15** ≥ 60; peak RSI in window ≥ 65; RSI at **10:15** below peak and ≥ 50 |
| e | Final RSI pair (10:00→10:15) decreasing; all closes above **BB middle**; **10:15 red** |

### Entry at 10:30 IST

**BUY:** Green 10:30 candle with **close above BB middle** (breakout confirm). Entry at candle mid.

**SELL:** Red 10:30 candle with **close below BB middle** (breakdown confirm). Entry at candle mid.

Exit uses the same profit-target simulation as other Deepak signals (`attachExits`).

### Conflict resolution

When a morning signal qualifies, **opposite-side legacy Deepak signals are suppressed** for that day:

- Morning **BUY** → drop legacy **SELL** signals (same-side legacy signals kept).
- Morning **SELL** → drop legacy **BUY** signals.

Suppression notes are appended to the decision `reasons` array.

Configuration (`config.deepakDecision.morningRules`):

```ts
morningRules: {
  enabled: true,
  setupWindowStart: "09:15",
  setupWindowEnd: "10:15",
  entryTimeIst: "10:30",
  buyRsiStartMax: 40,
  buyRsiEndMax: 50,
  sellRsiStartMin: 60,
  sellRsiPeakMin: 65,
  sellRsiEndMin: 50,
  majorityMinPairs: 3,
}
```

Tests: `tests/rules/deepakMorningRules.test.ts` and suppression cases in `tests/rules/deepakDecision.test.ts`.

---

## Deepak dual-band deferral (09:15 Deepak only)

When early candles show **both** BB-upper and BB-lower proximity for **2+ consecutive** candles, Deepak **defers** early continue-2 BUY/SELL conclusions around 10:15 IST.

**Resolve (only after 10:15 IST):** starting at 10:30, wait for **3 consecutive exclusive** proximity candles:

| Streak | Signal | Scenario |
|--------|--------|----------|
| 3× upper-only | **BUY** on 3rd candle | `deepak deferred upper resolve - 3` (scenario **6**) |
| 3× lower-only | **SELL** on 3rd candle | `deepak deferred lower resolve - 3` (scenario **6**) |

Both-band or neither-band candles **reset** the exclusive streak. First tip wins.

Configuration (`config.deepakDecision.dualBandDeferral`):

```ts
dualBandDeferral: {
  enabled: true,
  minBothCandles: 2,
  majorityAfterTimeIst: "10:15",
  resolveRunLength: 3,
}
```

Implementation: helpers + `applyDualBandDeferral()` in `src/rules/deepakCore.ts`. Tests: `tests/rules/deepakDualBandDeferral.test.ts`.

---

## Deepak RSI extreme continue-2 deferral (09:15 Deepak only)

When early continue-2 would fire into an RSI extreme, Deepak **suppresses** that continue-2 and waits for a recovery tip by **12:00 IST**.

| Situation at ~10:15 | Action | Recovery tip (scenario **7**) |
|---------------------|--------|-------------------------------|
| `CONTINUE_DOWN_2` SELL and RSI ≤ 40 | Suppress SELL | 3× higher closes + rising RSI (each ≥ 40) → **BUY** on 3rd candle |
| `CONTINUE_UP_2` BUY and RSI ≥ 60 | Suppress BUY | 3× lower closes + falling RSI (each ≤ 60) → **SELL** on 3rd candle |

Tip window: earliest **11:00**, latest **12:00**. Color does not matter — only close direction and RSI path. First tip wins; no tip after the deadline.

Configuration (`config.deepakDecision.rsiExtremeContinueDefer`):

```ts
rsiExtremeContinueDefer: {
  enabled: true,
  maxRsiAtSellDefer: 40,
  minRsiOnBuyRecover: 40,
  minRsiAtBuyDefer: 60,
  maxRsiOnSellRecover: 60,
  recoverRunLength: 3,
  tipDeadlineIst: "12:00",
}
```

Implementation: `applyRsiExtremeContinueDeferral()` in `src/rules/deepakCore.ts` (runs after dual-band deferral). Tests: `tests/rules/deepakRsiExtremeContinueDeferral.test.ts`.

---

## Deepak-2 (10:15 IST session)

**Deepak-2** uses the same buy/sell/exit rules as Deepak above, but the session anchor starts at **10:15 IST** instead of 09:15:

| Aspect | Deepak | Deepak-2 |
|--------|--------|----------|
| Session | 09:15–15:30 IST | 10:15–15:30 IST |
| 4-candle anchor | 09:15 … 10:00 | 10:15 … 11:00 |
| Earliest trade signal | ~10:15 | ~11:15 |

Configuration: `config.deepakDecision2`. Evaluator: `evaluateDeepak2Decision()`. Backtest: `runDeepak2Backtest()`. API routes: `/api/backtest/deepak-2` and `/api/backtest/deepak-2/day-scan`.

Original Deepak at 09:15 includes the optional morning rules add-on above; Deepak-2 runs in parallel on the dashboard and in separate backtest/day-scan tabs.

---

## Deepak Watch-Party (Deepak entry + Deepak-2 stop-loss)

**Deepak Watch-Party** overlays Deepak entries at **10:15 IST** with a Deepak-2 confirmation watch. It is a separate strategy module — existing Deepak and Deepak-2 backtests are unchanged.

Implementation: `src/rules/deepakWatchParty.ts`. Backtest: `runDeepakWatchPartyBacktest()`.

### Eligibility

Only **Deepak** trade signals whose entry time is exactly **10:15 IST** participate. All other Deepak entry times are excluded from this strategy.

### Watch-party rules

After a qualifying Deepak entry, the engine evaluates **Deepak-2** signals on the same day from 10:15 onward:

| Deepak entry @ 10:15 | First opposite Deepak-2 trade signal after entry | Result |
|----------------------|---------------------------------------------------|--------|
| **BUY** | None before target / session end | Normal Deepak **profit-target** exit |
| **BUY** | **SELL** scenario fires | **Stop out** at that Deepak-2 SELL signal's entry mid price |
| **SELL** | None before target / session end | Normal profit-target exit |
| **SELL** | **BUY** scenario fires | **Stop out** at that Deepak-2 BUY signal's entry mid price |

Same-side Deepak-2 signals are ignored; monitoring continues until an opposite signal, target hit, or session end.

### Exit precedence

The engine compares the first profit-target hit with the first opposite Deepak-2 signal chronologically:

1. **Earlier event wins** — target exit or Deepak-2 stop, whichever comes first.
2. **Same 15-minute candle** — Deepak-2 stop takes precedence over target.
3. **Stop profit** — standard P&L: `stopPrice − entryPrice` (BUY) or `entryPrice − stopPrice` (SELL).

Trade rows include `exitReason` (`target` | `deepak2_stop`), `stopLossHit`, `deepak2StopScenarioKey`, and `deepak2StopTimeIst`.

### Configuration

From `config.deepakWatchParty` in `src/config.ts`:

```ts
deepakWatchParty: {
  entryTimeIst: "10:15",
  watchVariant: "deepak2",
  sessionEnd: "15:30",
}
```

### API routes

| Route | Purpose |
|-------|---------|
| `GET /api/backtest/deepak-watch-party?from&to&symbol` | Single-symbol backtest |
| `GET /api/backtest/deepak-watch-party/day-scan?date` | Sector watchlist day scan |

Tests: `tests/rules/deepakWatchParty.test.ts`.

---

## Deepak-3 (sure-shot filters — standalone rule)

**Deepak-3** is a separate rule module derived from analysis of high hit-rate days in the daily scan simulator (e.g. 2026-03-12, 2026-05-12, 2026-06-11). It applies the same core scenario trail as Deepak but adds **entry gates** that filter for higher-confidence continuation setups.

Implementation: `src/rules/deepak3Decision.ts` (uses shared core in `src/rules/deepakCore.ts`).

### Dashboard and API

| Surface | Location |
|---------|----------|
| **Widget tab** | **Deepak-3 Day Scan** in the Trading Tools dashboard |
| **API route** | `GET /api/backtest/deepak-3/day-scan?date=YYYY-MM-DD` |
| **Payload builder** | `buildDeepak3DayScanPayload()` in `src/api/buildDeepak3DayScanPayload.ts` |

The day-scan widget runs `scanDeepak3Decisions` across the full sector watchlist so the **G4 sector-breadth gate** is applied correctly. Deepak-3 is not integrated into the Day Scan Simulator.

### Why Exit Signals showed 100% hit on analysis days

Two factors explain the simulator table:

1. **UI selection bias** — the Exit Signals table only lists trades where the profit target was hit. Missed targets remain in Entry Signals as open positions and never appear in Exit Signals.
2. **Structural alignment** — on trending days, the 4-candle BB anchor plus continue-direction-2 entries align with momentum, and the adaptive profit target scales with recent daily ranges.

### Deepak-3 entry gates

| Gate | Config key | Rule |
|------|------------|------|
| **G1: Crossed anchor** | `requireCrossedAnchor` | All 4 anchor candles must **cross** the dominant band (not merely close to it) |
| **G2: Continue-2 only** | `continueScenariosOnly` | Only `continue upward direction - 2` and `continue downward direction - 2` (scenario 4); suppresses switch scenarios 1–3 |
| **G3: Entry range** | `requireEntryRangeGteTarget` | Entry candle range `(high − low)` must be ≥ computed profit target |
| **G4: Sector breadth** | `minSectorBreadth` | Batch scan only: keep signals when ≥ N stocks in the same sector share the same side (default **3**) |

Each emitted signal includes a `confidenceFactors` array listing which gates passed.

### API

| Function | Scope | G4 applied |
|----------|-------|------------|
| `evaluateDeepak3Decision(snapshots, date?)` | Single symbol | No |
| `scanDeepak3Decisions(entries, date)` | Watchlist batch | Yes |
| `scanDeepak3DayDecisions(entries, date)` | Alias for batch scan | Yes |

### Configuration

From `config.deepakDecision3` in `src/config.ts`:

```ts
deepakDecision3: {
  sessionStart: "09:15",
  sessionEnd: "15:30",
  initialRunSize: 4,
  profitTarget: 0.7,
  adaptiveTarget: { enabled: true, lookback: 20 },
  requireCrossedAnchor: true,
  continueScenariosOnly: true,
  requireEntryRangeGteTarget: true,
  minSectorBreadth: 3,
}
```

Tests: `tests/rules/deepak3Decision.test.ts`, `tests/api/buildDeepak3DayScanPayload.test.ts`.

---

## Deeppro (Stch Mtm exhaustion — pink-circle pattern)

**Deeppro** detects Stochastic Momentum (`Stch Mtm` on Kite — `%K=10`, double-smooth `3/3`, signal `%D EMA=10`) exhaustion reversals — the chart “pink circle” setup — and emits **BUY** / **SELL** entries for Day Scan, Day Scan Post-Mortem, and backtests. Data path is **Kite historical 15m only** (no Yahoo).

Signals fire only on a **literal SMI↔signal cross or touch** (black vs red on Stch Mtm): SMI must be strictly on one side of the signal, then move to at-or-across the other side. No stall / SMI-exit / MACD remaps when `signalOnSmiCrossOnly` is on. There is **no** black-line slope / angle gate on BUY or SELL.

Implementation: `src/rules/deepproDecision.ts`. Indicators: `src/indicators/stochasticMomentum.ts`. Config: `config.deeppro` in `src/config.ts`.

### Dashboard and API

| Surface | Location |
|---------|----------|
| **Widget tab** | **Day Scan** → rule variant **Deeppro**; also **Day Scan Post-Mortem** |
| **API route** | `GET /api/backtest/deeppro/day-scan?date=YYYY-MM-DD` |
| **Payload builder** | `buildDeepproDayScanPayload()` in `src/api/buildDeepproDayScanPayload.ts` |
| **Backtest** | `runDeepproBacktest()` / `GET /api/backtest/deeppro` |

Day Scan / Post-Mortem scan the full **100-stock** liquid NSE universe in `SECTOR_WATCHLIST` (`src/symbols/sectorWatchlist.ts`). When the selected Day Scan date is **today (IST)**, after the first run the UI **auto-refreshes every 15 minutes until 15:15 IST**.

### Raw detection (before quality gates)

Session: **09:15–15:30 IST**. Event candle must be **before 14:00 IST**. Lookback for peak/trough SMI + BB tag: **16** bars (~4h on 15m).

With `signalOnSmiCrossOnly: true` (default), BUY/SELL publish **only** on the Stch Mtm **SMI↔signal cross** candle — no look-ahead remap to stall / SMI-exit / MACD-cross.

#### SELL (overbought exhaustion)

| Step | Rule |
|------|------|
| 1 | Stch Mtm **bearish cross/touch** while in/from overbought (`SMI ≥ 40`) |
| 2 | Deep peak in lookback: peak SMI **≥ 65** |
| 3 | Upper Bollinger Band tagged in the same lookback |
| 4 | MACD histogram **declining** on the cross candle |
| 5 | MACD hist Δ vs price ≥ `minMacdHistDeltaPct` (default **0.01%**) |
| 6 | Event = SMI cross candle (`eventKind: smi_cross`) |

#### BUY (oversold exhaustion — mirror)

| Step | Rule |
|------|------|
| 1 | Stch Mtm **bullish cross/touch** while in/from oversold (`SMI ≤ -40`) |
| 2 | Deep trough in lookback: trough SMI **≤ -65** |
| 3 | Lower Bollinger Band tagged in the same lookback |
| 4 | MACD histogram **rising** on the cross candle |
| 5 | MACD hist Δ vs price ≥ `minMacdHistDeltaPct` |
| 6 | Event = SMI cross candle (`eventKind: smi_cross`) |

**Times shown in Day Scan:**

| Field | Meaning |
|-------|---------|
| **Entry IST** | SMI cross candle (`timeIst`) |
| **Scenario / event** | Same cross candle (`eventTimeIst` / `eventKind: smi_cross`) |

Day Scan Deeppro rows are **entries only** (`profitTarget: 0`, exit columns empty). Same-day square-off P&amp;L is a **study / post-mortem** metric, not a live fill guarantee.

### Quality gates (enhanced — default on)

After raw detect, signals must pass `passesDeepproSellQuality` / `passesDeepproBuyQuality`. Tuned on Kite 15m watchlist studies to favor same-day best square-off **≥ ~0.75%**. Intentionally does **not** over-trust extreme peak/trough SMI alone, ultra-low BUY RSI (≤30), or SELL BB-upper match tags. Only **`smi_cross`** event kinds are allowed.

#### SELL quality

| Gate | Rule |
|------|------|
| Event kind | **`smi_cross` only** |
| Event window | Inclusive **10:45–12:30** IST |
| RSI | Event RSI **≥ 67** (measured on the cross candle) |
| BB upper | Gap to upper band **≤ 1.75%** |

#### BUY quality

Outer caps: allowed kind **`smi_cross`**, event **≤ 13:15**, RSI **≤ 50** (≤ **60** if BB lower matched), BB lower gap **≤ 1.0%**. Then one of:

| Path | Rule |
|------|------|
| **A — BB-lower matched** | Lower band **close/crossed**; reject dual-band squeeze (both bands matched); after **11:00** require RSI **≥ 40** (recovery, not waterfall) |
| **B — Morning unmatched** | No BB-lower match; event **≤ 10:30**; BB lower gap **≤ 0.65%** |
| **C — Extreme cross** | RSI **≤ 12**, BB lower gap **≤ 0.9%**, MACD hist **≤ -5**, event **≤ 12:30** (EICHERMOT-style) |

These gates apply everywhere Deeppro is evaluated (Day Scan, Post-Mortem, backtest, study scripts) via `evaluateDeepproDay`.

### Scenario numbers (Day Scan table)

| Event kind | Sc# | Typical side |
|------------|-----|--------------|
| `smi_cross` | 1 | either (default published kind) |
| `stall_at_highs` / `stall_at_lows` | 2 | legacy only (`signalOnSmiCrossOnly: false`) |
| `smi_exit_overbought` / `smi_exit_oversold` | 3 | legacy only |
| `macd_bear_cross` / `macd_bull_cross` | 4 | legacy only |

### Configuration

From `config.deeppro` in `src/config.ts`:

```ts
deeppro: {
  sessionStart: "09:15",
  sessionEnd: "15:30",
  smi: { lengthK: 10, lengthD: 3, lengthEma: 10 },
  overboughtLevel: 40,
  minPeakSmi: 65,
  oversoldLevel: -40,
  maxTroughSmi: -65,
  lookbackBars: 16,
  signalOnSmiCrossOnly: true,
  stallBodyRatioMax: 0.35,
  entryDeadlineIst: "14:00",
  minMacdHistDeltaPct: 0.01,
  qualityFilter: {
    enabled: true,
    sell: {
      eventFromIst: "10:45",
      eventToIst: "12:30",
      minEventRsi: 67,
      maxBbUpperGapPct: 1.75,
      allowedEventKinds: ["smi_cross"],
    },
    buy: {
      eventToIst: "13:15",
      maxEventRsi: 50,
      maxBbLowerGapPct: 1.0,
      allowedEventKinds: ["smi_cross"],
      matchedBbMaxEventRsi: 60,
      unmatchedEventToIst: "10:30",
      unmatchedMaxBbLowerGapPct: 0.65,
      matchedRecoveryAfterIst: "11:00",
      matchedRecoveryMinEventRsi: 40,
      rejectBothBandsMatched: true,
      allowExtremeStallException: true,
      extremeStallMaxEventRsi: 12,
      extremeStallMaxBbLowerGapPct: 0.9,
      extremeStallMaxMacdHist: -5,
      extremeStallEventToIst: "12:30",
    },
  },
}
```

Post-Mortem Deeppro signal-day cache is invalidated via `DEEPPRO_SIGNAL_DAYS_RULES_REVISION` in `src/postMortem/store.ts` when detection/quality rules change.

### Study scripts (same-day square-off ≥ 0.75%)

| Script | Purpose |
|--------|---------|
| `scripts/study-deeppro-day-multisymbol.ts` | One session date × watchlist |
| `scripts/study-deeppro-date-range.ts` | Date range × 50 or 100-stock universe |
| `scripts/study-deeppro-squareoff.ts` | Single-symbol multi-day study |
| `scripts/scan-deeppro.ts` | Single-symbol signal scan |

Example reports under `reports/` (e.g. `deeppro-universe100-2026-01-01_to_2026-03-31-gte0.75.md`).

### Tests

- `tests/rules/deepproDecision.test.ts` — detection + SELL/BUY quality paths  
- `tests/api/buildDeepproDayScanPayload.test.ts` — Day Scan payload wiring  
- `tests/indicators/stochasticMomentum.test.ts` — SMI math

## RulePNB (PNB-only favourable profit-range gates)

**RulePNB** encodes the practical takeaway from the PNB 60-day rule-free best BUY/SELL study: favourable RSI / Stch Mtm (SMI) / Bollinger proximity bands by profit range.

It is a **totally separate rule for PNB only**:
- Does **not** scan the 100-stock sector watchlist
- Does **not** share Deepak / Deepak-2 / Deeppro scenario logic
- Does **not** mix RulePNB reasons into the main dashboard decision/reasons list
- Backtest / Post-Mortem reject any symbol other than **PNB**

| Surface | Detail |
|--------|--------|
| **Widget tab** | **Day Scan** → rule variant **RulePNB** (PNB only); also **Day Scan Post-Mortem** and symbol **Post-Mortem** (symbol locked to PNB) |
| **API** | `GET /api/backtest/rule-pnb/day-scan?date=YYYY-MM-DD` · `GET /api/backtest/rule-pnb?symbol=PNB&from=&to=` |
| **Payload builder** | `buildRulePnbDayScanPayload()` in `src/api/buildRulePnbDayScanPayload.ts` |
| **Decision engine** | `evaluateRulePnbDay` / `evaluateRulePnbDecision` in `src/rules/rulePnbDecision.ts` |
| **Config** | `config.rulePnb` (`tradingSymbol: "PNB"`) in `src/config.ts` |

### Scenarios

1. **BUY quality** (`rulePnb buy quality`) — best 1.7%–0.9% band: RSI 25–50, SMI ≤ −40, near BB lower (gap ≤ 0.7% or crossed/close).
2. **SELL quality** (`rulePnb sell quality`) — mid/low SELL bands: RSI 50–70, SMI ≥ 40, near BB upper (gap ≤ 0.8% or crossed/close).
3. **BUY extended** (`rulePnb buy extended`) — biggest-mover 3%–1.8% style: prefer negative SMI; RSI mixed; BB lower gaps can be wider (≤ 1.4%). Used only when no BUY quality fires that day.

Entry price = candle mid `(high+low)/2`. Event candle must be before **14:00 IST**. One earliest BUY and one earliest SELL per session date.

### Tests

- `tests/rules/rulePnbDecision.test.ts` — quality matchers + quiet day  
- `tests/api/buildRulePnbDayScanPayload.test.ts` — Day Scan payload wiring

## RuleSUNPHARMA (SUNPHARMA-only favourable profit-range gates)

**RuleSUNPHARMA** encodes the practical takeaway from the SUNPHARMA 60-day rule-free best BUY/SELL study: favourable RSI / Stch Mtm (SMI) / Bollinger proximity bands by profit range.

It is a **totally separate rule for SUNPHARMA only**:
- Does **not** scan the 100-stock sector watchlist
- Does **not** share Deepak / Deepak-2 / Deeppro / RulePNB scenario logic
- Does **not** mix RuleSUNPHARMA reasons into the main dashboard decision/reasons list
- Backtest / Post-Mortem reject any symbol other than **SUNPHARMA**

| Surface | Detail |
|--------|--------|
| **Widget tab** | **Day Scan** → rule variant **RuleSUNPHARMA** (SUNPHARMA only); also **Day Scan Post-Mortem** and symbol **Post-Mortem** (symbol locked to SUNPHARMA) |
| **API** | `GET /api/backtest/rule-sunpharma/day-scan?date=YYYY-MM-DD` · `GET /api/backtest/rule-sunpharma?symbol=SUNPHARMA&from=&to=` |
| **Payload builder** | `buildRuleSunpharmaDayScanPayload()` in `src/api/buildRuleSunpharmaDayScanPayload.ts` |
| **Decision engine** | `evaluateRuleSunpharmaDay` / `evaluateRuleSunpharmaDecision` in `src/rules/ruleSunpharmaDecision.ts` |
| **Config** | `config.ruleSunpharma` (`tradingSymbol: "SUNPHARMA"`) in `src/config.ts` |

### Scenarios

1. **BUY quality** (`ruleSunpharma buy quality`) — best 1.7%–0.9% band: RSI 33–56, SMI ≤ −40, near BB lower (gap ≤ 0.5% or crossed/close).
2. **SELL quality** (`ruleSunpharma sell quality`) — mid/low SELL bands: RSI 56–72, SMI ≥ 40, tight BB upper (gap ≤ 0.3% or crossed/close).
3. **BUY extended** (`ruleSunpharma buy extended`) — biggest-mover 3%–1.8% style: less oversold than mid bucket; mid-zone SMI OK (≤ 40); still near BB lower (gap ≤ 0.5%). Used only when no BUY quality fires that day.

Entry price = candle mid `(high+low)/2`. Event candle must be before **14:00 IST**. One earliest BUY and one earliest SELL per session date.

### Tests

- `tests/rules/ruleSunpharmaDecision.test.ts` — quality matchers + quiet day  
- `tests/api/buildRuleSunpharmaDayScanPayload.test.ts` — Day Scan payload wiring

## Per-symbol favourable rules (LTM / ICICIGI / TECHM / TVSMOTOR / POLICYBZR)

Five **separate, symbol-locked** rules encoded from each stock’s 60-day rule-free profit-range study (same pattern as RulePNB / RuleSUNPHARMA):

| Rule | Symbol | Day Scan variant |
|------|--------|------------------|
| **RuleLTM** | LTM | `ruleLtm` |
| **RuleICICIGI** | ICICIGI | `ruleIcicigi` |
| **RuleTECHM** | TECHM | `ruleTechm` |
| **RuleTVSMOTOR** | TVSMOTOR | `ruleTvsmotor` |
| **RulePOLICYBZR** | POLICYBZR | `rulePolicybzr` |

| Surface | Detail |
|--------|--------|
| **Widget tab** | **Day Scan** / **Day Scan Post-Mortem** / **Post-Mortem** — each variant locks its symbol |
| **API** | `GET /api/backtest/symbol-rule/{ltm\|icicigi\|techm\|tvsmotor\|policybzr}/day-scan?date=` · backtest sibling |
| **Engine** | `evaluateFavourableSymbolDay` in `src/rules/favourableSymbolRule.ts` |
| **Config** | `config.favourableSymbolRules` in `src/config.ts` |
| **Study summary** | `reports/five-stock-favourable-rules-60d-summary.md` |

Each rule exposes BUY quality / SELL quality / BUY extended scenarios (entry mid, before 14:00 IST). They do **not** scan the 100-stock watchlist and do **not** mix into shared Deepak/Deeppro reasons.

### Tests

- `tests/rules/favourableSymbolRule.test.ts` — symbol locks + quality matchers
