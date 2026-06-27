# Elephant Bar Multi-Contract Strategy

This is a working note for the elephant bar idea discussed on 2026-06-19. The goal is to preserve the useful part of the existing MES/MESU opening logic while changing the payoff shape: small initial exposure, larger size only when the market proves that it is expanding.

---

## 1. Core Hypothesis

An **elephant bar** is a large directional expansion bar that originates near the 20 moving average and becomes irregularly large compared to the bars immediately before it.

The working belief is:

* Elephant bars have unusually high follow-through.
* A valid elephant bar is visible before the 4-second bar completes because its in-progress body/range becomes abnormally large.
* If an elephant bar fails, an opposite-direction elephant bar shortly afterward can be an even stronger continuation signal in the new direction.

This makes elephant bars useful as a contract-scaling trigger. We do not want to enter maximum size at the initial idea. We want to earn the right to be bigger when the market shows impulse.

---

## 2. Current Visual Definition

Using the `MESU_reg_4sec` examples:

* `2026-06-18T06:33:28` - Sell elephant bar.
* `2026-06-18T06:34:48` - Sell elephant bar.
* `2026-06-18T06:36:40` - Sell elephant bar. This was initially annotated as "Pelican bar" by typo, but should be treated as an elephant bar.

Observed traits:

* The bar starts near the moving average field exported as `ema`.
* The body/range is materially larger than the recent local bars.
* The bar closes directionally, away from the moving average.
* The bar often begins or confirms a forceful move away from the 20 MA.

Working definition:

> A large directional expansion bar, unusually big versus recent bars, that starts from or near the 20 MA and drives away from it.

---

## 3. Intrabar Execution Idea

The key point is that the elephant bar should not be traded only after completion. The strategy attempts to detect that the elephant bar is forming while the 4-second bar is still live.

### Buy Example

1. A 4-second bar opens near the 20 MA.
2. As ticks arrive, the current forming bar becomes abnormally large relative to the prior bars.
3. Enter the first contract during the forming elephant bar.
4. If the bar completes as a valid bullish elephant bar, add the second contract.
5. If price moves back below the elephant bar open at any point after entry or after add, exit all contracts.

### Sell Example

1. A 4-second bar opens near the 20 MA.
2. The forming bar expands down and becomes abnormally large relative to recent bars.
3. Enter the first contract during formation.
4. If the bar completes as a valid bearish elephant bar, add the second contract.
5. If price moves back above the elephant bar open, exit all contracts.

The elephant bar open is the structural invalidation line. If the market returns through that open, the impulse thesis has failed.

---

## 4. Multi-Contract Logic

The intended use of multiple contracts is **progressive exposure**, not martingale recovery.

### Base Contract

* Enter 1 contract when the forming bar first meets the elephant-recognition threshold.
* This contract takes the initial risk.
* If the elephant fails before confirmation, only one contract is exposed.

### Add Contract

* Add the second contract only if the bar completes as a valid elephant bar.
* The add is made into confirmed momentum, not into weakness.
* After the add, both contracts share the elephant-open invalidation.

### Desired Asymmetry

* Failed elephant: lose on mostly 1 contract.
* Confirmed elephant that follows through: win on 2 contracts.
* Confirmed elephant that fails: exit both when the elephant open breaks.

This is the same contract-scaling principle we discussed earlier:

> Lose smaller when the idea is wrong early. Get bigger only when the market starts proving the idea right.

---

## 5. Failed Elephant Reversal Logic

A failed elephant bar is important information.

Example:

1. A bullish elephant bar forms.
2. It should continue higher.
3. Instead, price breaks back below the bullish elephant open.
4. The bullish impulse is now failed.
5. If a bearish elephant bar appears shortly afterward, that bearish elephant may have especially strong follow-through because trapped longs become fuel.

Mirror this for failed bearish elephants followed by bullish elephants.

We should classify elephants into at least two groups:

### Type A: Fresh Elephant

An elephant bar with no immediately failed opposite elephant context.

### Type B: Opposite Elephant After Failed Elephant

An elephant bar in the opposite direction after a prior elephant failed by breaking its open.

Hypothesis:

> Type B elephants should have higher continuation expectancy than fresh elephants.

---

## 6. Required Tick Data

Completed 4-second OHLC bars are not enough to test this properly. We need the underlying trade ticks so we can reconstruct what was knowable while the bar was forming.

Minimum useful tick export:

```text
Timestamp, LastPrice
```

Preferred export:

```text
Timestamp, LastPrice, Volume
```

Best export if available:

```text
Timestamp, LastPrice, Volume, Bid, Ask
```

The first pass can use trade ticks only. Bid/ask would help later for spread and execution assumptions.

---

## 7. Detection Rules To Test

We need to turn "elephant bar" into measurable conditions. Proposed starting parameters:

### Moving Average Origin

The 4-second bar must open near the 20 MA.

Candidate tests:

* Open is within 1-2 ticks of the MA.
* Bar range touches or crosses the MA.
* Bar body begins on/near the MA side and closes away from it.

### Abnormal Size

The forming bar's current body or range must exceed recent local norms.

Candidate tests:

* Current body >= 2.0x average body of prior 10 bars.
* Current range >= 1.75x average range of prior 10 bars.
* Current body >= 2.5x median body of prior 10 bars.
* Minimum absolute body size, such as 6-10 ticks.

### Directional Quality

The bar should be directional, not just wide and indecisive.

Candidate tests:

* For a buy: current price is near the high of the forming bar.
* For a sell: current price is near the low of the forming bar.
* Body-to-range ratio exceeds a threshold, such as 0.65 or 0.75.

### Timing

Since this is a 4-second chart, detection timing matters.

Candidate tests:

* Allow recognition only after at least 1 second of the 4-second bar has elapsed.
* Allow recognition immediately when thresholds are met.
* Compare recognition at first threshold tick vs. bar-close confirmation.

---

## 8. Simulation Design

For each 4-second bar:

1. Reconstruct the forming bar from ticks.
2. Maintain prior 4-second bars for moving average and recent-size context.
3. Detect when the forming bar first becomes an elephant candidate.
4. Enter 1 contract at the recognition tick price.
5. If price breaks the elephant open before completion, exit the first contract.
6. At bar close, if the completed bar still qualifies as an elephant, add the second contract.
7. After add, exit both contracts if price breaks the elephant open.
8. Track continuation after completion.

Metrics:

* Recognition time within the bar.
* Entry price for contract 1.
* Add price for contract 2.
* Elephant open stop price.
* Maximum favorable excursion after recognition.
* Maximum adverse excursion after recognition.
* Whether the elephant open was broken.
* Profit/loss in ticks and contract-ticks.
* Follow-through to +1, +2, +3, and +4 bars.
* Fresh elephant vs. failed-opposite-elephant performance.

---

## 9. Experiments

### Experiment 1: Validate Elephant Follow-Through

Find all completed elephant bars in `MESU_reg_4sec` using candidate thresholds.

Measure:

* Continuation rate to +1 bar.
* Continuation rate to +2 bars.
* Continuation rate to +3 bars.
* Rate of breaking the elephant open.
* Average and median MFE/MAE.

Goal:

Confirm whether elephant bars really have a high follow-through rate.

### Experiment 2: Intrabar Recognition

Using tick data, determine when each completed elephant bar would have become recognizable before close.

Measure:

* Average recognition delay in seconds.
* Entry slippage from elephant open.
* Distance from recognition price to elephant-open stop.
* Whether entering during formation improves or worsens expectancy vs. waiting for close.

Goal:

Test whether the elephant is visible early enough to trade profitably.

### Experiment 3: Two-Contract Scaling

Simulate:

* Contract 1 enters at elephant recognition tick.
* Contract 2 adds at elephant bar close if still valid.
* Both exit if the elephant open breaks.

Measure:

* P/L in contract-ticks.
* Win rate.
* Average win and average loss.
* Best and worst sessions.
* Whether add-on size improves expectancy without increasing early-failure losses too much.

Goal:

Validate the progressive exposure model.

### Experiment 4: Failed Elephant Reversal

Track elephants that fail by breaking their open.

Then measure the next opposite elephant within a configurable window:

* Within 3 bars.
* Within 5 bars.
* Within 10 bars.
* Within 30 seconds.
* Within 60 seconds.

Measure follow-through of those opposite elephants.

Goal:

Determine whether opposite elephants after failure are a special high-expectancy class.

### Experiment 5: Session/Time Filters

Break results down by time of day:

* 06:30-07:00.
* 07:00-08:00.
* 08:00-11:00.
* Afternoon session.

Goal:

Find whether elephant logic is mainly an opening-drive strategy or works broadly.

---

## 10. Open Questions

* Is the exported `ema` on `MESU_reg_4sec` definitely the 20 MA/EMA?
* Should "near the 20 MA" use the bar open, any touch during the bar, or the bar's starting range?
* Should elephant size compare against prior 10 bars, prior 20 bars, or a volatility-adjusted baseline?
* Is body size or full range more predictive?
* Should first-contract entry happen as soon as the size threshold triggers, or only after the bar is also directional?
* Should the second contract add exactly at bar close, or on the first tick after close?
* After a failed elephant, how long should the opposite-elephant reversal context remain valid?

---

## 11. Next Steps

1. Export trade tick data from MultiCharts QuoteManager for the same MESU contract/date range.
2. Place the tick export in `C:\MultiChartsExports`.
3. Import the tick data into this repo.
4. Build a tick-to-4-second-bar reconstruction script and verify it matches `MESU_reg_4sec`.
5. Implement elephant detection using the annotated examples as calibration.
6. Run the experiments above and compare against the existing one-contract recovery campaign.

The main thing to preserve: this strategy should use multiple contracts to press verified impulse, not to recover from damage.
