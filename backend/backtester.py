import os
import json
import argparse
from datetime import datetime
from itertools import product

# Default configuration settings for the strategy
DEFAULT_CONFIG = {
    "ema_slope_period": 3,          # Number of bricks back to calculate EMA slope
    "ema_slope_threshold": 1.0,      # Minimum slope of the EMA (points change)
    "wick_retest_tolerance": 21.0,   # Max points the wick low/high can be from the EMA to be considered a 'touch'
    "max_ema_pierce": 1.75,         # Max points a wick can pierce past the EMA before it is considered broken
    "min_wick_length": 5.0,         # Minimum length of the rejection wick (tail) in points
    "max_ema_distance": 60.0,       # Maximum distance of brick close from EMA (prevents over-extended chase entries)
    "tick_size": 0.25,               # MNQ minimum price increment
    "tail_break_ticks": 2,           # Failure after price exceeds the signal tail by this many ticks
    "cooldown_bars": 0,             # Minimum number of bars to wait between signals (0 to disable)
    "wick_body_offset_ticks": 0,    # Ticks the wick must pierce beyond previous open (positive = deeper, negative = shallower)
    "start_time": "06:31:00",       # Skip the first minute after the session open
    "end_time": "11:00:00",         # End of daily trading window (PST)
    "arid_lookback": 8,
    "arid_max_overlap_bricks": 0.95,
    "arid_max_reversals": 5,
    "arid_ema_slope_period": 8,
    "arid_ema_slope_threshold": 10.0,
    "arid_min_ema_gap_bricks": 0.5,
    "bounce_near_ema_tolerance": 3.0,
    "bounce_min_tail": 1.0,
    "bounce_min_ema_gap": 4.0,
    "bounce_max_left_overlap": 0.56,
    "bounce_min_yellow_penetration": 1.75,
    "ema_bounce_stop_buffer_ticks": 2,
    "ema_bounce_max_stop_ticks": 15,
    "yellow_momentum_slope_period": 8,
    "yellow_momentum_fast_slope_threshold": 30.0,
    "yellow_momentum_slow_slope_threshold": 25.0,
    "yellow_momentum_min_ema_gap": 4.0,
    "yellow_momentum_min_penetration": 1.5,
    "yellow_momentum_min_tail": 1.0,
    "yellow_momentum_arity_lookback": 8,
    "yellow_momentum_max_overlap": 0.95,
    "yellow_momentum_max_reversals": 5,
    "mes3_ema_slope_period": 8,
    "mes3_ema_slope_threshold": 2.2,
    "mes3_short_slope_period": 3,
    "mes3_short_slope_threshold": 0.7,
    "mes3_min_tail": 0.75,
    "mes3_min_close_ema_distance": 1.0,
    "mes3_arity_lookback": 8,
    "mes3_max_overlap": 1.0,
    "mes3_max_reversals": 4,
    "mes3_cooldown_bars": 3,
    "mes3_prev_tail_slope_period": 8,
    "mes3_prev_tail_slope_threshold": 2.5,
    "mes3_prev_tail_short_slope_period": 3,
    "mes3_prev_tail_short_slope_threshold": 0.9,
    "mes3_prev_tail_min_tail": 0.75,
    "mes3_prev_tail_extension_ticks": 1,
    "mes3_prev_tail_min_close_ema_distance": 1.0,
    "mes3_prev_tail_arity_lookback": 8,
    "mes3_prev_tail_max_overlap": 1.0,
    "mes3_prev_tail_max_reversals": 4,
    "mes3_prev_tail_cooldown_bars": 3,
    "set3_left_lookback": 8,
    "set3_max_left_overlaps": 1,
    "set3_ema_slope_period": 5,
    "set3_ema_slope_threshold": 4.0,
    "set3_min_ema_gap_bricks": 0.5,
    "set3_synthetic_min_ema_gap_bricks": -0.25,
    "set3_min_prior_brick_seconds": 3,
    "mes3_ha_ema_approach_slope_period": 8,
    "mes3_ha_ema_approach_slope_threshold": 1.25,
    "mes3_ha_ema_approach_ticks": 4,
    "mes3_ha_ema_approach_min_tail": 0.25,
    "mes3_ha_indecision_min_bars": 2,
    "mes3_ha_indecision_body_ratio": 0.45,
    "mes3_ha_breakout_body_ratio": 0.45,
    "mes3_ha_ema_approach_pre_seconds": 20,
    "mes3_ha_ema_approach_post_seconds": 12,
    "mes3_ha_ema_approach_cooldown_bars": 1,
    "mes3_ha_ema_approach_pullback_ticks": 0,
    "mes_reg5_long_tail_slope_period": 8,
    "mes_reg5_long_tail_slope_threshold": 0.20,
    "mes_reg5_long_tail_min_tail": 0.75,
    "mes_reg5_long_tail_min_close_distance": 1.0,
    "mes_reg5_long_tail_cooldown_bars": 3,
    "mes_reg5_ema_bounce_arity_slope_period": 8,
    "mes_reg5_ema_bounce_arity_slope_threshold": 0.22,
    "mes_reg5_ema_bounce_arity_short_slope_period": 4,
    "mes_reg5_ema_bounce_arity_short_slope_threshold": 0.36,
    "mes_reg5_ema_bounce_arity_relaxed_short_slope_threshold": 0.25,
    "mes_reg5_ema_bounce_arity_strong_short_slope_threshold": 0.38,
    "mes_reg5_ema_bounce_arity_strong_slope_threshold": 0.28,
    "mes_reg5_ema_bounce_arity_extended_short_slope_threshold": 0.36,
    "mes_reg5_ema_bounce_arity_lookback": 8,
    "mes_reg5_ema_bounce_arity_base_max_reversals": 3,
    "mes_reg5_ema_bounce_arity_strong_max_reversals": 5,
    "mes_reg5_ema_bounce_arity_base_max_overlap": 0.68,
    "mes_reg5_ema_bounce_arity_strong_max_overlap": 0.86,
    "mes_reg5_ema_bounce_arity_buy_low_to_ema_max": 0.30,
    "mes_reg5_ema_bounce_arity_sell_high_to_ema_min": 0.00,
    "mes_reg5_ema_bounce_arity_extended_buy_low_to_ema_max": 0.65,
    "mes_reg5_ema_bounce_arity_extended_sell_high_to_ema_min": 0.00,
    "mes_reg5_ema_bounce_arity_extended_min_tail": 0.75,
    "mes_reg5_ema_bounce_arity_pin_short_slope_threshold": 0.70,
    "mes_reg5_ema_bounce_arity_pin_slope_threshold": 0.55,
    "mes_reg5_ema_bounce_arity_pin_min_tail": 1.00,
    "mes_reg5_ema_bounce_arity_pin_min_ema_distance": 1.00,
    "mes_reg5_ema_bounce_arity_pin_max_ema_distance": 1.60,
    "mes_reg5_ema_bounce_arity_pin_max_overlap": 0.50,
    "mes_reg5_ema_bounce_arity_pin_max_reversals": 2,
    "mes_reg5_ema_bounce_arity_max_chase_distance": 1.25,
    "mes_reg5_ema_bounce_arity_min_close_dist_buy": 0.40,
    "mes_reg5_ema_bounce_arity_min_close_dist_sell": 0.72,
    "mes_reg5_ema_bounce_arity_cooldown_bars": 2,
    "mes_reg5_pin_bar_breakout_slope_period": 8,
    "mes_reg5_pin_bar_breakout_slope_threshold": 0.20,
    "mes_reg5_pin_bar_breakout_short_slope_period": 4,
    "mes_reg5_pin_bar_breakout_short_slope_threshold": 0.20,
    "mes_reg5_pin_bar_breakout_min_tail": 0.75,
    "mes_reg5_pin_bar_breakout_max_body": 0.50,
    "mes_reg5_pin_bar_breakout_min_tail_ratio": 0.60,
    "mes_reg5_pin_bar_breakout_max_opposite_tail": 0.25,
    "mes_reg5_pin_bar_breakout_lookback": 8,
    "mes_reg5_pin_bar_breakout_max_overlap": 0.70,
    "mes_reg5_pin_bar_breakout_max_reversals": 5,
    "mes_reg5_pin_bar_breakout_left_lookback": 12,
    "mes_reg5_pin_bar_breakout_max_left_blockers": 3,
    "mes_reg5_pin_bar_breakout_cooldown_bars": 2,
}

def load_json_data(file_path):
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Chart file not found: {file_path}")
    with open(file_path, 'r') as f:
        return json.load(f)

def load_annotations(annotations_path, file_key):
    if not os.path.exists(annotations_path):
        return []
    with open(annotations_path, 'r') as f:
        try:
            data = json.load(f)
            return data.get(file_key, [])
        except json.JSONDecodeError:
            return []

def evaluate_signal_details(data, signal_details, config):
    evaluations = []
    tail_break_distance = config["tick_size"] * config["tail_break_ticks"]

    for signal in signal_details:
        i = signal["barIndex"]
        signal_bar = data[i]
        direction = signal["action"]
        entry_price = signal_bar["close"]
        brick_size = abs(signal_bar["close"] - signal_bar["open"])
        evaluation = {
            "entry_time": signal_bar["time"],
            "barIndex": i,
            "direction": direction,
            "entry_price": entry_price,
            "brick_size": brick_size,
            "tail_break_distance": tail_break_distance,
            "result": "Pending",
        }

        if direction == "Buy":
            evaluation["success_price"] = entry_price + brick_size
            evaluation["failure_price"] = signal_bar["low"] - tail_break_distance
        else:
            evaluation["success_price"] = entry_price - brick_size
            evaluation["failure_price"] = signal_bar["high"] + tail_break_distance

        for j in range(i + 1, len(data)):
            future = data[j]
            if direction == "Buy":
                failed = future["low"] <= evaluation["failure_price"]
                succeeded = (
                    future["close"] > future["open"] and
                    future["close"] >= evaluation["success_price"]
                )
            else:
                failed = future["high"] >= evaluation["failure_price"]
                succeeded = (
                    future["close"] < future["open"] and
                    future["close"] <= evaluation["success_price"]
                )

            if failed:
                evaluation["result"] = "Fail"
                evaluation["outcome_reason"] = "Tail broken by two ticks"
                evaluation["outcome_time"] = future["time"]
                evaluation["outcome_barIndex"] = j
                break
            if succeeded:
                evaluation["result"] = "Pass"
                evaluation["outcome_reason"] = "One favorable brick completed"
                evaluation["outcome_time"] = future["time"]
                evaluation["outcome_barIndex"] = j
                break

        evaluations.append(evaluation)

    return evaluations

def get_fast_ema(bar):
    return bar.get("ema5", bar.get("ema"))

def get_slow_ema(bar):
    fast_ema = get_fast_ema(bar)
    return bar.get("ema10", fast_ema)

def calculate_arity_metrics(data, index, lookback):
    recent = data[max(0, index - lookback + 1):index + 1]
    if len(recent) < 2:
        return 0.0, 0

    body_sizes = [
        abs(bar["close"] - bar["open"])
        for bar in recent
        if abs(bar["close"] - bar["open"]) > 0
    ]
    reference_body = sum(body_sizes) / len(body_sizes) if body_sizes else 1.0

    overlap_values = []
    for previous, current in zip(recent, recent[1:]):
        overlap = max(
            0.0,
            min(previous["high"], current["high"]) - max(previous["low"], current["low"])
        )
        overlap_values.append(overlap / reference_body if reference_body else 0.0)

    directions = [
        1 if bar["close"] > bar["open"] else -1 if bar["close"] < bar["open"] else 0
        for bar in recent
    ]
    reversals = sum(
        previous != 0 and current != 0 and previous != current
        for previous, current in zip(directions, directions[1:])
    )

    average_overlap = sum(overlap_values) / len(overlap_values) if overlap_values else 0.0
    return average_overlap, reversals

def calculate_left_range_overlap(data, index, lookback):
    current = data[index]
    previous_bars = data[max(0, index - lookback):index]
    if not previous_bars:
        return 0.0, 0

    body_sizes = [
        abs(bar["close"] - bar["open"])
        for bar in previous_bars + [current]
        if abs(bar["close"] - bar["open"]) > 0
    ]
    reference_body = sum(body_sizes) / len(body_sizes) if body_sizes else 1.0

    overlap_values = []
    overlap_count = 0
    for previous in previous_bars:
        overlap = max(
            0.0,
            min(current["high"], previous["high"]) - max(current["low"], previous["low"])
        )
        if overlap > 0:
            overlap_count += 1
        overlap_values.append(overlap / reference_body if reference_body else 0.0)

    average_overlap = sum(overlap_values) / len(overlap_values) if overlap_values else 0.0
    return average_overlap, overlap_count

def run_ema_bounce_strategy(data, config):
    signal_details = []
    bounce_type_filter = config.get("bounce_type_filter", "all")
    lookback = max(3, config["arid_lookback"])
    slope_period = max(1, config.get("arid_ema_slope_period", lookback))
    slope_threshold = config["arid_ema_slope_threshold"]
    slow_slope_ratio = 0.55
    short_slope_period = 3
    near_ema_tolerance = config.get("bounce_near_ema_tolerance", 3.0)
    min_tail = config.get("bounce_min_tail", 1.0)
    min_ema_gap = config.get("bounce_min_ema_gap", 4.5)
    max_left_overlap = config.get("bounce_max_left_overlap", 0.56)
    min_yellow_penetration = config.get("bounce_min_yellow_penetration", 2.0)
    min_score = 3.0 + config.get("arid_min_ema_gap_bricks", 0.5)
    max_overlap = config["arid_max_overlap_bricks"]
    max_reversals = config["arid_max_reversals"]
    start_index = max(lookback, slope_period, short_slope_period)

    for i in range(start_index, len(data)):
        current = data[i]
        o, h, l, c = current["open"], current["high"], current["low"], current["close"]

        fast_ema = get_fast_ema(current)
        slow_ema = get_slow_ema(current)
        previous_fast = get_fast_ema(data[i - slope_period])
        previous_slow = get_slow_ema(data[i - slope_period])
        short_previous_fast = get_fast_ema(data[i - short_slope_period])
        short_previous_slow = get_slow_ema(data[i - short_slope_period])
        if None in (fast_ema, slow_ema, previous_fast, previous_slow, short_previous_fast, short_previous_slow):
            continue
        if abs(fast_ema - slow_ema) < min_ema_gap:
            continue

        fast_slope = fast_ema - previous_fast
        slow_slope = slow_ema - previous_slow
        short_fast_slope = fast_ema - short_previous_fast
        short_slow_slope = slow_ema - short_previous_slow
        average_overlap, reversals = calculate_arity_metrics(data, i, lookback)
        left_range_overlap, left_range_overlap_count = calculate_left_range_overlap(data, i, lookback)
        if average_overlap > max_overlap or reversals > max_reversals:
            continue
        is_up = c > o
        is_down = c < o
        lower_tail = min(o, c) - l
        upper_tail = h - max(o, c)
        rejection_tail = lower_tail if c > o else upper_tail
        strict_green_cross = (
            is_up and l <= slow_ema and c > slow_ema
            or is_down and h >= slow_ema and c < slow_ema
        )
        strong_strict_green_override = strict_green_cross and (
            rejection_tail >= 5.0 or
            (abs(fast_slope) + abs(slow_slope)) / 2.0 >= 17.0
        )
        if left_range_overlap > max_left_overlap and not strong_strict_green_override:
            continue
        if abs(fast_ema - slow_ema) < 5.0 and left_range_overlap > 0.48 and not strong_strict_green_override:
            continue

        bullish_trend = (
            fast_ema >= slow_ema and
            (
                fast_slope >= slope_threshold and slow_slope >= slope_threshold * slow_slope_ratio
                or short_fast_slope >= slope_threshold * 0.6 and short_slow_slope >= slope_threshold * 0.4
            )
        )
        bearish_trend = (
            fast_ema <= slow_ema and
            (
                fast_slope <= -slope_threshold and slow_slope <= -slope_threshold * slow_slope_ratio
                or short_fast_slope <= -slope_threshold * 0.6 and short_slow_slope <= -slope_threshold * 0.4
            )
        )

        yellow_buy = (
            is_up and bullish_trend and
            l <= fast_ema and c > fast_ema and
            fast_ema - l >= min_yellow_penetration and
            (lower_tail >= min_tail or min(o, c) <= fast_ema)
        )
        yellow_sell = (
            (is_down or c == o) and bearish_trend and
            h >= fast_ema and c < fast_ema and
            h - fast_ema >= min_yellow_penetration and
            (upper_tail >= min_tail or max(o, c) >= fast_ema)
        )
        green_buy = is_up and bullish_trend and l <= slow_ema + near_ema_tolerance and c > slow_ema
        green_sell = is_down and bearish_trend and h >= slow_ema - near_ema_tolerance and c < slow_ema

        action = None
        bounce_type = None
        if green_buy or yellow_buy:
            action = "Buy"
            bounce_type = "green" if green_buy else "yellow"
        elif green_sell or yellow_sell:
            action = "Sell"
            bounce_type = "green" if green_sell else "yellow"
        if action is None:
            continue
        if bounce_type_filter != "all" and bounce_type != bounce_type_filter:
            continue

        slope_strength = (abs(fast_slope) + abs(slow_slope)) / 2.0
        ema_contact_bonus = (2.0 if bounce_type == "green" else 0.0) + (1.0 if (yellow_buy or yellow_sell) else 0.0)
        arity_bonus = max(0.0, 1.0 - average_overlap)
        score = (
            slope_strength / max(1.0, slope_threshold) +
            rejection_tail / 3.0 +
            ema_contact_bonus +
            arity_bonus -
            reversals * 0.15
        )
        if bounce_type == "yellow" and slope_strength >= 18.0 and rejection_tail >= 1.0 and abs(fast_ema - slow_ema) >= 6.0:
            score += 0.5
        if strict_green_cross:
            score += 0.35
        if score < min_score:
            continue

        signal_details.append({
            "barIndex": i,
            "timestamp": current["time"],
            "action": action,
            "metrics": {
                "bounceType": bounce_type,
                "score": score,
                "ema5": fast_ema,
                "ema10": slow_ema,
                "fastSlope": fast_slope,
                "slowSlope": slow_slope,
                "shortFastSlope": short_fast_slope,
                "shortSlowSlope": short_slow_slope,
                "upperTail": upper_tail,
                "lowerTail": lower_tail,
                "averageOverlapBricks": average_overlap,
                "reversals": reversals,
                "leftRangeOverlap": left_range_overlap,
                "leftRangeOverlapCount": left_range_overlap_count,
                "emaGap": fast_ema - slow_ema,
                "strictGreenCross": strict_green_cross,
            },
        })

    return signal_details, evaluate_signal_details(data, signal_details, config)

def precompute_arity_metrics(data, lookbacks):
    return {
        lookback: [
            calculate_arity_metrics(data, index, lookback)
            for index in range(len(data))
        ]
        for lookback in lookbacks
    }

def run_yellow_momentum_strategy(data, config, include_evaluations=True, arity_cache=None):
    signal_details = []
    slope_period = max(1, config.get("yellow_momentum_slope_period", 8))
    fast_slope_threshold = config.get("yellow_momentum_fast_slope_threshold", 30.0)
    slow_slope_threshold = config.get("yellow_momentum_slow_slope_threshold", 25.0)
    min_ema_gap = config.get("yellow_momentum_min_ema_gap", 4.0)
    min_penetration = config.get("yellow_momentum_min_penetration", 1.5)
    min_tail = config.get("yellow_momentum_min_tail", 1.0)
    arity_lookback = max(2, config.get("yellow_momentum_arity_lookback", 8))
    max_overlap = config.get("yellow_momentum_max_overlap", 0.95)
    max_reversals = config.get("yellow_momentum_max_reversals", 5)
    start_index = max(slope_period, arity_lookback - 1)

    for i in range(start_index, len(data)):
        current = data[i]
        previous = data[i - slope_period]
        fast_ema = get_fast_ema(current)
        slow_ema = get_slow_ema(current)
        previous_fast = get_fast_ema(previous)
        previous_slow = get_slow_ema(previous)
        if None in (fast_ema, slow_ema, previous_fast, previous_slow):
            continue

        o, h, l, c = current["open"], current["high"], current["low"], current["close"]
        fast_slope = fast_ema - previous_fast
        slow_slope = slow_ema - previous_slow
        ema_gap = fast_ema - slow_ema
        lower_tail = min(o, c) - l
        upper_tail = h - max(o, c)
        if arity_cache and arity_lookback in arity_cache:
            average_overlap, reversals = arity_cache[arity_lookback][i]
        else:
            average_overlap, reversals = calculate_arity_metrics(data, i, arity_lookback)
        if average_overlap > max_overlap or reversals > max_reversals:
            continue

        bullish = (
            ema_gap >= min_ema_gap and
            fast_slope >= fast_slope_threshold and
            slow_slope >= slow_slope_threshold and
            c > o and
            l <= fast_ema and
            c > fast_ema and
            fast_ema - l >= min_penetration and
            lower_tail >= min_tail
        )
        bearish = (
            ema_gap <= -min_ema_gap and
            fast_slope <= -fast_slope_threshold and
            slow_slope <= -slow_slope_threshold and
            (c < o or c == o) and
            h >= fast_ema and
            c < fast_ema and
            h - fast_ema >= min_penetration and
            upper_tail >= min_tail
        )

        if not bullish and not bearish:
            continue

        action = "Buy" if bullish else "Sell"
        signal_details.append({
            "barIndex": i,
            "timestamp": current["time"],
            "action": action,
            "metrics": {
                "setupType": "yellowMomentum",
                "ema5": fast_ema,
                "ema10": slow_ema,
                "emaGap": ema_gap,
                "fastSlope": fast_slope,
                "slowSlope": slow_slope,
                "yellowPenetration": fast_ema - l if bullish else h - fast_ema,
                "upperTail": upper_tail,
                "lowerTail": lower_tail,
                "averageOverlapBricks": average_overlap,
                "reversals": reversals,
            },
        })

    evaluations = evaluate_signal_details(data, signal_details, config) if include_evaluations else []
    return signal_details, evaluations

def run_mes3_trend_tail_strategy(data, config):
    signal_details = []
    slope_period = max(1, config.get("mes3_ema_slope_period", 8))
    slope_threshold = config.get("mes3_ema_slope_threshold", 2.2)
    short_slope_period = max(1, config.get("mes3_short_slope_period", 3))
    short_slope_threshold = config.get("mes3_short_slope_threshold", 0.7)
    min_tail = config.get("mes3_min_tail", 0.75)
    min_close_distance = config.get("mes3_min_close_ema_distance", 1.0)
    arity_lookback = max(2, config.get("mes3_arity_lookback", 8))
    max_overlap = config.get("mes3_max_overlap", 1.0)
    max_reversals = config.get("mes3_max_reversals", 4)
    cooldown_bars = max(0, config.get("mes3_cooldown_bars", 3))
    start_index = max(slope_period, short_slope_period, arity_lookback - 1)
    last_signal_index = -999999

    for i in range(start_index, len(data)):
        if i - last_signal_index <= cooldown_bars:
            continue

        current = data[i]
        ema = current.get("ema")
        previous_ema = data[i - slope_period].get("ema")
        short_previous_ema = data[i - short_slope_period].get("ema")
        if None in (ema, previous_ema, short_previous_ema):
            continue

        average_overlap, reversals = calculate_arity_metrics(data, i, arity_lookback)
        if average_overlap > max_overlap or reversals > max_reversals:
            continue

        o, h, l, c = current["open"], current["high"], current["low"], current["close"]
        is_up = c > o
        is_down = c < o
        lower_tail = min(o, c) - l
        upper_tail = h - max(o, c)
        ema_slope = ema - previous_ema
        short_ema_slope = ema - short_previous_ema
        close_to_ema = c - ema

        action = None
        if (
            is_up and
            ema_slope >= slope_threshold and
            short_ema_slope >= short_slope_threshold and
            lower_tail >= min_tail and
            close_to_ema >= min_close_distance
        ):
            action = "Buy"
        elif (
            is_down and
            ema_slope <= -slope_threshold and
            short_ema_slope <= -short_slope_threshold and
            upper_tail >= min_tail and
            -close_to_ema >= min_close_distance
        ):
            action = "Sell"

        if not action:
            continue

        signal_details.append({
            "barIndex": i,
            "timestamp": current["time"],
            "action": action,
            "metrics": {
                "setupType": "mes3TrendTail",
                "ema": ema,
                "emaSlope": ema_slope,
                "shortEmaSlope": short_ema_slope,
                "upperTail": upper_tail,
                "lowerTail": lower_tail,
                "closeToEma": close_to_ema,
                "averageOverlapBricks": average_overlap,
                "reversals": reversals,
            },
        })
        last_signal_index = i

    return signal_details, evaluate_signal_details(data, signal_details, config)

def run_mes3_previous_tail_rejection_strategy(data, config):
    signal_details = []
    tick_size = infer_price_increment(data)
    slope_period = max(1, config.get("mes3_prev_tail_slope_period", 8))
    slope_threshold = config.get("mes3_prev_tail_slope_threshold", 2.5)
    short_slope_period = max(1, config.get("mes3_prev_tail_short_slope_period", 3))
    short_slope_threshold = config.get("mes3_prev_tail_short_slope_threshold", 0.9)
    min_tail = config.get("mes3_prev_tail_min_tail", 0.75)
    extension_ticks = config.get("mes3_prev_tail_extension_ticks", 1)
    min_extension = tick_size * extension_ticks
    min_close_distance = config.get("mes3_prev_tail_min_close_ema_distance", 1.0)
    arity_lookback = max(2, config.get("mes3_prev_tail_arity_lookback", 8))
    max_overlap = config.get("mes3_prev_tail_max_overlap", 1.0)
    max_reversals = config.get("mes3_prev_tail_max_reversals", 4)
    cooldown_bars = max(0, config.get("mes3_prev_tail_cooldown_bars", 3))
    start_index = max(slope_period, short_slope_period, arity_lookback - 1, 1)
    last_signal_index = -999999

    for i in range(start_index, len(data)):
        if i - last_signal_index <= cooldown_bars:
            continue

        current = data[i]
        previous = data[i - 1]
        ema = current.get("ema")
        previous_ema = data[i - slope_period].get("ema")
        short_previous_ema = data[i - short_slope_period].get("ema")
        if None in (ema, previous_ema, short_previous_ema):
            continue

        average_overlap, reversals = calculate_arity_metrics(data, i, arity_lookback)
        if average_overlap > max_overlap or reversals > max_reversals:
            continue

        o, h, l, c = current["open"], current["high"], current["low"], current["close"]
        is_up = c > o
        is_down = c < o
        lower_tail = min(o, c) - l
        upper_tail = h - max(o, c)
        lower_extension = previous["low"] - l
        upper_extension = h - previous["high"]
        ema_slope = ema - previous_ema
        short_ema_slope = ema - short_previous_ema
        close_to_ema = c - ema

        action = None
        if (
            is_up and
            ema_slope >= slope_threshold and
            short_ema_slope >= short_slope_threshold and
            lower_tail >= min_tail and
            lower_extension >= min_extension and
            close_to_ema >= min_close_distance
        ):
            action = "Buy"
        elif (
            is_down and
            ema_slope <= -slope_threshold and
            short_ema_slope <= -short_slope_threshold and
            upper_tail >= min_tail and
            upper_extension >= min_extension and
            -close_to_ema >= min_close_distance
        ):
            action = "Sell"

        if not action:
            continue

        signal_details.append({
            "barIndex": i,
            "timestamp": current["time"],
            "action": action,
            "metrics": {
                "setupType": "mes3PreviousTailRejection",
                "ema": ema,
                "emaSlope": ema_slope,
                "shortEmaSlope": short_ema_slope,
                "upperTail": upper_tail,
                "lowerTail": lower_tail,
                "upperExtension": upper_extension,
                "lowerExtension": lower_extension,
                "closeToEma": close_to_ema,
                "averageOverlapBricks": average_overlap,
                "reversals": reversals,
                "tickSize": tick_size,
                "minExtension": min_extension,
            },
        })
        last_signal_index = i

    return signal_details, evaluate_signal_details(data, signal_details, config)

def run_mes_reg5_long_tail_strategy(data, config):
    signal_details = []
    slope_period = max(1, config.get("mes_reg5_long_tail_slope_period", 8))
    slope_threshold = config.get("mes_reg5_long_tail_slope_threshold", 0.20)
    min_tail = config.get("mes_reg5_long_tail_min_tail", 0.75)
    min_close_distance = config.get("mes_reg5_long_tail_min_close_distance", 1.0)
    cooldown_bars = max(0, config.get("mes_reg5_long_tail_cooldown_bars", 3))
    last_signal_index = -999999

    for i in range(slope_period, len(data)):
        if i - last_signal_index <= cooldown_bars:
            continue

        current = data[i]
        ema = current.get("ema")
        prev_ema = data[i - slope_period].get("ema")
        if None in (ema, prev_ema):
            continue

        o, h, l, c = current["open"], current["high"], current["low"], current["close"]
        is_up = c > o
        is_down = c < o
        lower_tail = min(o, c) - l
        upper_tail = h - max(o, c)
        ema_slope = (ema - prev_ema) / slope_period
        close_to_ema = c - ema

        action = None
        if (
            is_up and
            lower_tail >= min_tail and
            upper_tail == 0.0 and
            ema_slope >= slope_threshold and
            close_to_ema >= min_close_distance
        ):
            action = "Buy"
        elif (
            is_down and
            upper_tail >= min_tail and
            lower_tail == 0.0 and
            ema_slope <= -slope_threshold and
            -close_to_ema >= min_close_distance
        ):
            action = "Sell"

        if not action:
            continue

        signal_details.append({
            "barIndex": i,
            "timestamp": current["time"],
            "action": action,
            "metrics": {
                "setupType": "mesReg5LongTail",
                "ema": ema,
                "emaSlope": ema_slope,
                "upperTail": upper_tail,
                "lowerTail": lower_tail,
                "closeToEma": close_to_ema,
            },
        })
        last_signal_index = i

    return signal_details, evaluate_signal_details(data, signal_details, config)

def run_mes_reg5_ema_bounce_arity_strategy(data, config):
    signal_details = []

    # Calculate scale relative to baseline MESM_reg_5 range size (1.25 points)
    range_size = infer_range_size(data)
    scale = range_size / 1.25

    slope_period = max(1, config.get("mes_reg5_ema_bounce_arity_slope_period", 8))
    short_slope_period = max(1, config.get("mes_reg5_ema_bounce_arity_short_slope_period", 4))
    slope_threshold = config.get("mes_reg5_ema_bounce_arity_slope_threshold", 0.20) * scale
    short_slope_threshold = config.get("mes_reg5_ema_bounce_arity_short_slope_threshold", 0.28) * scale
    relaxed_short_slope_threshold = config.get("mes_reg5_ema_bounce_arity_relaxed_short_slope_threshold", 0.18) * scale
    strong_short_slope_threshold = config.get("mes_reg5_ema_bounce_arity_strong_short_slope_threshold", 0.30) * scale
    strong_slope_threshold = config.get("mes_reg5_ema_bounce_arity_strong_slope_threshold", 0.22) * scale
    extended_short_slope_threshold = config.get("mes_reg5_ema_bounce_arity_extended_short_slope_threshold", 0.36) * scale
    lookback = max(2, config.get("mes_reg5_ema_bounce_arity_lookback", 8))
    base_max_reversals = config.get("mes_reg5_ema_bounce_arity_base_max_reversals", 4)
    strong_max_reversals = config.get("mes_reg5_ema_bounce_arity_strong_max_reversals", base_max_reversals + 1)
    base_max_overlap = config.get("mes_reg5_ema_bounce_arity_base_max_overlap", 0.72)
    strong_max_overlap = config.get("mes_reg5_ema_bounce_arity_strong_max_overlap", 0.88)
    buy_low_to_ema_max = config.get("mes_reg5_ema_bounce_arity_buy_low_to_ema_max", 0.65) * scale
    sell_high_to_ema_min = config.get("mes_reg5_ema_bounce_arity_sell_high_to_ema_min", -1.10) * scale
    extended_buy_low_to_ema_max = config.get("mes_reg5_ema_bounce_arity_extended_buy_low_to_ema_max", buy_low_to_ema_max)
    extended_sell_high_to_ema_min = config.get("mes_reg5_ema_bounce_arity_extended_sell_high_to_ema_min", sell_high_to_ema_min)
    extended_min_tail = config.get("mes_reg5_ema_bounce_arity_extended_min_tail", 0.75) * scale
    pin_short_slope_threshold = config.get("mes_reg5_ema_bounce_arity_pin_short_slope_threshold", 0.70) * scale
    pin_slope_threshold = config.get("mes_reg5_ema_bounce_arity_pin_slope_threshold", 0.55) * scale
    pin_min_tail = config.get("mes_reg5_ema_bounce_arity_pin_min_tail", 1.00) * scale
    pin_min_ema_distance = config.get("mes_reg5_ema_bounce_arity_pin_min_ema_distance", 1.00) * scale
    pin_max_ema_distance = config.get("mes_reg5_ema_bounce_arity_pin_max_ema_distance", 1.60) * scale
    pin_max_overlap = config.get("mes_reg5_ema_bounce_arity_pin_max_overlap", 0.50)
    pin_max_reversals = config.get("mes_reg5_ema_bounce_arity_pin_max_reversals", 2)
    max_chase_distance = config.get("mes_reg5_ema_bounce_arity_max_chase_distance", 1.25) * scale
    min_close_dist_buy = config.get("mes_reg5_ema_bounce_arity_min_close_dist_buy", 0.50) * scale
    min_close_dist_sell = config.get("mes_reg5_ema_bounce_arity_min_close_dist_sell", 1.00) * scale
    cooldown_bars = max(0, config.get("mes_reg5_ema_bounce_arity_cooldown_bars", 3))
    last_signal_index = -999999

    start_index = max(slope_period, short_slope_period, lookback - 1)

    def body_range(bar):
        return min(bar["open"], bar["close"]), max(bar["open"], bar["close"])

    def overlap_length(first, second):
        return max(0.0, min(first[1], second[1]) - max(first[0], second[0]))

    def calculate_left_body_wall(index, wall_lookback=6, min_body=0.75 * scale, zone_pad=0.25 * scale):
        current_bar = data[index]
        current_body = body_range(current_bar)
        current_ema = current_bar.get("ema")
        zone_low = min(current_body[0], current_ema if current_ema is not None else current_body[0]) - zone_pad
        zone_high = max(current_body[1], current_ema if current_ema is not None else current_body[1]) + zone_pad
        zone = (zone_low, zone_high)
        count = 0
        body_sum = 0.0
        shelf_lows = []
        shelf_highs = []

        for left_index in range(max(0, index - wall_lookback), index):
            left_bar = data[left_index]
            left_body = body_range(left_bar)
            body_size = left_body[1] - left_body[0]
            if body_size < min_body:
                continue
            overlap = overlap_length(zone, left_body)
            overlap_ratio = overlap / body_size if body_size else 0.0
            if overlap_ratio < 0.45:
                continue
            count += 1
            body_sum += body_size
            shelf_lows.append(left_body[0])
            shelf_highs.append(left_body[1])

        shelf_span = max(shelf_highs) - min(shelf_lows) if shelf_highs else 0.0
        return {
            "count": count,
            "bodySum": body_sum,
            "shelfSpan": shelf_span,
        }

    for i in range(start_index, len(data)):
        if i - last_signal_index <= cooldown_bars:
            continue

        current = data[i]
        ema = current.get("ema")
        prev_ema = data[i - slope_period].get("ema")
        prev_short_ema = data[i - short_slope_period].get("ema")
        if None in (ema, prev_ema, prev_short_ema):
            continue

        o, h, l, c = current["open"], current["high"], current["low"], current["close"]
        is_up = c > o
        is_down = c < o
        ema_slope = (ema - prev_ema) / slope_period
        short_ema_slope = (ema - prev_short_ema) / short_slope_period
        upper_tail = h - max(o, c)
        lower_tail = min(o, c) - l
        low_to_ema = l - ema
        high_to_ema = h - ema
        close_to_ema = c - ema

        # Arity metrics
        avg_overlap, reversals = calculate_arity_metrics(data, i, lookback)

        is_strong_trend = (
            abs(short_ema_slope) >= strong_short_slope_threshold and
            abs(ema_slope) >= strong_slope_threshold
        )

        high_overlap_rejection_tail = (
            lower_tail >= extended_min_tail
            if short_ema_slope > 0
            else upper_tail >= extended_min_tail
        )
        if reversals >= 5 and avg_overlap > 0.60:
            continue
        if reversals == 4 and avg_overlap > 0.70 and not (
            is_strong_trend and high_overlap_rejection_tail and avg_overlap <= 0.90
        ):
            continue
        if reversals <= 3 and avg_overlap > 0.98:
            continue

        action = None
        setup_type = "mesReg5EmaBounceArity"
        buy_slope_ok = (
            short_ema_slope >= short_slope_threshold or
            (short_ema_slope >= relaxed_short_slope_threshold and ema_slope >= slope_threshold)
        )
        sell_slope_ok = (
            short_ema_slope <= -short_slope_threshold or
            (short_ema_slope <= -relaxed_short_slope_threshold and ema_slope <= -slope_threshold)
        )
        buy_near_ema = low_to_ema <= buy_low_to_ema_max
        sell_near_ema = high_to_ema >= sell_high_to_ema_min
        buy_extended_tail = (
            lower_tail >= extended_min_tail and
            low_to_ema <= extended_buy_low_to_ema_max and
            short_ema_slope >= extended_short_slope_threshold
        )
        sell_extended_tail = (
            upper_tail >= extended_min_tail and
            high_to_ema >= extended_sell_high_to_ema_min and
            short_ema_slope <= -extended_short_slope_threshold
        )

        if (
            is_up and
            buy_slope_ok and
            close_to_ema >= min_close_dist_buy and
            (buy_near_ema or buy_extended_tail)
        ):
            action = "Buy"
        elif (
            is_down and
            sell_slope_ok and
            -close_to_ema >= min_close_dist_sell and
            (sell_near_ema or sell_extended_tail)
        ):
            action = "Sell"
        elif (
            is_up and
            short_ema_slope >= pin_short_slope_threshold and
            ema_slope >= pin_slope_threshold and
            lower_tail >= pin_min_tail and
            pin_min_ema_distance <= low_to_ema <= pin_max_ema_distance and
            avg_overlap <= pin_max_overlap and
            reversals <= pin_max_reversals
        ):
            action = "Buy"
            setup_type = "mesReg5StrongTrendPinBar"
        elif (
            is_down and
            short_ema_slope <= -pin_short_slope_threshold and
            ema_slope <= -pin_slope_threshold and
            upper_tail >= pin_min_tail and
            -pin_max_ema_distance <= high_to_ema <= -pin_min_ema_distance and
            avg_overlap <= pin_max_overlap and
            reversals <= pin_max_reversals
        ):
            action = "Sell"
            setup_type = "mesReg5StrongTrendPinBar"

        if not action:
            continue
        if action == "Buy":
            touched_ema = low_to_ema <= buy_low_to_ema_max
        else:
            touched_ema = high_to_ema >= 0
        if not touched_ema and abs(close_to_ema) > max_chase_distance:
            continue

        rejection_tail = lower_tail if action == "Buy" else upper_tail
        is_protected_strong_tail = (
            is_strong_trend and
            abs(short_ema_slope) >= 0.42 * scale and
            rejection_tail >= 0.75 * scale
        )
        left_body_wall = calculate_left_body_wall(i)
        has_left_body_wall = (
            left_body_wall["count"] >= 5 and
            left_body_wall["bodySum"] >= 4.0 * scale and
            left_body_wall["shelfSpan"] <= 2.25 * scale and
            not is_protected_strong_tail
        )
        if has_left_body_wall:
            continue

        signal_details.append({
            "barIndex": i,
            "timestamp": current["time"],
            "action": action,
            "metrics": {
                "setupType": setup_type,
                "ema": ema,
                "emaSlope": ema_slope,
                "shortEmaSlope": short_ema_slope,
                "averageOverlap": avg_overlap,
                "reversals": reversals,
                "isStrongTrend": is_strong_trend,
                "lowToEma": low_to_ema,
                "highToEma": high_to_ema,
                "closeToEma": close_to_ema,
                "upperTail": upper_tail,
                "lowerTail": lower_tail,
                "usedExtendedTail": buy_extended_tail if action == "Buy" else sell_extended_tail,
                "usedPinBar": setup_type == "mesReg5StrongTrendPinBar",
                "leftBodyWall": left_body_wall,
                "rejectionTail": rejection_tail,
                "protectedStrongTail": is_protected_strong_tail,
            },
        })
        last_signal_index = i

    return signal_details, evaluate_signal_details(data, signal_details, config)


def run_mes_reg5_pin_bar_breakout_strategy(data, config):
    signal_details = []
    range_size = infer_range_size(data)
    scale = range_size / 1.25

    slope_period = max(1, config.get("mes_reg5_pin_bar_breakout_slope_period", 8))
    short_slope_period = max(1, config.get("mes_reg5_pin_bar_breakout_short_slope_period", 4))
    slope_threshold = config.get("mes_reg5_pin_bar_breakout_slope_threshold", 0.20) * scale
    short_slope_threshold = config.get("mes_reg5_pin_bar_breakout_short_slope_threshold", 0.20) * scale
    min_tail = config.get("mes_reg5_pin_bar_breakout_min_tail", 0.75) * scale
    max_body = config.get("mes_reg5_pin_bar_breakout_max_body", 0.50) * scale
    min_tail_ratio = config.get("mes_reg5_pin_bar_breakout_min_tail_ratio", 0.60)
    max_opposite_tail = config.get("mes_reg5_pin_bar_breakout_max_opposite_tail", 0.25) * scale
    arity_lookback = max(2, config.get("mes_reg5_pin_bar_breakout_lookback", 8))
    max_overlap = config.get("mes_reg5_pin_bar_breakout_max_overlap", 0.70)
    max_reversals = config.get("mes_reg5_pin_bar_breakout_max_reversals", 5)
    left_lookback = max(1, config.get("mes_reg5_pin_bar_breakout_left_lookback", 12))
    max_left_blockers = config.get("mes_reg5_pin_bar_breakout_max_left_blockers", 3)
    cooldown_bars = max(0, config.get("mes_reg5_pin_bar_breakout_cooldown_bars", 2))
    tick_size = infer_price_increment(data)
    last_signal_index = -999999
    start_index = max(slope_period, short_slope_period, arity_lookback)

    def left_blockers(index, action):
        previous = data[max(0, index - left_lookback):index]
        current = data[index]
        if action == "Buy":
            breakout_price = max(current["open"], current["close"], current["high"])
            return sum(1 for bar in previous if bar["high"] >= breakout_price - tick_size)
        breakout_price = min(current["open"], current["close"], current["low"])
        return sum(1 for bar in previous if bar["low"] <= breakout_price + tick_size)

    for i in range(start_index, len(data)):
        if i - last_signal_index <= cooldown_bars:
            continue

        current = data[i]
        previous = data[i - 1]
        ema = current.get("ema")
        prev_ema = data[i - slope_period].get("ema")
        prev_short_ema = data[i - short_slope_period].get("ema")
        if None in (ema, prev_ema, prev_short_ema):
            continue

        o, h, l, c = current["open"], current["high"], current["low"], current["close"]
        body = abs(c - o)
        full_range = h - l
        if full_range <= 0 or body > max_body:
            continue

        upper_tail = h - max(o, c)
        lower_tail = min(o, c) - l
        ema_slope = (ema - prev_ema) / slope_period
        short_ema_slope = (ema - prev_short_ema) / short_slope_period
        avg_overlap, reversals = calculate_arity_metrics(data, i, arity_lookback)

        action = None
        rejection_tail = 0.0
        opposite_tail = 0.0
        breakout_distance = 0.0
        close_breakout_distance = 0.0

        if c > o:
            rejection_tail = lower_tail
            opposite_tail = upper_tail
            breakout_distance = h - previous["high"]
            close_breakout_distance = c - previous["high"]
            if (
                close_breakout_distance > 0 and
                rejection_tail >= min_tail and
                rejection_tail / full_range >= min_tail_ratio and
                opposite_tail <= max_opposite_tail and
                ema_slope >= slope_threshold and
                short_ema_slope >= short_slope_threshold
            ):
                action = "Buy"
        elif c < o:
            rejection_tail = upper_tail
            opposite_tail = lower_tail
            breakout_distance = previous["low"] - l
            close_breakout_distance = previous["low"] - c
            if (
                close_breakout_distance > 0 and
                rejection_tail >= min_tail and
                rejection_tail / full_range >= min_tail_ratio and
                opposite_tail <= max_opposite_tail and
                ema_slope <= -slope_threshold and
                short_ema_slope <= -short_slope_threshold
            ):
                action = "Sell"

        if not action:
            continue

        blockers = left_blockers(i, action)
        if avg_overlap > max_overlap or reversals > max_reversals or blockers > max_left_blockers:
            continue

        signal_details.append({
            "barIndex": i,
            "timestamp": current["time"],
            "action": action,
            "metrics": {
                "setupType": "mesReg5PinBarBreakout",
                "ema": ema,
                "emaSlope": ema_slope,
                "shortEmaSlope": short_ema_slope,
                "body": body,
                "range": full_range,
                "rejectionTail": rejection_tail,
                "oppositeTail": opposite_tail,
                "tailRatio": rejection_tail / full_range,
                "breakoutDistance": breakout_distance,
                "closeBreakoutDistance": close_breakout_distance,
                "averageOverlap": avg_overlap,
                "reversals": reversals,
                "leftBlockers": blockers,
                "stopPrice": o - tick_size if action == "Buy" else o + tick_size,
                "exitPlan": "Hold until opposite-color bar; stop one tick past pin bar open",
            },
        })
        last_signal_index = i

    return signal_details, evaluate_signal_details(data, signal_details, config)


def parse_timestamp_seconds(value):
    if not value:
        return None
    try:
        from datetime import datetime
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except Exception:
        return None

def bar_color(bar):
    if bar["close"] > bar["open"]:
        return "up"
    if bar["close"] < bar["open"]:
        return "down"
    return "flat"

def is_ha_indecision(bar, body_ratio_threshold):
    bar_range = max(0.0000001, bar["high"] - bar["low"])
    body = abs(bar["close"] - bar["open"])
    return body / bar_range <= body_ratio_threshold

def is_ha_continuation_breakout(direction, bar, cluster_low, cluster_high, min_body_ratio):
    bar_range = max(0.0000001, bar["high"] - bar["low"])
    body_ratio = abs(bar["close"] - bar["open"]) / bar_range
    ma1 = bar.get("ma1")

    if direction == "Buy":
        return (
            bar_color(bar) == "up" and
            body_ratio >= min_body_ratio and
            bar["close"] > cluster_high and
            (ma1 is None or bar["close"] > ma1)
        )

    return (
        bar_color(bar) == "down" and
        body_ratio >= min_body_ratio and
        bar["close"] < cluster_low and
        (ma1 is None or bar["close"] < ma1)
    )

def find_latest_ha_indecision_cluster(ha_window, direction, min_length, body_ratio_threshold, require_pullback_side=True):
    best = None
    index = 0
    while index < len(ha_window):
        if not is_ha_indecision(ha_window[index], body_ratio_threshold):
            index += 1
            continue

        end = index
        while end < len(ha_window) and is_ha_indecision(ha_window[end], body_ratio_threshold):
            end += 1

        if end - index >= min_length:
            cluster = ha_window[max(index, end - 6):end]
            cluster_low = min(bar["low"] for bar in cluster)
            cluster_high = max(bar["high"] for bar in cluster)
            if require_pullback_side:
                window_low = min(bar["low"] for bar in ha_window)
                window_high = max(bar["high"] for bar in ha_window)
                midpoint = (window_low + window_high) / 2
                cluster_midpoint = (cluster_low + cluster_high) / 2
                if direction == "Buy" and cluster_midpoint > midpoint:
                    index = end + 1
                    continue
                if direction == "Sell" and cluster_midpoint < midpoint:
                    index = end + 1
                    continue
            best = {
                "startOffset": max(index, end - 6),
                "endOffset": end - 1,
                "barCount": len(cluster),
                "low": cluster_low,
                "high": cluster_high,
                "startTime": cluster[0]["time"],
                "endTime": cluster[-1]["time"],
            }

        index = end + 1

    return best

def cluster_crosses_ha_10_ema(direction, cluster_bars, min_diff=0.0):
    if not cluster_bars:
        return False
    if direction == "Buy":
        return any(bar.get("ma1") is not None and (bar["ma1"] - bar["close"]) >= min_diff for bar in cluster_bars)
    return any(bar.get("ma1") is not None and (bar["close"] - bar["ma1"]) >= min_diff for bar in cluster_bars)

def find_latest_ha_10_ema_indecision_cluster(ha_window, direction, min_length, body_ratio_threshold, min_diff=0.0):
    best = None
    index = 0
    while index < len(ha_window):
        if not is_ha_indecision(ha_window[index], body_ratio_threshold):
            index += 1
            continue

        end = index
        while end < len(ha_window) and is_ha_indecision(ha_window[end], body_ratio_threshold):
            end += 1

        if end - index >= min_length:
            cluster = ha_window[max(index, end - 6):end]
            if cluster_crosses_ha_10_ema(direction, cluster, min_diff=min_diff):
                best = {
                    "startOffset": max(index, end - 6),
                    "endOffset": end - 1,
                    "barCount": len(cluster),
                    "low": min(bar["low"] for bar in cluster),
                    "high": max(bar["high"] for bar in cluster),
                    "startTime": cluster[0]["time"],
                    "endTime": cluster[-1]["time"],
                    "minMa1Distance": min(
                        (bar["close"] - bar["ma1"])
                        for bar in cluster
                        if bar.get("ma1") is not None
                    ),
                    "maxMa1Distance": max(
                        (bar["close"] - bar["ma1"])
                        for bar in cluster
                        if bar.get("ma1") is not None
                    ),
                }

        index = end + 1

    return best

def is_ha_10_ema_reclaim_breakout(direction, bar, cluster_low, cluster_high, min_body_ratio):
    ma1 = bar.get("ma1")
    if ma1 is None:
        return False

    bar_range = max(0.0000001, bar["high"] - bar["low"])
    body_ratio = abs(bar["close"] - bar["open"]) / bar_range
    if body_ratio < min_body_ratio:
        return False

    if direction == "Buy":
        return (
            bar_color(bar) == "up" and
            bar["close"] > ma1 and
            bar["close"] > cluster_high
        )

    return (
        bar_color(bar) == "down" and
        bar["close"] < ma1 and
        bar["close"] < cluster_low
    )

def run_mes3_ha_ema_approach_strategy(data, ha_data, config):
    if not ha_data:
        return []

    ha_times = [parse_timestamp_seconds(bar.get("time")) for bar in ha_data]
    signal_details = []
    tick_size = infer_price_increment(data)
    ema_slope_period = max(1, config.get("mes3_ha_ema_approach_slope_period", 8))
    ema_slope_threshold = config.get("mes3_ha_ema_approach_slope_threshold", 1.25)
    approach_ticks = config.get("mes3_ha_ema_approach_ticks", 4)
    approach_distance = tick_size * approach_ticks
    min_tail = config.get("mes3_ha_ema_approach_min_tail", tick_size)
    ha_cluster_min_bars = max(2, config.get("mes3_ha_indecision_min_bars", 2))
    ha_indecision_body_ratio = config.get("mes3_ha_indecision_body_ratio", 0.45)
    ha_breakout_body_ratio = config.get("mes3_ha_breakout_body_ratio", 0.45)
    ha_pre_seconds = config.get("mes3_ha_ema_approach_pre_seconds", 20)
    ha_post_seconds = config.get("mes3_ha_ema_approach_post_seconds", 12)
    cooldown_bars = max(0, config.get("mes3_ha_ema_approach_cooldown_bars", 1))
    ha_pullback_ticks = config.get("mes3_ha_ema_approach_pullback_ticks", 0)
    min_ha_diff = tick_size * ha_pullback_ticks
    last_signal_index = -999999

    for i in range(max(ema_slope_period, 1), len(data)):
        if i - last_signal_index <= cooldown_bars:
            continue

        current = data[i]
        previous = data[i - 1]
        ema = current.get("ema")
        previous_ema = data[i - ema_slope_period].get("ema")
        if ema is None or previous_ema is None:
            continue

        ema_slope = ema - previous_ema
        upper_tail = current["high"] - max(current["open"], current["close"])
        lower_tail = min(current["open"], current["close"]) - current["low"]
        action = None
        tail_distance_to_ema = None

        if (
            ema_slope >= ema_slope_threshold and
            current["close"] > ema and
            lower_tail >= min_tail and
            abs(current["low"] - ema) <= approach_distance
        ):
            action = "Buy"
            tail_distance_to_ema = current["low"] - ema
        elif (
            ema_slope <= -ema_slope_threshold and
            current["close"] < ema and
            upper_tail >= min_tail and
            abs(current["high"] - ema) <= approach_distance
        ):
            action = "Sell"
            tail_distance_to_ema = current["high"] - ema

        if not action:
            continue

        start_seconds = parse_timestamp_seconds(previous.get("time"))
        end_seconds = parse_timestamp_seconds(current.get("time"))
        if start_seconds is None or end_seconds is None:
            continue
        search_start_seconds = max(start_seconds - ha_pre_seconds, end_seconds - ha_pre_seconds)
        search_end_seconds = end_seconds + ha_post_seconds

        import bisect
        ha_start = bisect.bisect_left(ha_times, search_start_seconds)
        ha_end = bisect.bisect_right(ha_times, search_end_seconds)
        ha_window = ha_data[ha_start:ha_end]
        if len(ha_window) < ha_cluster_min_bars + 1:
            continue

        cluster = find_latest_ha_10_ema_indecision_cluster(
            ha_window,
            action,
            ha_cluster_min_bars,
            ha_indecision_body_ratio,
            min_diff=min_ha_diff
        )
        if not cluster:
            continue

        breakout = None
        breakout_start = ha_start + cluster["endOffset"] + 1
        for ha_index in range(breakout_start, ha_end):
            candidate = ha_data[ha_index]
            if is_ha_10_ema_reclaim_breakout(
                action,
                candidate,
                cluster["low"],
                cluster["high"],
                ha_breakout_body_ratio,
            ):
                breakout = candidate
                break

        if not breakout:
            continue

        signal_details.append({
            "barIndex": i,
            "timestamp": current["time"],
            "action": action,
            "metrics": {
                "setupType": "mes3HaEmaApproachIndecisionBreakout",
                "ema": ema,
                "emaSlope": ema_slope,
                "tailDistanceToEma": tail_distance_to_ema,
                "approachDistance": approach_distance,
                "upperTail": upper_tail,
                "lowerTail": lower_tail,
                "haClusterStartTime": cluster["startTime"],
                "haClusterEndTime": cluster["endTime"],
                "haClusterBars": cluster["barCount"],
                "haClusterLow": cluster["low"],
                "haClusterHigh": cluster["high"],
                "haClusterMinMa1Distance": cluster.get("minMa1Distance"),
                "haClusterMaxMa1Distance": cluster.get("maxMa1Distance"),
                "haBreakoutTime": breakout["time"],
                "haBreakoutOpen": breakout["open"],
                "haBreakoutHigh": breakout["high"],
                "haBreakoutLow": breakout["low"],
                "haBreakoutClose": breakout["close"],
                "haBreakoutMa1": breakout.get("ma1"),
            },
        })
        last_signal_index = i

    return signal_details

def build_yellow_momentum_feature_cache(data, slope_periods, arity_lookbacks, arity_cache):
    feature_cache = {}
    for slope_period in slope_periods:
        for arity_lookback in arity_lookbacks:
            features = []
            start_index = max(slope_period, arity_lookback - 1)
            for i in range(start_index, len(data)):
                current = data[i]
                previous = data[i - slope_period]
                fast_ema = get_fast_ema(current)
                slow_ema = get_slow_ema(current)
                previous_fast = get_fast_ema(previous)
                previous_slow = get_slow_ema(previous)
                if None in (fast_ema, slow_ema, previous_fast, previous_slow):
                    continue

                o, h, l, c = current["open"], current["high"], current["low"], current["close"]
                fast_slope = fast_ema - previous_fast
                slow_slope = slow_ema - previous_slow
                ema_gap = fast_ema - slow_ema
                lower_tail = min(o, c) - l
                upper_tail = h - max(o, c)
                average_overlap, reversals = arity_cache[arity_lookback][i]

                if ema_gap > 0 and c > o and l <= fast_ema and c > fast_ema:
                    features.append({
                        "barIndex": i,
                        "timestamp": current["time"],
                        "action": "Buy",
                        "trendFastSlope": fast_slope,
                        "trendSlowSlope": slow_slope,
                        "trendEmaGap": ema_gap,
                        "yellowPenetration": fast_ema - l,
                        "rejectionTail": lower_tail,
                        "metrics": {
                            "setupType": "yellowMomentum",
                            "ema5": fast_ema,
                            "ema10": slow_ema,
                            "emaGap": ema_gap,
                            "fastSlope": fast_slope,
                            "slowSlope": slow_slope,
                            "yellowPenetration": fast_ema - l,
                            "upperTail": upper_tail,
                            "lowerTail": lower_tail,
                            "averageOverlapBricks": average_overlap,
                            "reversals": reversals,
                        },
                    })
                elif ema_gap < 0 and (c < o or c == o) and h >= fast_ema and c < fast_ema:
                    features.append({
                        "barIndex": i,
                        "timestamp": current["time"],
                        "action": "Sell",
                        "trendFastSlope": -fast_slope,
                        "trendSlowSlope": -slow_slope,
                        "trendEmaGap": -ema_gap,
                        "yellowPenetration": h - fast_ema,
                        "rejectionTail": upper_tail,
                        "metrics": {
                            "setupType": "yellowMomentum",
                            "ema5": fast_ema,
                            "ema10": slow_ema,
                            "emaGap": ema_gap,
                            "fastSlope": fast_slope,
                            "slowSlope": slow_slope,
                            "yellowPenetration": h - fast_ema,
                            "upperTail": upper_tail,
                            "lowerTail": lower_tail,
                            "averageOverlapBricks": average_overlap,
                            "reversals": reversals,
                        },
                    })
            feature_cache[(slope_period, arity_lookback)] = features
    return feature_cache

def filter_yellow_momentum_features(features, config):
    return [
        {
            "barIndex": feature["barIndex"],
            "timestamp": feature["timestamp"],
            "action": feature["action"],
            "metrics": feature["metrics"],
        }
        for feature in features
        if (
            feature["trendFastSlope"] >= config["yellow_momentum_fast_slope_threshold"] and
            feature["trendSlowSlope"] >= config["yellow_momentum_slow_slope_threshold"] and
            feature["trendEmaGap"] >= config["yellow_momentum_min_ema_gap"] and
            feature["yellowPenetration"] >= config["yellow_momentum_min_penetration"] and
            feature["rejectionTail"] >= config["yellow_momentum_min_tail"] and
            feature["metrics"]["averageOverlapBricks"] <= config["yellow_momentum_max_overlap"] and
            feature["metrics"]["reversals"] <= config["yellow_momentum_max_reversals"]
        )
    ]

def run_arid_strategy(data, config):
    signal_details = []
    lookback = max(3, config["arid_lookback"])
    slope_period = max(1, config["arid_ema_slope_period"])
    start_index = max(lookback - 1, slope_period)

    for i in range(start_index, len(data)):
        current = data[i]
        time_string = current["time"].split("T")[1].replace("Z", "")
        if not config["start_time"] <= time_string <= config["end_time"]:
            continue
        recent = data[i - lookback + 1:i + 1]
        brick_size = abs(current["close"] - current["open"])
        if brick_size == 0 or current.get("ema") is None:
            continue

        slope_ema = data[i - slope_period].get("ema")
        if slope_ema is None:
            continue
        ema_slope = current["ema"] - slope_ema

        directions = [
            1 if bar["close"] > bar["open"] else -1 if bar["close"] < bar["open"] else 0
            for bar in recent
        ]
        reversals = sum(
            previous != 0 and current_direction != 0 and previous != current_direction
            for previous, current_direction in zip(directions, directions[1:])
        )

        overlap_values = []
        for previous, bar in zip(recent, recent[1:]):
            overlap = max(0.0, min(previous["high"], bar["high"]) - max(previous["low"], bar["low"]))
            overlap_values.append(overlap / brick_size)
        average_overlap = sum(overlap_values) / len(overlap_values)
        ema_body_intersections = sum(
            min(bar["open"], bar["close"]) <= bar["ema"] <= max(bar["open"], bar["close"])
            for bar in recent
            if bar.get("ema") is not None
        )

        if (
            reversals > config["arid_max_reversals"] or
            average_overlap > config["arid_max_overlap_bricks"] or
            ema_body_intersections > 0
        ):
            continue

        o, h, l, c, ema = (
            current["open"],
            current["high"],
            current["low"],
            current["close"],
            current["ema"],
        )
        previous_bar = data[i - 1]
        required_wick = min(config["min_wick_length"], brick_size)
        minimum_gap = config["arid_min_ema_gap_bricks"] * brick_size
        metrics = {
            "emaSlope": ema_slope,
            "averageOverlapBricks": average_overlap,
            "reversals": reversals,
            "emaBodyIntersections": ema_body_intersections,
            "emaGapBricks": None,
        }

        if (
            c > o and
            ema_slope >= config["arid_ema_slope_threshold"] and
            o - l >= required_wick and
            l <= previous_bar["open"] and
            l - ema >= minimum_gap
        ):
            metrics["emaGapBricks"] = (l - ema) / brick_size
            signal_details.append({
                "barIndex": i,
                "timestamp": current["time"],
                "action": "Buy",
                "metrics": metrics,
            })
        elif (
            c < o and
            ema_slope <= -config["arid_ema_slope_threshold"] and
            h - o >= required_wick and
            h >= previous_bar["open"] and
            ema - h >= minimum_gap
        ):
            metrics["emaGapBricks"] = (ema - h) / brick_size
            signal_details.append({
                "barIndex": i,
                "timestamp": current["time"],
                "action": "Sell",
                "metrics": metrics,
            })

    return signal_details, evaluate_signal_details(data, signal_details, config)

def evaluate_set3_signals(data, signal_details, config):
    evaluations = []

    for signal in signal_details:
        entry_index = signal["barIndex"]
        entry_bar = data[entry_index]
        direction = signal["action"]
        entry_price = entry_bar["close"]
        brick_size = abs(entry_bar["close"] - entry_bar["open"])
        entry_date = entry_bar["time"].split("T")[0]
        end_time = config.get("end_time", "11:00:00")
        evaluation = {
            "entry_time": entry_bar["time"],
            "barIndex": entry_index,
            "direction": direction,
            "entry_price": entry_price,
            "brick_size": brick_size,
            "result": "Open",
        }

        for exit_index in range(entry_index + 1, len(data)):
            exit_bar = data[exit_index]
            exit_date, exit_time = exit_bar["time"].split("T")
            if exit_date != entry_date or exit_time.replace("Z", "") > end_time:
                evaluation["outcome_reason"] = "No opposing brick before session end"
                break

            is_opposing = (
                direction == "Buy" and exit_bar["close"] < exit_bar["open"]
            ) or (
                direction == "Sell" and exit_bar["close"] > exit_bar["open"]
            )
            if not is_opposing:
                continue

            raw_profit = (
                exit_bar["close"] - entry_price
                if direction == "Buy"
                else entry_price - exit_bar["close"]
            )
            profit_bricks = raw_profit / brick_size if brick_size else 0.0
            evaluation.update({
                "exit_time": exit_bar["time"],
                "exit_barIndex": exit_index,
                "exit_price": exit_bar["close"],
                "profit_bricks": profit_bricks,
                "result": "Win" if profit_bricks > 0 else "Loss" if profit_bricks < 0 else "BE",
                "outcome_reason": "First opposing brick closed",
            })
            break

        evaluations.append(evaluation)

    return evaluations

def run_arid_e_trade_sequence(data, signal_details, config):
    trades = []
    active_until_index = -1
    cumulative_by_date = {}

    def direction_of(bar):
        if bar["close"] > bar["open"]:
            return 1
        if bar["close"] < bar["open"]:
            return -1
        return 0

    def action_direction(action):
        return 1 if action == "Buy" else -1

    sorted_signals = sorted(signal_details, key=lambda signal: signal["markerBarIndex"])
    for signal in sorted_signals:
        marker_index = signal["markerBarIndex"]
        entry_index = marker_index if signal.get("setupType") == "synthetic" else marker_index + 1
        if entry_index <= active_until_index:
            continue

        if entry_index >= len(data):
            continue

        entry_bar = data[entry_index]
        entry_date, entry_time = entry_bar["time"].split("T")
        entry_time = entry_time.replace("Z", "")
        if not config["start_time"] <= entry_time <= config["end_time"]:
            continue

        direction = action_direction(signal["action"])
        if direction_of(entry_bar) != direction:
            continue

        brick_size = abs(entry_bar["close"] - entry_bar["open"])
        if brick_size == 0:
            continue

        pnl_before = cumulative_by_date.get(entry_date, 0.0)
        entry_price = entry_bar["close"]
        trade = {
            "barIndex": signal["barIndex"],
            "markerBarIndex": marker_index,
            "entry_barIndex": entry_index,
            "entry_time": entry_bar["time"],
            "direction": signal["action"],
            "setupType": signal.get("setupType"),
            "pnl_before": pnl_before,
            "profit_bricks": None,
            "pnl_after": pnl_before,
            "result": "Open",
        }

        for exit_index in range(entry_index + 1, len(data)):
            exit_bar = data[exit_index]
            exit_date, exit_time = exit_bar["time"].split("T")
            exit_time = exit_time.replace("Z", "")
            if exit_date != entry_date or exit_time > config["end_time"]:
                trade["outcome_reason"] = "No opposing brick before session end"
                break

            if direction_of(exit_bar) != -direction:
                continue

            raw_profit = (
                exit_bar["close"] - entry_price
                if direction > 0
                else entry_price - exit_bar["close"]
            )
            profit_bricks = raw_profit / brick_size
            pnl_after = pnl_before + profit_bricks
            cumulative_by_date[entry_date] = pnl_after
            trade.update({
                "exit_barIndex": exit_index,
                "exit_time": exit_bar["time"],
                "profit_bricks": profit_bricks,
                "pnl_after": pnl_after,
                "result": "Win" if profit_bricks > 0 else "Loss" if profit_bricks < 0 else "BE",
                "outcome_reason": "First opposing brick closed",
            })
            active_until_index = exit_index
            break
        else:
            active_until_index = entry_index

        if trade["profit_bricks"] is None:
            active_until_index = entry_index

        trades.append(trade)

    return trades

def run_no_tail_arity_strategy(data, config):
    signal_details = []
    if not data:
        return signal_details, [], []

    # Signal Set 3 is intentionally restricted to body-only Renko data.
    has_tails = any(
        bar["high"] > max(bar["open"], bar["close"]) or
        bar["low"] < min(bar["open"], bar["close"])
        for bar in data
    )
    if has_tails:
        return signal_details, [], []

    lookback = max(3, config["set3_left_lookback"])
    slope_period = max(1, config["set3_ema_slope_period"])
    start_index = max(lookback + 1, slope_period)
    body_sizes = sorted(
        abs(bar["close"] - bar["open"])
        for bar in data
        if abs(bar["close"] - bar["open"]) > 0
    )
    canonical_brick_size = body_sizes[len(body_sizes) // 2]
    body_size_tolerance = config.get("tick_size", 0.25) / 2
    last_signal_zone = None

    for i in range(start_index, len(data)):
        current = data[i]
        pullback = data[i - 1]
        time_string = current["time"].split("T")[1].replace("Z", "")
        if not config["start_time"] <= time_string <= config["end_time"]:
            continue
        try:
            prior_delta = (
                datetime.fromisoformat(data[i - 1]["time"].replace("Z", "")) -
                datetime.fromisoformat(data[i - 2]["time"].replace("Z", ""))
            ).total_seconds()
        except ValueError:
            continue
        if prior_delta < config["set3_min_prior_brick_seconds"]:
            continue

        current_direction = 1 if current["close"] > current["open"] else -1
        pullback_direction = 1 if pullback["close"] > pullback["open"] else -1
        is_synthetic = current_direction == pullback_direction

        brick_size = abs(current["close"] - current["open"])
        if (
            brick_size == 0 or
            abs(brick_size - canonical_brick_size) > body_size_tolerance or
            current.get("ema") is None or
            pullback.get("ema") is None
        ):
            continue

        current_body_low = min(current["open"], current["close"])
        current_body_high = max(current["open"], current["close"])
        if is_synthetic:
            slope_index = i
            if current_direction > 0:
                projected_open = current_body_low
                projected_close = current_body_low - brick_size
            else:
                projected_open = current_body_high
                projected_close = current_body_high + brick_size
            pullback_body_low = min(projected_open, projected_close)
            pullback_body_high = max(projected_open, projected_close)
            left_bars = data[i - lookback:i]
            setup_ema = current["ema"]
        else:
            pullback_start = i - 1
            while pullback_start > 0:
                previous_direction = (
                    1 if data[pullback_start - 1]["close"] > data[pullback_start - 1]["open"]
                    else -1 if data[pullback_start - 1]["close"] < data[pullback_start - 1]["open"]
                    else 0
                )
                if previous_direction != pullback_direction:
                    break
                pullback_start -= 1

            slope_index = pullback_start - 1
            if slope_index < slope_period:
                continue
            projected_open = None
            projected_close = None
            pullback_body_low = min(pullback["open"], pullback["close"])
            pullback_body_high = max(pullback["open"], pullback["close"])
            left_bars = data[max(0, pullback_start - lookback):pullback_start]
            setup_ema = pullback["ema"]

        slope_base = data[slope_index - slope_period].get("ema")
        slope_ema = data[slope_index].get("ema")
        if slope_base is None or slope_ema is None:
            continue
        ema_slope = slope_ema - slope_base
        minimum_gap = (
            config["set3_synthetic_min_ema_gap_bricks"]
            if is_synthetic
            else config["set3_min_ema_gap_bricks"]
        ) * brick_size

        left_overlaps = sum(
            min(max(bar["open"], bar["close"]), pullback_body_high) >
            max(min(bar["open"], bar["close"]), pullback_body_low)
            for bar in left_bars
        )
        if left_overlaps > config["set3_max_left_overlaps"]:
            continue
        if last_signal_zone is not None:
            vertical_gap = max(
                0.0,
                max(last_signal_zone["low"], pullback_body_low) -
                min(last_signal_zone["high"], pullback_body_high)
            )
            if vertical_gap < 2 * brick_size:
                continue

        if current_direction > 0:
            trend_is_strong = ema_slope >= config["set3_ema_slope_threshold"]
            if is_synthetic:
                setup_is_off_ema = pullback_body_low - setup_ema >= minimum_gap
            else:
                setup_is_off_ema = current_body_low - current["ema"] >= minimum_gap
            action = "Buy"
        else:
            trend_is_strong = ema_slope <= -config["set3_ema_slope_threshold"]
            if is_synthetic:
                setup_is_off_ema = setup_ema - pullback_body_high >= minimum_gap
            else:
                setup_is_off_ema = current["ema"] - current_body_high >= minimum_gap
            action = "Sell"

        if not trend_is_strong or not setup_is_off_ema:
            continue

        signal_details.append({
            "barIndex": i,
            "markerBarIndex": i if is_synthetic else i - 1,
            "timestamp": current["time"],
            "markerTimestamp": current["time"] if is_synthetic else pullback["time"],
            "action": action,
            "setupType": "synthetic" if is_synthetic else "actual",
            "virtualBrick": {
                "open": projected_open,
                "close": projected_close,
            } if is_synthetic else None,
            "metrics": {
                "emaSlope": ema_slope,
                "emaGapBricks": (
                    (pullback_body_low - setup_ema if is_synthetic else current_body_low - current["ema"])
                    if current_direction > 0
                    else (setup_ema - pullback_body_high if is_synthetic else current["ema"] - current_body_high)
                ) / brick_size,
                "leftOverlaps": left_overlaps,
                "leftLookback": lookback,
                "pullbackBarIndex": None if is_synthetic else i - 1,
            },
        })
        last_signal_zone = {
            "low": pullback_body_low,
            "high": pullback_body_high,
        }

    return (
        signal_details,
        evaluate_set3_signals(data, signal_details, config),
        run_arid_e_trade_sequence(data, signal_details, config),
    )

def run_strategy(data, config):
    trades = []
    signals = {} # timestamp -> "Buy" or "Sell"
    signal_details = [] # Exact bar identity for charts with duplicate timestamps
    signal_by_index = {}
    
    # (EMA 50 calculation removed)

    # Needs enough history to calculate EMA slope
    slope_period = config["ema_slope_period"]
    
    for i in range(max(slope_period, 4), len(data)):
        current = data[i]
        prev = data[i - slope_period]
        
        o, h, l, c = current["open"], current["high"], current["low"], current["close"]
        ema = current["ema"]
        prev_ema = prev["ema"]
        
        if ema is None or prev_ema is None:
            continue
            
        ema_slope = ema - prev_ema
        is_up_brick = c > o
        is_down_brick = c < o
        
        # Check pure time cool-down first
        cooldown = config.get("cooldown_bars", 10)
        if len(signal_details) > 0 and (i - signal_details[-1]["barIndex"]) < cooldown:
            continue
            
        # Immediate previous bar to check wick extensions
        prev_bar = data[i - 1]
        offset_distance = config.get("wick_body_offset_ticks", 0) * config.get("tick_size", 0.25)
        buy_tail_limit = prev_bar["open"] - offset_distance
        sell_tail_limit = prev_bar["open"] + offset_distance
        
        # Trend Filter: 8 EMA sloping upwards
        if ema_slope >= config["ema_slope_threshold"]:
            # Trigger: completed Blue (up) brick
            if is_up_brick:
                # Bottom Wick Length
                wick_length = o - l
                brick_size = abs(c - o)
                required_wick_length = min(config["min_wick_length"], brick_size)
                
                # Proximity of close to EMA
                body_dist = c - ema
                
                # Wicks may briefly test the EMA during a clean trend. Require
                # the previous three brick bodies, rather than their full
                # high/low ranges, to remain above the EMA.
                prev_3_above = (
                    min(data[i-1]["open"], data[i-1]["close"]) >= data[i-1]["ema"] and
                    min(data[i-2]["open"], data[i-2]["close"]) >= data[i-2]["ema"] and
                    min(data[i-3]["open"], data[i-3]["close"]) >= data[i-3]["ema"]
                )
                
                # New Rules:
                # - Tail goes back at least to the parameterized open offset (l <= buy_tail_limit)
                # - Tail may pierce slightly below the EMA, within max_ema_pierce
                # - Bars above the EMA for several consecutive bars (prev_3_above)
                if (wick_length >= required_wick_length and
                    l <= buy_tail_limit and
                    l >= ema - config["max_ema_pierce"] and
                    prev_3_above and
                    body_dist <= config["max_ema_distance"]):
                    
                    signals[current["time"]] = "Buy"
                    signal_by_index[i] = "Buy"
                    signal_details.append({
                        "barIndex": i,
                        "timestamp": current["time"],
                        "action": "Buy",
                    })
                    
        # 2. Check Bearish Setup (Short / Sell)
        # Trend Filter: 8 EMA sloping downwards
        elif ema_slope <= -config["ema_slope_threshold"]:
            # Trigger: completed Red (down) brick
            if is_down_brick:
                # Top Wick Length
                wick_length = h - o
                brick_size = abs(c - o)
                required_wick_length = min(config["min_wick_length"], brick_size)
                
                # Proximity of close to EMA
                body_dist = ema - c
                
                # Wicks may briefly test the EMA during a clean trend. Require
                # the previous three brick bodies, rather than their full
                # high/low ranges, to remain below the EMA.
                prev_3_below = (
                    max(data[i-1]["open"], data[i-1]["close"]) <= data[i-1]["ema"] and
                    max(data[i-2]["open"], data[i-2]["close"]) <= data[i-2]["ema"] and
                    max(data[i-3]["open"], data[i-3]["close"]) <= data[i-3]["ema"]
                )
                
                # New Rules:
                # - Tail goes back at least to the parameterized open offset (h >= sell_tail_limit)
                # - Tail may pierce slightly above the EMA, within max_ema_pierce
                # - Bars below the EMA for several consecutive bars (prev_3_below)
                if (wick_length >= required_wick_length and
                    h >= sell_tail_limit and
                    h <= ema + config["max_ema_pierce"] and
                    prev_3_below and
                    body_dist <= config["max_ema_distance"]):
                    
                    signals[current["time"]] = "Sell"
                    signal_by_index[i] = "Sell"
                    signal_details.append({
                        "barIndex": i,
                        "timestamp": current["time"],
                        "action": "Sell",
                    })

    # Evaluate every signal independently: one favorable brick must complete
    # before price exceeds the signal bar's tail by two ticks.
    tail_break_distance = config["tick_size"] * config["tail_break_ticks"]
    for signal in signal_details:
        i = signal["barIndex"]
        signal_bar = data[i]
        direction = signal["action"]
        entry_price = signal_bar["close"]
        brick_size = abs(signal_bar["close"] - signal_bar["open"])

        evaluation = {
            "entry_time": signal_bar["time"],
            "barIndex": i,
            "direction": direction,
            "entry_price": entry_price,
            "brick_size": brick_size,
            "tail_break_distance": tail_break_distance,
            "result": "Pending",
        }

        if direction == "Buy":
            evaluation["success_price"] = entry_price + brick_size
            evaluation["failure_price"] = signal_bar["low"] - tail_break_distance
        else:
            evaluation["success_price"] = entry_price - brick_size
            evaluation["failure_price"] = signal_bar["high"] + tail_break_distance

        for j in range(i + 1, len(data)):
            future = data[j]
            if direction == "Buy":
                failed = future["low"] <= evaluation["failure_price"]
                succeeded = (
                    future["close"] > future["open"] and
                    future["close"] >= evaluation["success_price"]
                )
            else:
                failed = future["high"] >= evaluation["failure_price"]
                succeeded = (
                    future["close"] < future["open"] and
                    future["close"] <= evaluation["success_price"]
                )

            # OHLC data cannot establish intrabar ordering. If both thresholds
            # occur in one bar, count the tail break first conservatively.
            if failed:
                evaluation["result"] = "Fail"
                evaluation["outcome_reason"] = "Tail broken by two ticks"
                evaluation["outcome_time"] = future["time"]
                evaluation["outcome_barIndex"] = j
                break
            if succeeded:
                evaluation["result"] = "Pass"
                evaluation["outcome_reason"] = "One favorable brick completed"
                evaluation["outcome_time"] = future["time"]
                evaluation["outcome_barIndex"] = j
                break

        trades.append(evaluation)

    return signals, signal_details, trades

def run_daily_campaign(data, signal_details, config, exit_strategy="fixed"):
    # Set campaign parameters based on the chosen strategy
    target_bricks = 2.0
    stop_bricks = 2.0
    entry_cooldown_bars = 3
    be_trigger_bricks = 1.0
    
    if exit_strategy == "fixed2":
        stop_bricks = 1.5
        entry_cooldown_bars = 2

    # Group bar indices by date YYYY-MM-DD
    date_to_bar_indices = {}
    for i, bar in enumerate(data):
        date_str = bar["time"].split("T")[0]
        if date_str not in date_to_bar_indices:
            date_to_bar_indices[date_str] = []
        date_to_bar_indices[date_str].append(i)

    # Group signals by date, filtering for start_time <= time <= end_time PST (local time)
    start_time = config.get("start_time", "06:31:00")
    end_time = config.get("end_time", "11:00:00")
    date_to_signals = {}
    for sig in signal_details:
        t = sig["timestamp"]
        date_str = t.split("T")[0]
        time_str = t.split("T")[1].replace("Z", "")
        if start_time <= time_str <= end_time:
            if date_str not in date_to_signals:
                date_to_signals[date_str] = []
            date_to_signals[date_str].append(sig)

    daily_reports = []
    
    # We sort dates chronologically
    sorted_dates = sorted(date_to_bar_indices.keys())
    
    for date_str in sorted_dates:
        day_signals = date_to_signals.get(date_str, [])
        if not day_signals:
            continue
            
        bar_indices = date_to_bar_indices[date_str]
        day_signals_by_index = {sig["barIndex"]: sig for sig in day_signals}
        
        daily_net_profit = 0.0
        has_lost_today = False
        active_trade = None
        trade_history = []
        done_for_the_day = False
        success_time = None
        last_exit_bar_index = -999
        
        # We assume the brick size is constant or can be derived from the first bar of the day
        first_bar = data[bar_indices[0]]
        brick_size = abs(first_bar["close"] - first_bar["open"])
        if brick_size == 0:
            brick_size = 3.75 # Fallback to standard MNQ 15-tick brick size in points
            
        for i in bar_indices:
            if done_for_the_day:
                break
                
            bar = data[i]
            was_in_position = active_trade is not None
            
            # Update active trade
            if active_trade is not None:
                direction = active_trade["direction"]
                entry_price = active_trade["entry_price"]
                stop_price = active_trade["stop_price"]
                target_price = active_trade["target_price"]
                be_triggered = active_trade["be_triggered"]
                
                if direction == "Buy":
                    # Check exits first
                    hit_stop = bar["low"] <= stop_price
                    
                    if exit_strategy == "trail":
                        is_opposite = bar["close"] < bar["open"]
                        if hit_stop:
                            if be_triggered:
                                daily_net_profit += 0.0
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "BE", "profit_bricks": 0.0})
                            else:
                                daily_net_profit -= 2.0
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Loss", "profit_bricks": -2.0})
                            active_trade = None
                        elif is_opposite:
                            pnl_points = bar["close"] - entry_price
                            pnl_bricks = round(pnl_points / brick_size, 1)
                            daily_net_profit += pnl_bricks
                            trade_history.append({
                                **active_trade,
                                "exit_time": bar["time"], "exit_barIndex": i,
                                "result": "Trail",
                                "profit_bricks": pnl_bricks
                            })
                            active_trade = None
                        else:
                            # Check if we trigger breakeven for the next bar
                            if bar["high"] >= entry_price + brick_size and not be_triggered:
                                active_trade["be_triggered"] = True
                                active_trade["stop_price"] = entry_price
                                be_triggered = True
                                stop_price = entry_price
                    elif exit_strategy == "stepup":
                        hit_target = bar["high"] >= target_price
                        if hit_stop and hit_target:
                            daily_net_profit -= 2.0
                            has_lost_today = True
                            trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Loss", "profit_bricks": -2.0})
                            active_trade = None
                        elif hit_stop:
                            if has_lost_today and be_triggered:
                                daily_net_profit += 0.0
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "BE", "profit_bricks": 0.0})
                            else:
                                daily_net_profit -= 2.0
                                has_lost_today = True
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Loss", "profit_bricks": -2.0})
                            active_trade = None
                        elif hit_target:
                            win_bricks = 1.0 if not has_lost_today else 2.0
                            daily_net_profit += win_bricks
                            trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Win", "profit_bricks": win_bricks})
                            active_trade = None
                        else:
                            # Check if we trigger breakeven (only after loss)
                            if has_lost_today:
                                if bar["high"] >= entry_price + brick_size and not be_triggered:
                                    active_trade["be_triggered"] = True
                                    active_trade["stop_price"] = entry_price
                                    be_triggered = True
                                    stop_price = entry_price
                    else:
                        hit_target = bar["high"] >= target_price
                        if hit_stop and hit_target:
                            if be_triggered:
                                daily_net_profit += 0.0
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "BE", "profit_bricks": 0.0})
                            else:
                                daily_net_profit -= stop_bricks
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Loss", "profit_bricks": -stop_bricks})
                            active_trade = None
                        elif hit_stop:
                            if be_triggered:
                                daily_net_profit += 0.0
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "BE", "profit_bricks": 0.0})
                            else:
                                daily_net_profit -= stop_bricks
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Loss", "profit_bricks": -stop_bricks})
                            active_trade = None
                        elif hit_target:
                            daily_net_profit += target_bricks
                            trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Win", "profit_bricks": target_bricks})
                            active_trade = None
                        else:
                            # Check if we trigger breakeven for the next bar
                            if bar["high"] >= entry_price + be_trigger_bricks * brick_size and not be_triggered:
                                active_trade["be_triggered"] = True
                                active_trade["stop_price"] = entry_price
                                be_triggered = True
                                stop_price = entry_price
                else: # Sell
                    # Check exits first
                    hit_stop = bar["high"] >= stop_price
                    
                    if exit_strategy == "trail":
                        is_opposite = bar["close"] > bar["open"]
                        if hit_stop:
                            if be_triggered:
                                daily_net_profit += 0.0
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "BE", "profit_bricks": 0.0})
                            else:
                                daily_net_profit -= 2.0
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Loss", "profit_bricks": -2.0})
                            active_trade = None
                        elif is_opposite:
                            pnl_points = entry_price - bar["close"]
                            pnl_bricks = round(pnl_points / brick_size, 1)
                            daily_net_profit += pnl_bricks
                            trade_history.append({
                                **active_trade,
                                "exit_time": bar["time"], "exit_barIndex": i,
                                "result": "Trail",
                                "profit_bricks": pnl_bricks
                            })
                            active_trade = None
                        else:
                            # Check if we trigger breakeven for the next bar
                            if bar["low"] <= entry_price - brick_size and not be_triggered:
                                active_trade["be_triggered"] = True
                                active_trade["stop_price"] = entry_price
                                be_triggered = True
                                stop_price = entry_price
                    elif exit_strategy == "stepup":
                        hit_target = bar["low"] <= target_price
                        if hit_stop and hit_target:
                            daily_net_profit -= 2.0
                            has_lost_today = True
                            trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Loss", "profit_bricks": -2.0})
                            active_trade = None
                        elif hit_stop:
                            if has_lost_today and be_triggered:
                                daily_net_profit += 0.0
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "BE", "profit_bricks": 0.0})
                            else:
                                daily_net_profit -= 2.0
                                has_lost_today = True
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Loss", "profit_bricks": -2.0})
                            active_trade = None
                        elif hit_target:
                            win_bricks = 1.0 if not has_lost_today else 2.0
                            daily_net_profit += win_bricks
                            trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Win", "profit_bricks": win_bricks})
                            active_trade = None
                        else:
                            # Check if we trigger breakeven (only after loss)
                            if has_lost_today:
                                if bar["low"] <= entry_price - brick_size and not be_triggered:
                                    active_trade["be_triggered"] = True
                                    active_trade["stop_price"] = entry_price
                                    be_triggered = True
                                    stop_price = entry_price
                    else:
                        hit_target = bar["low"] <= target_price
                        if hit_stop and hit_target:
                            if be_triggered:
                                daily_net_profit += 0.0
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "BE", "profit_bricks": 0.0})
                            else:
                                daily_net_profit -= stop_bricks
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Loss", "profit_bricks": -stop_bricks})
                            active_trade = None
                        elif hit_stop:
                            if be_triggered:
                                daily_net_profit += 0.0
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "BE", "profit_bricks": 0.0})
                            else:
                                daily_net_profit -= stop_bricks
                                trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Loss", "profit_bricks": -stop_bricks})
                            active_trade = None
                        elif hit_target:
                            daily_net_profit += target_bricks
                            trade_history.append({**active_trade, "exit_time": bar["time"], "exit_barIndex": i, "result": "Win", "profit_bricks": target_bricks})
                            active_trade = None
                        else:
                            # Check if we trigger breakeven for the next bar
                            if bar["low"] <= entry_price - be_trigger_bricks * brick_size and not be_triggered:
                                active_trade["be_triggered"] = True
                                active_trade["stop_price"] = entry_price
                                be_triggered = True
                                stop_price = entry_price
                            
                # Check target hit
                if daily_net_profit >= target_bricks:
                    done_for_the_day = True
                    success_time = bar["time"]
                    break
            
            if was_in_position and active_trade is None:
                last_exit_bar_index = i
            
            # A signal that completes while a position is open is ignored,
            # including a signal on the same bar that closes the position.
            # Enforce at least 2 vertical bars separating consecutive entries (i - last_exit_bar_index >= entry_cooldown_bars).
            if not was_in_position and active_trade is None and not done_for_the_day:
                if i in day_signals_by_index:
                    if last_exit_bar_index != -999 and (i - last_exit_bar_index) < entry_cooldown_bars:
                        continue
                    sig = day_signals_by_index[i]
                    direction = sig["action"]
                    entry_price = bar["close"]
                    
                    if exit_strategy == "trail":
                        stop_price = entry_price - 2.0 * brick_size if direction == "Buy" else entry_price + 2.0 * brick_size
                        target_price = 999999999.0 if direction == "Buy" else -999999999.0
                    elif exit_strategy == "stepup" and not has_lost_today:
                        stop_price = entry_price - 2.0 * brick_size if direction == "Buy" else entry_price + 2.0 * brick_size
                        target_price = entry_price + 1.0 * brick_size if direction == "Buy" else entry_price - 1.0 * brick_size
                    else:
                        stop_price = entry_price - stop_bricks * brick_size if direction == "Buy" else entry_price + stop_bricks * brick_size
                        target_price = entry_price + target_bricks * brick_size if direction == "Buy" else entry_price - target_bricks * brick_size
                        
                    active_trade = {
                        "entry_time": bar["time"],
                        "entry_barIndex": i,
                        "direction": direction,
                        "entry_price": entry_price,
                        "stop_price": stop_price,
                        "target_price": target_price,
                        "be_triggered": False,
                    }
                    
        # Close open positions at the end of the day session
        if active_trade is not None and not done_for_the_day:
            last_i = bar_indices[-1]
            last_bar = data[last_i]
            close_price = last_bar["close"]
            direction = active_trade["direction"]
            entry_price = active_trade["entry_price"]
            
            if direction == "Buy":
                pnl_points = close_price - entry_price
            else:
                pnl_points = entry_price - close_price
                
            pnl_bricks = pnl_points / brick_size
            daily_net_profit += pnl_bricks
            
            trade_history.append({
                **active_trade,
                "exit_time": last_bar["time"], "exit_barIndex": last_i,
                "result": "EndSession",
                "profit_bricks": pnl_bricks
            })
            active_trade = None

        daily_reports.append({
            "date": date_str,
            "net_profit_bricks": daily_net_profit,
            "result": "Win" if daily_net_profit >= 2.0 else "Loss/Flat",
            "success_time": success_time,
            "trades_count": len(trade_history),
            "trades": trade_history
        })
        
    # Calculate global campaign statistics
    total_days = len(daily_reports)
    winning_days = len([d for d in daily_reports if d["result"] == "Win"])
    losing_days = total_days - winning_days
    win_rate = (winning_days / total_days * 100) if total_days > 0 else 0.0
    
    # Calculate average time to success (in minutes from 06:30 AM PST)
    success_times_min = []
    for d in daily_reports:
        if d["result"] == "Win" and d["success_time"]:
            time_part = d["success_time"].split("T")[1].replace("Z", "")
            h, m, s = map(int, time_part.split(":"))
            total_minutes = h * 60 + m
            success_times_min.append(total_minutes)
            
    avg_success_time_str = "N/A"
    if success_times_min:
        avg_minutes = sum(success_times_min) / len(success_times_min)
        avg_h = int(avg_minutes // 60)
        avg_m = int(avg_minutes % 60)
        avg_success_time_str = f"{avg_h:02d}:{avg_m:02d} PST"
        
    max_drawdown = 0.0
    for d in daily_reports:
        running_pnl = 0.0
        for t in d["trades"]:
            running_pnl += t.get("profit_bricks", 0.0)
            if running_pnl < max_drawdown:
                max_drawdown = running_pnl
            
    return {
        "daily_reports": daily_reports,
        "exit_strategy": exit_strategy,
        "summary": {
            "total_days": total_days,
            "winning_days": winning_days,
            "losing_days": losing_days,
            "win_rate": win_rate,
            "avg_success_time": avg_success_time_str,
            "max_drawdown_bricks": max_drawdown,
            "target_bricks": target_bricks
        }
    }

def infer_price_increment(data):
    values = []
    for bar in data[:min(len(data), 5000)]:
        values.extend([bar["open"], bar["high"], bar["low"], bar["close"]])
    unique_values = sorted(set(values))
    increments = [
        round(b - a, 10)
        for a, b in zip(unique_values, unique_values[1:])
        if b > a
    ]
    return min(increments) if increments else 1.0

def infer_range_size(data):
    range_counts = {}
    for bar in data:
        range_size = bar["high"] - bar["low"]
        if range_size <= 0:
            continue
        key = round(range_size, 10)
        range_counts[key] = range_counts.get(key, 0) + 1
    if range_counts:
        return max(range_counts.items(), key=lambda item: item[1])[0]

    body_counts = {}
    for bar in data:
        body_size = abs(bar["close"] - bar["open"])
        if body_size <= 0:
            continue
        key = round(body_size, 10)
        body_counts[key] = body_counts.get(key, 0) + 1
    return max(body_counts.items(), key=lambda item: item[1])[0] if body_counts else 1.0

def summarize_campaign(daily_reports, target_bricks, exit_strategy):
    total_days = len(daily_reports)
    winning_days = len([day for day in daily_reports if day["net_profit_bricks"] > 0])
    losing_days = len([day for day in daily_reports if day["net_profit_bricks"] <= 0])
    total_trades = sum(day["trades_count"] for day in daily_reports)
    total_skipped_trades = sum(len(day.get("skipped_trades", [])) for day in daily_reports)
    net_profit = sum(day["net_profit_bricks"] for day in daily_reports)
    winning_trades = 0
    losing_trades = 0
    breakeven_trades = 0
    max_drawdown = 0.0
    running_pnl = 0.0
    for day in daily_reports:
        for trade in day["trades"]:
            profit = trade.get("profit_bricks", 0.0)
            if profit > 0:
                winning_trades += 1
            elif profit < 0:
                losing_trades += 1
            else:
                breakeven_trades += 1
            running_pnl += profit
            max_drawdown = min(max_drawdown, running_pnl)

    return {
        "daily_reports": daily_reports,
        "exit_strategy": exit_strategy,
        "summary": {
            "total_days": total_days,
            "winning_days": winning_days,
            "losing_days": losing_days,
            "win_rate": (winning_days / total_days * 100) if total_days else 0.0,
            "total_trades": total_trades,
            "total_skipped_trades": total_skipped_trades,
            "winning_trades": winning_trades,
            "losing_trades": losing_trades,
            "breakeven_trades": breakeven_trades,
            "trade_win_rate": (winning_trades / total_trades * 100) if total_trades else 0.0,
            "net_profit_bricks": net_profit,
            "max_drawdown_bricks": max_drawdown,
            "target_bricks": target_bricks,
        }
    }

def run_ema_bounce_campaign(data, signal_details, config):
    campaign_name = "Campaign EMA Bounce"
    start_time = config.get("start_time", "06:31:00")
    end_time = config.get("end_time", "11:00:00")
    tick_size = infer_price_increment(data)
    range_size = infer_range_size(data)
    stop_buffer = config.get("ema_bounce_stop_buffer_ticks", 2) * tick_size
    max_stop_distance = config.get("ema_bounce_max_stop_ticks", 15) * tick_size

    date_to_bar_indices = {}
    for index, bar in enumerate(data):
        date = bar["time"].split("T")[0]
        date_to_bar_indices.setdefault(date, []).append(index)

    date_to_signals = {}
    for signal in signal_details:
        date, time = signal["timestamp"].split("T")
        time = time.replace("Z", "")
        if start_time <= time <= end_time:
            date_to_signals.setdefault(date, []).append(signal)

    daily_reports = []
    for date in sorted(date_to_bar_indices):
        day_signals = sorted(date_to_signals.get(date, []), key=lambda signal: signal["barIndex"])
        if not day_signals:
            continue

        day_signal_by_index = {signal["barIndex"]: signal for signal in day_signals}
        active_trade = None
        trades = []
        skipped_trades = []
        daily_net_profit = 0.0

        for index in date_to_bar_indices[date]:
            bar = data[index]
            _, time = bar["time"].split("T")
            time = time.replace("Z", "")

            if active_trade is not None:
                direction = active_trade["direction"]
                entry_price = active_trade["entry_price"]
                stop_price = active_trade["stop_price"]
                if direction == "Buy":
                    hit_stop = bar["low"] <= stop_price
                    opposite_close = bar["close"] < bar["open"]
                    if hit_stop:
                        profit_points = stop_price - entry_price
                        profit_bricks = profit_points / range_size
                        daily_net_profit += profit_bricks
                        trades.append({
                            **active_trade,
                            "exit_time": bar["time"],
                            "exit_barIndex": index,
                            "exit_price": stop_price,
                            "result": "Stop",
                            "profit_points": profit_points,
                            "profit_bricks": profit_bricks,
                        })
                        active_trade = None
                    elif opposite_close:
                        profit_points = bar["close"] - entry_price
                        profit_bricks = profit_points / range_size
                        daily_net_profit += profit_bricks
                        trades.append({
                            **active_trade,
                            "exit_time": bar["time"],
                            "exit_barIndex": index,
                            "exit_price": bar["close"],
                            "result": "OppositeClose",
                            "profit_points": profit_points,
                            "profit_bricks": profit_bricks,
                        })
                        active_trade = None
                else:
                    hit_stop = bar["high"] >= stop_price
                    opposite_close = bar["close"] > bar["open"]
                    if hit_stop:
                        profit_points = entry_price - stop_price
                        profit_bricks = profit_points / range_size
                        daily_net_profit += profit_bricks
                        trades.append({
                            **active_trade,
                            "exit_time": bar["time"],
                            "exit_barIndex": index,
                            "exit_price": stop_price,
                            "result": "Stop",
                            "profit_points": profit_points,
                            "profit_bricks": profit_bricks,
                        })
                        active_trade = None
                    elif opposite_close:
                        profit_points = entry_price - bar["close"]
                        profit_bricks = profit_points / range_size
                        daily_net_profit += profit_bricks
                        trades.append({
                            **active_trade,
                            "exit_time": bar["time"],
                            "exit_barIndex": index,
                            "exit_price": bar["close"],
                            "result": "OppositeClose",
                            "profit_points": profit_points,
                            "profit_bricks": profit_bricks,
                        })
                        active_trade = None

            if active_trade is not None or time > end_time:
                continue
            signal = day_signal_by_index.get(index)
            if not signal:
                continue

            direction = signal["action"]
            entry_price = bar["close"]
            if direction == "Buy":
                stop_price = bar["low"] - stop_buffer
                stop_distance = entry_price - stop_price
            else:
                stop_price = bar["high"] + stop_buffer
                stop_distance = stop_price - entry_price

            if stop_distance > max_stop_distance:
                skipped_trades.append({
                    "entry_time": bar["time"],
                    "entry_barIndex": index,
                    "direction": direction,
                    "entry_price": entry_price,
                    "stop_price": stop_price,
                    "stop_distance_points": stop_distance,
                    "reason": "Stop distance too wide",
                })
                continue

            active_trade = {
                "campaign": campaign_name,
                "entry_time": bar["time"],
                "entry_barIndex": index,
                "direction": direction,
                "entry_price": entry_price,
                "stop_price": stop_price,
                "stop_distance_points": stop_distance,
                "stop_distance_bricks": stop_distance / range_size,
                "bounce_type": signal.get("metrics", {}).get("bounceType"),
            }

        if active_trade is not None:
            last_index = date_to_bar_indices[date][-1]
            last_bar = data[last_index]
            if active_trade["direction"] == "Buy":
                profit_points = last_bar["close"] - active_trade["entry_price"]
            else:
                profit_points = active_trade["entry_price"] - last_bar["close"]
            profit_bricks = profit_points / range_size
            daily_net_profit += profit_bricks
            trades.append({
                **active_trade,
                "exit_time": last_bar["time"],
                "exit_barIndex": last_index,
                "exit_price": last_bar["close"],
                "result": "EndSession",
                "profit_points": profit_points,
                "profit_bricks": profit_bricks,
            })

        daily_reports.append({
            "date": date,
            "net_profit_bricks": daily_net_profit,
            "result": "Win" if daily_net_profit > 0 else "Loss/Flat",
            "success_time": None,
            "trades_count": len(trades),
            "trades": trades,
            "skipped_trades": skipped_trades,
        })

    result = summarize_campaign(daily_reports, 0.0, "ema_bounce_opposite_close")
    result["name"] = campaign_name
    result["rules"] = {
        "entry": "Close of EMA Bounce Set 2 signal bar",
        "stop": "Signal tail plus two inferred ticks",
        "max_stop_ticks": config.get("ema_bounce_max_stop_ticks", 15),
        "exit": "First opposite-color close, stop, or session end",
        "range_size": range_size,
        "tick_size": tick_size,
    }
    return result

def write_mes_reg5_daily_recovery_report(report):
    rules = report.get("rules", {})
    summary = report.get("summary", {})
    tick_size = rules.get("tick_size", 0.25)
    range_size = rules.get("range_size", tick_size * 5)

    def ticks(points):
        return points / tick_size if tick_size else 0.0

    def time_only(timestamp):
        return timestamp.split("T")[1].replace("Z", "") if timestamp else ""

    lines = [
        "# MES Reg5 Daily Recovery Campaign Report",
        "",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "## Summary",
        "",
        f"- Campaign: {report.get('name', 'MES Reg5 Daily Recovery')}",
        f"- Session: {rules.get('session', 'N/A')}",
        f"- Days traded: {summary.get('total_days', 0)}",
        f"- Winning days: {summary.get('winning_days', 0)}",
        f"- Losing/flat days: {summary.get('losing_days', 0)}",
        f"- Day win rate: {summary.get('win_rate', 0.0):.1f}%",
        f"- Total trades: {summary.get('total_trades', 0)}",
        f"- Fast-market skipped signals: {summary.get('total_skipped_trades', 0)}",
        f"- Paper quarantine trades: {summary.get('total_paper_trades', 0)}",
        f"- Quarantine events: {summary.get('total_quarantine_entries', 0)}",
        f"- Net result: {summary.get('net_profit_bricks', 0.0):.1f} bars / {summary.get('net_profit_bricks', 0.0) * range_size / tick_size:.0f} ticks",
        f"- Max campaign drawdown: {summary.get('max_drawdown_bricks', 0.0):.1f} bars / {summary.get('max_drawdown_bricks', 0.0) * range_size / tick_size:.0f} ticks",
        "",
        "## Rules Used",
        "",
    ]

    for key in ["entry", "target", "warmup", "fast_market_skip", "first_trade", "recovery", "quarantine", "session"]:
        if key in rules:
            lines.append(f"- {key.replace('_', ' ').title()}: {rules[key]}")

    lines.extend([
        "",
        "## Daily Breakdown",
        "",
        "| Date | Result | Trades | Paper | Fast Skips | Net Bars | Net Ticks | First Entry | Done Time |",
        "|---|---:|---:|---:|---:|---:|---:|---|---|",
    ])

    for day in report.get("daily_reports", []):
        done_time = time_only(day.get("success_time"))
        first_entry = time_only(day["trades"][0]["entry_time"]) if day.get("trades") else ""
        net_ticks = day.get("net_profit_bricks", 0.0) * range_size / tick_size if tick_size else 0.0
        fast_skips = len(day.get("skipped_trades", []))
        paper_trades = len(day.get("paper_trades", []))
        lines.append(
            f"| {day['date']} | {day['result']} | {day['trades_count']} | {paper_trades} | {fast_skips} | "
            f"{day.get('net_profit_bricks', 0.0):.1f} | {net_ticks:.0f} | {first_entry} | {done_time} |"
        )

    lines.extend(["", "## Trade Details", ""])
    for day in report.get("daily_reports", []):
        lines.extend([
            f"### {day['date']} - {day['result']} ({day['trades_count']} trades, {day.get('net_profit_bricks', 0.0):.1f} bars)",
            "",
            "| # | Direction | Entry | Entry Price | Exit | Exit Price | Result | P/L Ticks | Daily Cum Ticks |",
            "|---:|---|---|---:|---|---:|---|---:|---:|",
        ])
        for index, trade in enumerate(day.get("trades", []), 1):
            lines.append(
                f"| {index} | {trade['direction']} | {time_only(trade['entry_time'])} | {trade['entry_price']:.2f} | "
                f"{time_only(trade['exit_time'])} | {trade['exit_price']:.2f} | {trade['result']} | "
                f"{ticks(trade.get('profit_points', 0.0)):.0f} | {ticks(trade.get('daily_profit_points', 0.0)):.0f} |"
            )
        paper_trades = day.get("paper_trades", [])
        if paper_trades:
            lines.extend([
                "",
                "Paper quarantine trades:",
                "",
                "| # | Direction | Entry | Exit | Result | Paper P/L Ticks |",
                "|---:|---|---|---|---|---:|",
            ])
            for index, trade in enumerate(paper_trades, 1):
                lines.append(
                    f"| {index} | {trade['direction']} | {time_only(trade['entry_time'])} | "
                    f"{time_only(trade['exit_time'])} | {trade['result']} | "
                    f"{ticks(trade.get('profit_points', 0.0)):.0f} |"
                )
        skipped_trades = day.get("skipped_trades", [])
        if skipped_trades:
            lines.extend([
                "",
                "Skipped fast-market signals:",
                "",
                "| # | Direction | Time | Seconds Since Previous Bar | Reason |",
                "|---:|---|---|---:|---|",
            ])
            for index, skipped in enumerate(skipped_trades, 1):
                lines.append(
                    f"| {index} | {skipped['direction']} | {time_only(skipped['time'])} | "
                    f"{skipped.get('seconds_since_previous_bar', 0.0):.1f} | {skipped.get('reason', '')} |"
                )
        lines.append("")

    project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_dir = os.path.join(project_dir, "scratch")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "mes-reg5-daily-recovery-report.md")
    with open(output_path, "w") as report_file:
        report_file.write("\n".join(lines) + "\n")

def run_mes_reg5_daily_recovery_campaign(data, signal_details, config):
    campaign_name = "MES Reg5 Daily Recovery"
    start_time = "06:30:00"
    end_time = "14:00:00"
    tick_size = infer_price_increment(data)
    range_size = infer_range_size(data)
    target_points = range_size
    stop_points = range_size * 1.5
    warmup_bars = 10
    min_manual_signal_seconds = 3.0
    quarantine_loss_threshold = 3
    quarantine_required_paper_wins = 1

    def bar_direction(bar):
        if bar["close"] > bar["open"]:
            return "Buy"
        if bar["close"] < bar["open"]:
            return "Sell"
        return "Flat"

    def in_session(timestamp):
        time = timestamp.split("T")[1].replace("Z", "")
        return start_time <= time <= end_time

    def seconds_from_previous_bar(index):
        if index <= 0:
            return None
        try:
            current_time = datetime.fromisoformat(data[index]["time"].replace("Z", "+00:00"))
            previous_time = datetime.fromisoformat(data[index - 1]["time"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            return None
        return (current_time - previous_time).total_seconds()

    date_to_bar_indices = {}
    for index, bar in enumerate(data):
        date = bar["time"].split("T")[0]
        date_to_bar_indices.setdefault(date, []).append(index)

    date_to_signals = {}
    for signal in signal_details:
        date = signal["timestamp"].split("T")[0]
        if in_session(signal["timestamp"]):
            date_to_signals.setdefault(date, []).append(signal)

    daily_reports = []
    for date in sorted(date_to_signals):
        day_signals = sorted(date_to_signals[date], key=lambda signal: signal["barIndex"])
        session_bar_indices = [
            index
            for index in date_to_bar_indices.get(date, [])
            if in_session(data[index]["time"])
        ]
        first_eligible_entry_index = (
            session_bar_indices[warmup_bars]
            if len(session_bar_indices) > warmup_bars
            else 999999999
        )
        daily_profit_points = 0.0
        trades = []
        paper_trades = []
        skipped_trades = []
        next_eligible_entry_index = -1
        consecutive_losses = 0
        in_quarantine = False
        paper_wins = 0
        quarantine_entries = 0

        for signal in day_signals:
            if daily_profit_points >= target_points:
                break

            entry_index = signal["barIndex"]
            if entry_index < first_eligible_entry_index:
                continue
            if entry_index <= next_eligible_entry_index:
                continue

            entry_bar = data[entry_index]
            if not in_session(entry_bar["time"]):
                continue

            seconds_since_previous = seconds_from_previous_bar(entry_index)
            if (
                seconds_since_previous is not None and
                seconds_since_previous < min_manual_signal_seconds
            ):
                skipped_trades.append({
                    "campaign": campaign_name,
                    "time": entry_bar["time"],
                    "barIndex": entry_index,
                    "direction": signal["action"],
                    "reason": "FastMarket",
                    "seconds_since_previous_bar": seconds_since_previous,
                })
                continue

            direction = signal["action"]
            direction_multiplier = 1 if direction == "Buy" else -1
            entry_price = entry_bar["close"]
            first_trade = len(trades) == 0
            remaining_target_points = target_points - daily_profit_points
            exit_index = None
            exit_price = None
            profit_points = None
            result = None

            for index in range(entry_index + 1, len(data)):
                bar = data[index]
                if bar["time"].split("T")[0] != date or not in_session(bar["time"]):
                    exit_index = max(entry_index, index - 1)
                    exit_bar = data[exit_index]
                    exit_price = exit_bar["close"]
                    profit_points = (exit_price - entry_price) * direction_multiplier
                    result = "EndSession"
                    break

                favorable_points = (
                    bar["high"] - entry_price
                    if direction == "Buy"
                    else entry_price - bar["low"]
                )
                adverse_points = (
                    entry_price - bar["low"]
                    if direction == "Buy"
                    else bar["high"] - entry_price
                )
                if first_trade:
                    hit_target = favorable_points >= target_points
                    hit_stop = adverse_points >= stop_points
                    if hit_stop:
                        exit_index = index
                        exit_price = entry_price - direction_multiplier * stop_points
                        profit_points = -stop_points
                        result = "FirstStop"
                        break
                    if hit_target:
                        exit_index = index
                        exit_price = entry_price + direction_multiplier * target_points
                        profit_points = target_points
                        result = "DailyTarget"
                        break
                else:
                    if favorable_points >= remaining_target_points:
                        exit_index = index
                        exit_price = entry_price + direction_multiplier * remaining_target_points
                        profit_points = remaining_target_points
                        result = "RecoveryTarget"
                        break
                    if adverse_points >= stop_points:
                        exit_index = index
                        exit_price = entry_price - direction_multiplier * stop_points
                        profit_points = -stop_points
                        result = "RecoveryStop"
                        break
                    current_direction = bar_direction(bar)
                    if current_direction != "Flat" and current_direction != direction:
                        current_profit_points = (bar["close"] - entry_price) * direction_multiplier
                        if current_profit_points > 0:
                            exit_index = index
                            exit_price = bar["close"]
                            profit_points = current_profit_points
                            result = "OppositeClose"
                            break

            if exit_index is None:
                exit_index = entry_index
                exit_price = entry_price
                profit_points = 0.0
                result = "NoExit"

            next_eligible_entry_index = exit_index
            trade = {
                "campaign": campaign_name,
                "entry_time": entry_bar["time"],
                "entry_barIndex": entry_index,
                "direction": direction,
                "entry_price": entry_price,
                "exit_time": data[exit_index]["time"],
                "exit_barIndex": exit_index,
                "exit_price": exit_price,
                "result": result,
                "profit_points": profit_points,
                "profit_bricks": profit_points / range_size,
            }

            if in_quarantine:
                if profit_points > 0:
                    paper_wins += 1
                paper_trades.append({
                    **trade,
                    "paper_wins_in_window": paper_wins,
                })
                if paper_wins >= quarantine_required_paper_wins:
                    in_quarantine = False
                    consecutive_losses = 0
                    paper_wins = 0
                continue

            daily_profit_points += profit_points
            if profit_points < 0:
                consecutive_losses += 1
            elif profit_points > 0:
                consecutive_losses = 0

            trades.append({
                **trade,
                "daily_profit_points": daily_profit_points,
                "daily_profit_bricks": daily_profit_points / range_size,
                "is_campaign_complete": daily_profit_points >= target_points,
            })

            if (
                daily_profit_points < target_points and
                consecutive_losses >= quarantine_loss_threshold
            ):
                in_quarantine = True
                quarantine_entries += 1
                paper_wins = 0

        daily_reports.append({
            "date": date,
            "net_profit_bricks": daily_profit_points / range_size,
            "result": "Win" if daily_profit_points >= target_points else "Loss/Flat",
            "success_time": trades[-1]["exit_time"] if daily_profit_points >= target_points and trades else None,
            "trades_count": len(trades),
            "trades": trades,
            "paper_trades": paper_trades,
            "skipped_trades": skipped_trades,
            "quarantine_entries": quarantine_entries,
        })

    result = summarize_campaign(daily_reports, 1.0, "mes_reg5_daily_recovery")
    result["name"] = campaign_name
    result["summary"]["total_paper_trades"] = sum(len(day.get("paper_trades", [])) for day in daily_reports)
    result["summary"]["total_quarantine_entries"] = sum(day.get("quarantine_entries", 0) for day in daily_reports)
    target_ticks = int(range_size / tick_size) if tick_size else 0
    stop_ticks = int(stop_points / tick_size) if tick_size else 0
    result["rules"] = {
        "entry": "Close of MES Reg5 EMA Bounce Arity arrow bar",
        "target": f"Stop for the day at +1 bar (+{target_ticks} ticks)",
        "warmup": "Ignore signals until at least 10 session bars have formed",
        "fast_market_skip": "Skip otherwise eligible signals when the signal bar forms less than 3 seconds after the previous bar",
        "first_trade": f"First trade wins at +{target_ticks} ticks or loses at -{stop_ticks} ticks (1.5 bars)",
        "recovery": f"Recovery trades hold until daily P/L reaches +{target_ticks} ticks, a -{stop_ticks} tick trade stop is hit, or an opposite-color close appears while the trade is already profitable",
        "quarantine": "After 3 consecutive real losses, paper-trade qualifying signals until 1 paper winner appears, then resume real trades",
        "session": f"{start_time} to {end_time}",
        "range_size": range_size,
        "tick_size": tick_size,
    }
    write_mes_reg5_daily_recovery_report(result)
    return result

def run_mes_reg5_quarantine_experiments(data, signal_details, config):
    start_time = "06:30:00"
    end_time = "14:00:00"
    tick_size = infer_price_increment(data)
    range_size = infer_range_size(data)
    target_points = range_size
    first_stop_points = range_size * 2.0
    warmup_bars = 10
    min_manual_signal_seconds = 3.0

    variants = [
        {
            "name": "after_2_losses_until_1_paper_win",
            "loss_threshold": 2,
            "resume_mode": "until_wins",
            "required_paper_wins": 1,
        },
        {
            "name": "after_3_losses_until_1_paper_win",
            "loss_threshold": 3,
            "resume_mode": "until_wins",
            "required_paper_wins": 1,
        },
        {
            "name": "after_2_losses_next_2_any_win",
            "loss_threshold": 2,
            "resume_mode": "block",
            "paper_block_size": 2,
            "required_paper_wins": 1,
        },
        {
            "name": "after_2_losses_next_2_both_win",
            "loss_threshold": 2,
            "resume_mode": "block",
            "paper_block_size": 2,
            "required_paper_wins": 2,
        },
        {
            "name": "after_3_losses_next_2_any_win",
            "loss_threshold": 3,
            "resume_mode": "block",
            "paper_block_size": 2,
            "required_paper_wins": 1,
        },
    ]

    def bar_direction(bar):
        if bar["close"] > bar["open"]:
            return "Buy"
        if bar["close"] < bar["open"]:
            return "Sell"
        return "Flat"

    def in_session(timestamp):
        time = timestamp.split("T")[1].replace("Z", "")
        return start_time <= time <= end_time

    def seconds_from_previous_bar(index):
        if index <= 0:
            return None
        try:
            current_time = datetime.fromisoformat(data[index]["time"].replace("Z", "+00:00"))
            previous_time = datetime.fromisoformat(data[index - 1]["time"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            return None
        return (current_time - previous_time).total_seconds()

    def simulate_trade(signal, daily_profit_points, real_trade_count, date):
        entry_index = signal["barIndex"]
        entry_bar = data[entry_index]
        direction = signal["action"]
        direction_multiplier = 1 if direction == "Buy" else -1
        entry_price = entry_bar["close"]
        first_trade = real_trade_count == 0
        remaining_target_points = target_points - daily_profit_points
        exit_index = None
        exit_price = None
        profit_points = None
        result = None

        for index in range(entry_index + 1, len(data)):
            bar = data[index]
            if bar["time"].split("T")[0] != date or not in_session(bar["time"]):
                exit_index = max(entry_index, index - 1)
                exit_bar = data[exit_index]
                exit_price = exit_bar["close"]
                profit_points = (exit_price - entry_price) * direction_multiplier
                result = "EndSession"
                break

            favorable_points = (
                bar["high"] - entry_price
                if direction == "Buy"
                else entry_price - bar["low"]
            )
            adverse_points = (
                entry_price - bar["low"]
                if direction == "Buy"
                else bar["high"] - entry_price
            )
            if first_trade:
                if adverse_points >= first_stop_points:
                    exit_index = index
                    exit_price = entry_price - direction_multiplier * first_stop_points
                    profit_points = -first_stop_points
                    result = "FirstStop"
                    break
                if favorable_points >= target_points:
                    exit_index = index
                    exit_price = entry_price + direction_multiplier * target_points
                    profit_points = target_points
                    result = "DailyTarget"
                    break
            else:
                if favorable_points >= remaining_target_points:
                    exit_index = index
                    exit_price = entry_price + direction_multiplier * remaining_target_points
                    profit_points = remaining_target_points
                    result = "RecoveryTarget"
                    break
                if adverse_points >= first_stop_points:
                    exit_index = index
                    exit_price = entry_price - direction_multiplier * first_stop_points
                    profit_points = -first_stop_points
                    result = "RecoveryStop"
                    break
                current_direction = bar_direction(bar)
                if current_direction != "Flat" and current_direction != direction:
                    current_profit_points = (bar["close"] - entry_price) * direction_multiplier
                    if current_profit_points > 0:
                        exit_index = index
                        exit_price = bar["close"]
                        profit_points = current_profit_points
                        result = "OppositeClose"
                        break

        if exit_index is None:
            exit_index = entry_index
            exit_price = entry_price
            profit_points = 0.0
            result = "NoExit"

        return {
            "entry_time": entry_bar["time"],
            "entry_barIndex": entry_index,
            "direction": direction,
            "entry_price": entry_price,
            "exit_time": data[exit_index]["time"],
            "exit_barIndex": exit_index,
            "exit_price": exit_price,
            "result": result,
            "profit_points": profit_points,
            "profit_bricks": profit_points / range_size,
        }

    date_to_bar_indices = {}
    for index, bar in enumerate(data):
        date = bar["time"].split("T")[0]
        date_to_bar_indices.setdefault(date, []).append(index)

    date_to_signals = {}
    for signal in signal_details:
        date = signal["timestamp"].split("T")[0]
        if in_session(signal["timestamp"]):
            date_to_signals.setdefault(date, []).append(signal)

    def run_variant(variant):
        daily_reports = []
        total_paper_trades = 0
        total_quarantine_entries = 0
        avoided_loss_points = 0.0
        missed_profit_points = 0.0

        for date in sorted(date_to_signals):
            day_signals = sorted(date_to_signals[date], key=lambda signal: signal["barIndex"])
            session_bar_indices = [
                index
                for index in date_to_bar_indices.get(date, [])
                if in_session(data[index]["time"])
            ]
            first_eligible_entry_index = (
                session_bar_indices[warmup_bars]
                if len(session_bar_indices) > warmup_bars
                else 999999999
            )
            daily_profit_points = 0.0
            trades = []
            paper_trades = []
            skipped_trades = []
            next_eligible_entry_index = -1
            consecutive_losses = 0
            in_quarantine = False
            paper_wins = 0
            paper_seen = 0
            day_quarantine_entries = 0

            for signal in day_signals:
                if daily_profit_points >= target_points:
                    break

                entry_index = signal["barIndex"]
                if entry_index < first_eligible_entry_index:
                    continue
                if entry_index <= next_eligible_entry_index:
                    continue

                entry_bar = data[entry_index]
                if not in_session(entry_bar["time"]):
                    continue

                seconds_since_previous = seconds_from_previous_bar(entry_index)
                if (
                    seconds_since_previous is not None and
                    seconds_since_previous < min_manual_signal_seconds
                ):
                    skipped_trades.append({
                        "time": entry_bar["time"],
                        "barIndex": entry_index,
                        "direction": signal["action"],
                        "reason": "FastMarket",
                        "seconds_since_previous_bar": seconds_since_previous,
                    })
                    continue

                trade = simulate_trade(signal, daily_profit_points, len(trades), date)
                next_eligible_entry_index = trade["exit_barIndex"]

                if in_quarantine:
                    total_paper_trades += 1
                    paper_seen += 1
                    if trade["profit_points"] > 0:
                        paper_wins += 1
                        missed_profit_points += trade["profit_points"]
                    elif trade["profit_points"] < 0:
                        avoided_loss_points += abs(trade["profit_points"])

                    paper_trades.append({
                        **trade,
                        "paper_wins_in_window": paper_wins,
                        "paper_seen_in_window": paper_seen,
                    })

                    if variant["resume_mode"] == "until_wins":
                        if paper_wins >= variant["required_paper_wins"]:
                            in_quarantine = False
                            consecutive_losses = 0
                            paper_wins = 0
                            paper_seen = 0
                    elif paper_seen >= variant["paper_block_size"]:
                        if paper_wins >= variant["required_paper_wins"]:
                            in_quarantine = False
                            consecutive_losses = 0
                        paper_wins = 0
                        paper_seen = 0
                    continue

                daily_profit_points += trade["profit_points"]
                trade["daily_profit_points"] = daily_profit_points
                trade["daily_profit_bricks"] = daily_profit_points / range_size
                trade["is_campaign_complete"] = daily_profit_points >= target_points
                trades.append(trade)

                if trade["profit_points"] < 0:
                    consecutive_losses += 1
                elif trade["profit_points"] > 0:
                    consecutive_losses = 0

                if (
                    daily_profit_points < target_points and
                    consecutive_losses >= variant["loss_threshold"]
                ):
                    in_quarantine = True
                    total_quarantine_entries += 1
                    day_quarantine_entries += 1
                    paper_wins = 0
                    paper_seen = 0

            daily_reports.append({
                "date": date,
                "net_profit_bricks": daily_profit_points / range_size,
                "result": "Win" if daily_profit_points >= target_points else "Loss/Flat",
                "success_time": trades[-1]["exit_time"] if daily_profit_points >= target_points and trades else None,
                "trades_count": len(trades),
                "trades": trades,
                "paper_trades": paper_trades,
                "skipped_trades": skipped_trades,
                "quarantine_entries": day_quarantine_entries,
            })

        result = summarize_campaign(daily_reports, 1.0, f"mes_reg5_quarantine:{variant['name']}")
        result["name"] = variant["name"]
        result["variant"] = variant
        result["summary"]["total_paper_trades"] = total_paper_trades
        result["summary"]["total_quarantine_entries"] = total_quarantine_entries
        result["summary"]["avoided_loss_bricks"] = avoided_loss_points / range_size
        result["summary"]["missed_profit_bricks"] = missed_profit_points / range_size
        return result

    baseline = run_mes_reg5_daily_recovery_campaign(data, signal_details, config)
    results = [run_variant(variant) for variant in variants]
    ranked = sorted(
        results,
        key=lambda result: (
            result["summary"].get("winning_days", 0),
            result["summary"].get("net_profit_bricks", 0.0),
            -abs(result["summary"].get("max_drawdown_bricks", 0.0)),
            -result["summary"].get("total_trades", 0),
        ),
        reverse=True,
    )

    return {
        "objective": "Test paper-trade quarantine rules after consecutive real losses in the MES Reg5 Daily Recovery campaign.",
        "baseline_summary": baseline.get("summary", {}),
        "variants": results,
        "ranked": [
            {
                "name": result["name"],
                "variant": result["variant"],
                "summary": result["summary"],
            }
            for result in ranked
        ],
    }

def run_yellow_momentum_campaign(data, signal_details, config):
    campaign_name = "Yellow Momentum 1:1"
    start_time = config.get("start_time", "06:31:00")
    end_time = config.get("end_time", "11:00:00")
    range_size = infer_range_size(data)
    tick_size = infer_price_increment(data)

    date_to_bar_indices = {}
    for index, bar in enumerate(data):
        date = bar["time"].split("T")[0]
        date_to_bar_indices.setdefault(date, []).append(index)

    date_to_signals = {}
    for signal in signal_details:
        date, time = signal["timestamp"].split("T")
        time = time.replace("Z", "")
        if start_time <= time <= end_time:
            date_to_signals.setdefault(date, []).append(signal)

    daily_reports = []
    for date in sorted(date_to_bar_indices):
        day_signals = sorted(date_to_signals.get(date, []), key=lambda signal: signal["barIndex"])
        if not day_signals:
            continue

        day_signal_by_index = {signal["barIndex"]: signal for signal in day_signals}
        active_trade = None
        trades = []
        daily_net_profit = 0.0

        for index in date_to_bar_indices[date]:
            bar = data[index]
            _, time = bar["time"].split("T")
            time = time.replace("Z", "")

            if active_trade is not None:
                direction = active_trade["direction"]
                entry_price = active_trade["entry_price"]
                stop_price = active_trade["stop_price"]
                target_price = active_trade["target_price"]

                if direction == "Buy":
                    hit_stop = bar["low"] <= stop_price
                    hit_target = bar["high"] >= target_price
                    if hit_stop or hit_target:
                        exit_price = stop_price if hit_stop else target_price
                        profit_points = exit_price - entry_price
                        profit_bricks = profit_points / range_size
                        daily_net_profit += profit_bricks
                        trades.append({
                            **active_trade,
                            "exit_time": bar["time"],
                            "exit_barIndex": index,
                            "exit_price": exit_price,
                            "result": "Stop" if hit_stop else "Target",
                            "profit_points": profit_points,
                            "profit_bricks": profit_bricks,
                        })
                        active_trade = None
                else:
                    hit_stop = bar["high"] >= stop_price
                    hit_target = bar["low"] <= target_price
                    if hit_stop or hit_target:
                        exit_price = stop_price if hit_stop else target_price
                        profit_points = entry_price - exit_price
                        profit_bricks = profit_points / range_size
                        daily_net_profit += profit_bricks
                        trades.append({
                            **active_trade,
                            "exit_time": bar["time"],
                            "exit_barIndex": index,
                            "exit_price": exit_price,
                            "result": "Stop" if hit_stop else "Target",
                            "profit_points": profit_points,
                            "profit_bricks": profit_bricks,
                        })
                        active_trade = None

            if active_trade is not None or time > end_time:
                continue
            signal = day_signal_by_index.get(index)
            if not signal:
                continue

            direction = signal["action"]
            entry_price = bar["close"]
            if direction == "Buy":
                stop_price = entry_price - range_size
                target_price = entry_price + range_size
            else:
                stop_price = entry_price + range_size
                target_price = entry_price - range_size

            active_trade = {
                "campaign": campaign_name,
                "entry_time": bar["time"],
                "entry_barIndex": index,
                "direction": direction,
                "entry_price": entry_price,
                "stop_price": stop_price,
                "target_price": target_price,
                "stop_distance_points": range_size,
                "stop_distance_bricks": 1.0,
                "bounce_type": "yellow",
            }

        if active_trade is not None:
            last_index = date_to_bar_indices[date][-1]
            last_bar = data[last_index]
            if active_trade["direction"] == "Buy":
                profit_points = last_bar["close"] - active_trade["entry_price"]
            else:
                profit_points = active_trade["entry_price"] - last_bar["close"]
            profit_bricks = profit_points / range_size
            daily_net_profit += profit_bricks
            trades.append({
                **active_trade,
                "exit_time": last_bar["time"],
                "exit_barIndex": last_index,
                "exit_price": last_bar["close"],
                "result": "EndSession",
                "profit_points": profit_points,
                "profit_bricks": profit_bricks,
            })

        daily_reports.append({
            "date": date,
            "net_profit_bricks": daily_net_profit,
            "result": "Win" if daily_net_profit > 0 else "Loss/Flat",
            "success_time": None,
            "trades_count": len(trades),
            "trades": trades,
            "skipped_trades": [],
        })

    result = summarize_campaign(daily_reports, 1.0, "yellow_momentum_1_to_1")
    result["name"] = campaign_name
    result["rules"] = {
        "entry": "Close of yellow momentum signal bar",
        "stop": "One range against entry",
        "target": "One range in favor",
        "range_size": range_size,
        "tick_size": tick_size,
    }
    return result

def build_yellow_momentum_outcome_cache(data, config):
    range_size = infer_range_size(data)
    date_to_bar_indices = {}
    for index, bar in enumerate(data):
        date = bar["time"].split("T")[0]
        date_to_bar_indices.setdefault(date, []).append(index)

    outcome_cache = {}
    for _, indices in date_to_bar_indices.items():
        last_index = indices[-1]
        last_bar = data[last_index]
        for position, index in enumerate(indices):
            bar = data[index]
            for direction in ("Buy", "Sell"):
                entry_price = bar["close"]
                if direction == "Buy":
                    stop_price = entry_price - range_size
                    target_price = entry_price + range_size
                else:
                    stop_price = entry_price + range_size
                    target_price = entry_price - range_size

                exit_index = last_index
                exit_price = last_bar["close"]
                result = "EndSession"
                for future_index in indices[position + 1:]:
                    future_bar = data[future_index]
                    if direction == "Buy":
                        hit_stop = future_bar["low"] <= stop_price
                        hit_target = future_bar["high"] >= target_price
                        if hit_stop or hit_target:
                            exit_index = future_index
                            exit_price = stop_price if hit_stop else target_price
                            result = "Stop" if hit_stop else "Target"
                            break
                    else:
                        hit_stop = future_bar["high"] >= stop_price
                        hit_target = future_bar["low"] <= target_price
                        if hit_stop or hit_target:
                            exit_index = future_index
                            exit_price = stop_price if hit_stop else target_price
                            result = "Stop" if hit_stop else "Target"
                            break

                profit_points = (
                    exit_price - entry_price
                    if direction == "Buy"
                    else entry_price - exit_price
                )
                outcome_cache[(index, direction)] = {
                    "campaign": "Yellow Momentum 1:1",
                    "entry_time": bar["time"],
                    "entry_barIndex": index,
                    "direction": direction,
                    "entry_price": entry_price,
                    "stop_price": stop_price,
                    "target_price": target_price,
                    "stop_distance_points": range_size,
                    "stop_distance_bricks": 1.0,
                    "bounce_type": "yellow",
                    "exit_time": data[exit_index]["time"],
                    "exit_barIndex": exit_index,
                    "exit_price": exit_price,
                    "result": result,
                    "profit_points": profit_points,
                    "profit_bricks": profit_points / range_size,
                }

    return outcome_cache

def run_yellow_momentum_campaign_from_cache(data, signal_details, config, outcome_cache, rules=None):
    start_time = config.get("start_time", "06:31:00")
    end_time = config.get("end_time", "11:00:00")
    date_to_signals = {}
    for signal in signal_details:
        date, time = signal["timestamp"].split("T")
        time = time.replace("Z", "")
        if start_time <= time <= end_time:
            date_to_signals.setdefault(date, []).append(signal)

    daily_reports = []
    for date in sorted(date_to_signals):
        active_until_index = -1
        daily_net_profit = 0.0
        trades = []
        for signal in sorted(date_to_signals[date], key=lambda item: item["barIndex"]):
            if signal["barIndex"] <= active_until_index:
                continue
            trade = outcome_cache.get((signal["barIndex"], signal["action"]))
            if not trade:
                continue
            trade = trade.copy()
            trades.append(trade)
            daily_net_profit += trade["profit_bricks"]
            active_until_index = trade["exit_barIndex"]

        daily_reports.append({
            "date": date,
            "net_profit_bricks": daily_net_profit,
            "result": "Win" if daily_net_profit > 0 else "Loss/Flat",
            "success_time": None,
            "trades_count": len(trades),
            "trades": trades,
            "skipped_trades": [],
        })

    result = summarize_campaign(daily_reports, 1.0, "yellow_momentum_1_to_1")
    result["name"] = "Yellow Momentum 1:1"
    result["rules"] = rules or {
        "entry": "Close of yellow momentum signal bar",
        "stop": "One range against entry",
        "target": "One range in favor",
        "range_size": infer_range_size(data),
        "tick_size": infer_price_increment(data),
    }
    return result

def analyze_alignment(signals, annotations, data):
    # Map raw data timestamp to bar details for easy retrieval
    data_map = {d["time"]: d for d in data}
    
    matches = []
    false_negatives = [] # User annotated, backtester missed
    false_positives = [] # Backtester triggered, user labeled Skip (or didn't label)
    
    # Check user annotations
    for ann in annotations:
        t = ann["timestamp"]
        user_action = ann["action"]
        system_action = signals.get(t)
        
        bar = data_map.get(t, {})
        ema_val = bar.get("ema")
        
        # Calculate slope at annotation timestamp
        slope = None
        try:
            idx = data.index(bar)
            if idx >= 3:
                slope = data[idx]["ema"] - data[idx - 3]["ema"]
        except Exception:
            pass
            
        metrics = {
            "timestamp": t,
            "user_action": user_action,
            "system_action": system_action,
            "close": bar.get("close"),
            "ema": ema_val,
            "slope": slope,
            "open": bar.get("open"),
            "high": bar.get("high"),
            "low": bar.get("low"),
            "comment": ann.get("comment", "")
        }

        if user_action in ["Buy", "Sell"]:
            if system_action == user_action:
                matches.append(metrics)
            else:
                false_negatives.append(metrics)
        elif user_action == "Skip":
            if system_action is not None:
                false_positives.append(metrics)

    return matches, false_negatives, false_positives

def print_report(chart_name, signals, evaluations, matches, false_negatives, false_positives, config, campaign_results=None):
    print("=" * 60)
    print(f" RENKO BACKTEST & ALIGNMENT REPORT: {chart_name}")
    print("=" * 60)
    
    # 1. Config parameters
    print("Math Settings Applied:")
    for k, v in config.items():
        print(f"  - {k}: {v}")
    print("-" * 60)

    # 2. Performance Summary
    passed = [item for item in evaluations if item["result"] == "Pass"]
    failed = [item for item in evaluations if item["result"] == "Fail"]
    pending = [item for item in evaluations if item["result"] == "Pending"]
    resolved = len(passed) + len(failed)
    pass_rate = (len(passed) / resolved * 100) if resolved > 0 else 0
    
    print("Signal Quality Performance:")
    print(f"  - Total Signals: {len(evaluations)}")
    print(f"  - Passed: {len(passed)} | Failed: {len(failed)} | Pending: {len(pending)}")
    print(f"  - Signal Pass Rate: {pass_rate:.2f}%")
    print("-" * 60)

    # 3. Alignment Summary
    print("AI Alignment with Your Eye:")
    total_labeled = len(matches) + len(false_negatives)
    alignment_rate = (len(matches) / total_labeled * 100) if total_labeled > 0 else 0
    
    print(f"  - Labeled Entries Matched: {len(matches)} / {total_labeled} ({alignment_rate:.2f}%)")
    print(f"  - False Negatives (Missed): {len(false_negatives)}")
    print(f"  - False Positives (Skipped): {len(false_positives)}")
    print("-" * 60)

    # 4. Discrepancy Breakdown
    if false_negatives:
        print("\n[!] False Negatives - Strategy missed these trades you marked:")
        for fn in false_negatives:
            print(f"  * Time: {fn['timestamp']}")
            print(f"    - Your label: {fn['user_action']}")
            print(f"    - Brick values: Open={fn['open']}, High={fn['high']}, Low={fn['low']}, Close={fn['close']}")
            print(f"    - EMA values:   EMA={fn['ema']:.2f}, Slope={fn['slope']:.2f} (threshold is {config['ema_slope_threshold']})")
            if fn['comment']:
                print(f"    - Your note:    \"{fn['comment']}\"")
            print()

    if false_positives:
        print("\n[!] False Positives - Strategy entered, but you labeled as skip:")
        for fp in false_positives:
            print(f"  * Time: {fp['timestamp']}")
            print(f"    - System entered: {fp['system_action']}")
            print(f"    - Brick values:  Open={fp['open']}, High={fp['high']}, Low={fp['low']}, Close={fp['close']}")
            print(f"    - EMA values:    EMA={fp['ema']:.2f}, Slope={fp['slope']:.2f}")
            if fp['comment']:
                print(f"    - Your note:     \"{fp['comment']}\"")
            print()
    print("-" * 60)

    if campaign_results:
        summary = campaign_results["summary"]
        print("Daily Session Campaign (Option B):")
        print(f"  - Exit Strategy Mode: {campaign_results.get('exit_strategy', 'fixed').upper()}")
        print(f"  - Total Trading Days: {summary['total_days']}")
        target_val = summary.get("target_bricks", 2.0)
        print(f"  - Winning Days (+{target_val} bricks target): {summary['winning_days']} ({summary['win_rate']:.2f}%)")
        print(f"  - Losing/Flat Days: {summary['losing_days']}")
        print(f"  - Average Time to Success: {summary['avg_success_time']}")
        print(f"  - Max Daily Drawdown: {summary['max_drawdown_bricks']:.2f} bricks")
    
    print("=" * 60)

def run_optimization(data, annotations):
    if not annotations:
        return DEFAULT_CONFIG.copy()
        
    best_config = DEFAULT_CONFIG.copy()
    best_f1 = -1.0
    
    # Grid search parameters centered around typical values for 15pt Renko
    slope_thresholds = [1.0, 2.0, 5.0, 10.0, 15.0, 20.0, 30.0, 40.0]
    wick_lengths = [5.0, 10.0, 15.0, 20.0, 25.0]
    max_ema_distances = [15.0, 20.0, 30.0, 40.0, 50.0, 60.0]
    retest_tolerances = [2.0, 5.0, 10.0, 15.0, 21.0, 25.0]
    
    for slope in slope_thresholds:
        for wick in wick_lengths:
            for dist in max_ema_distances:
                for tol in retest_tolerances:
                    cfg = DEFAULT_CONFIG.copy()
                    cfg["ema_slope_threshold"] = slope
                    cfg["min_wick_length"] = wick
                    cfg["max_ema_distance"] = dist
                    cfg["wick_retest_tolerance"] = tol
                    
                    signals, _, _ = run_strategy(data, cfg)
                    matches, false_negatives, false_positives = analyze_alignment(signals, annotations, data)
                    
                    tp = len(matches)
                    fn = len(false_negatives)
                    fp = len(false_positives)
                    
                    if tp == 0:
                        f1 = 0.0
                    else:
                        precision = tp / (tp + fp)
                        recall = tp / (tp + fn)
                        f1 = 2 * (precision * recall) / (precision + recall)
                        
                    # Choose configuration that maximizes F1 alignment score
                    if f1 > best_f1:
                        best_f1 = f1
                        best_config = cfg
                    elif f1 == best_f1 and f1 > 0:
                        # Tie-breaker: prefer smaller max_ema_distance to avoid chasing entries
                        if cfg["max_ema_distance"] < best_config["max_ema_distance"]:
                            best_config = cfg
                            
    return best_config

def yellow_momentum_config_slice(config):
    keys = [
        "yellow_momentum_slope_period",
        "yellow_momentum_fast_slope_threshold",
        "yellow_momentum_slow_slope_threshold",
        "yellow_momentum_min_ema_gap",
        "yellow_momentum_min_penetration",
        "yellow_momentum_min_tail",
        "yellow_momentum_arity_lookback",
        "yellow_momentum_max_overlap",
        "yellow_momentum_max_reversals",
    ]
    return {key: config[key] for key in keys}

def score_yellow_momentum_candidate(campaign_results, signal_count, min_trades):
    summary = campaign_results.get("summary", {})
    trades = summary.get("total_trades", 0)
    net = summary.get("net_profit_bricks", 0.0)
    win_rate = summary.get("trade_win_rate", 0.0) / 100.0
    max_drawdown = abs(summary.get("max_drawdown_bricks", 0.0))
    too_few_trades_penalty = max(0, min_trades - trades) * 2.5
    too_many_signals_penalty = max(0, signal_count - 45) * 0.02

    return (
        net +
        win_rate * 1.5 +
        min(trades, 12) * 0.05 -
        max_drawdown * 0.75 -
        too_few_trades_penalty -
        too_many_signals_penalty
    )

def run_yellow_momentum_optimization(data, base_config):
    min_trades = 4
    search_space = {
        "yellow_momentum_slope_period": [6, 8, 10],
        "yellow_momentum_fast_slope_threshold": [24.0, 30.0, 36.0],
        "yellow_momentum_slow_slope_threshold": [18.0, 24.0, 30.0],
        "yellow_momentum_min_ema_gap": [2.0, 4.0, 6.0, 8.0],
        "yellow_momentum_min_penetration": [0.5, 1.5, 2.5],
        "yellow_momentum_min_tail": [1.0, 2.0, 3.0],
        "yellow_momentum_arity_lookback": [6, 8, 10],
        "yellow_momentum_max_overlap": [0.65, 0.95, 1.15],
        "yellow_momentum_max_reversals": [2, 3, 5],
    }

    keys = list(search_space.keys())
    arity_cache = precompute_arity_metrics(data, search_space["yellow_momentum_arity_lookback"])
    feature_cache = build_yellow_momentum_feature_cache(
        data,
        search_space["yellow_momentum_slope_period"],
        search_space["yellow_momentum_arity_lookback"],
        arity_cache
    )
    outcome_cache = build_yellow_momentum_outcome_cache(data, base_config)
    campaign_rules = {
        "entry": "Close of yellow momentum signal bar",
        "stop": "One range against entry",
        "target": "One range in favor",
        "range_size": infer_range_size(data),
        "tick_size": infer_price_increment(data),
    }
    top_results = []
    tested_configs = 0
    qualified_configs = 0

    for values in product(*(search_space[key] for key in keys)):
        cfg = base_config.copy()
        cfg.update(dict(zip(keys, values)))
        if cfg["yellow_momentum_slow_slope_threshold"] > cfg["yellow_momentum_fast_slope_threshold"]:
            continue

        tested_configs += 1
        features = feature_cache[(cfg["yellow_momentum_slope_period"], cfg["yellow_momentum_arity_lookback"])]
        signal_details = filter_yellow_momentum_features(features, cfg)
        campaign_results = run_yellow_momentum_campaign_from_cache(data, signal_details, cfg, outcome_cache, campaign_rules)
        summary = campaign_results.get("summary", {})
        trades = summary.get("total_trades", 0)
        if trades >= min_trades:
            qualified_configs += 1

        score = score_yellow_momentum_candidate(campaign_results, len(signal_details), min_trades)
        candidate = {
            "score": score,
            "signal_count": len(signal_details),
            "config": yellow_momentum_config_slice(cfg),
            "summary": summary,
        }
        top_results.append(candidate)
        top_results.sort(key=lambda item: item["score"], reverse=True)
        top_results = top_results[:15]

    best = top_results[0] if top_results else None
    best_config = base_config.copy()
    if best:
        best_config.update(best["config"])
    best_features = feature_cache[(best_config["yellow_momentum_slope_period"], best_config["yellow_momentum_arity_lookback"])]
    best_signal_details = filter_yellow_momentum_features(best_features, best_config)
    best_campaign_results = run_yellow_momentum_campaign_from_cache(data, best_signal_details, best_config, outcome_cache, campaign_rules)

    return {
        "objective": "Maximize Yellow Momentum 1:1 net ranges with penalties for too few trades, drawdown, and noisy signal count.",
        "min_trades": min_trades,
        "tested_configs": tested_configs,
        "qualified_configs": qualified_configs,
        "search_space": search_space,
        "best_config": yellow_momentum_config_slice(best_config),
        "best_summary": best_campaign_results.get("summary", {}),
        "best_rules": best_campaign_results.get("rules", {}),
        "best_signal_count": len(best_signal_details),
        "top_results": top_results,
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Renko Strategy Backtester & Annotation Alignment Engine")
    parser.add_argument("--chart", required=True, help="Name of the chart file inside data/ (without .json)")
    
    # Allow overriding strategy config from CLI
    parser.add_argument("--slope-threshold", type=float, help="Override EMA slope threshold")
    parser.add_argument("--retest-tolerance", type=float, help="Override wick retest tolerance")
    parser.add_argument("--min-wick", type=float, help="Override minimum wick length")
    parser.add_argument("--max-ema-dist", type=float, help="Override maximum EMA distance (proximity)")
    parser.add_argument("--cooldown-bars", type=int, help="Override time cool-down in bars")
    parser.add_argument("--wick-body-offset", type=int, help="Override wick body open offset in ticks (positive=deeper, negative=shallower)")
    parser.add_argument("--exit-strategy", choices=["fixed", "trail", "stepup", "fixed2"], default="fixed", help="Exit strategy for daily campaign ('fixed' target, 'trail' to opposite brick, 'stepup' on loss, or 'fixed2' optimized target)")
    parser.add_argument("--start-time", default="06:31:00", help="Start time of daily trading session (PST, HH:MM:SS)")
    parser.add_argument("--end-time", default="11:00:00", help="End time of daily trading session (PST, HH:MM:SS)")
    parser.add_argument("--arid-lookback", type=int, help="Signal Set 2 lookback in bricks")
    parser.add_argument("--arid-max-overlap", type=float, help="Signal Set 2 maximum average wick overlap in bricks")
    parser.add_argument("--arid-max-reversals", type=int, help="Signal Set 2 maximum direction reversals in the lookback")
    parser.add_argument("--arid-slope-threshold", type=float, help="Signal Set 2 minimum EMA change over its slope period")
    parser.add_argument("--arid-min-gap", type=float, help="Signal Set 2 minimum full-wick distance from EMA in bricks")
    parser.add_argument("--bounce-type", choices=["all", "yellow", "green"], default="all", help="Signal Set 2 bounce type filter")
    parser.add_argument("--set3-left-lookback", type=int, help="Signal Set 3 bars inspected for left-side congestion")
    parser.add_argument("--set3-max-left-overlaps", type=int, help="Signal Set 3 maximum older bodies overlapping the setup")
    parser.add_argument("--set3-slope-threshold", type=float, help="Signal Set 3 minimum EMA change over its slope period")
    parser.add_argument("--set3-min-gap", type=float, help="Signal Set 3 minimum body distance from EMA in bricks")
    parser.add_argument("--set3-synthetic-min-gap", type=float, help="Signal Set 3 minimum synthetic pullback distance from EMA in bricks")
    parser.add_argument("--yellow-slope-period", type=int, help="Yellow Momentum EMA slope lookback in bars")
    parser.add_argument("--yellow-fast-slope", type=float, help="Yellow Momentum minimum 5 EMA change over slope period")
    parser.add_argument("--yellow-slow-slope", type=float, help="Yellow Momentum minimum 10 EMA change over slope period")
    parser.add_argument("--yellow-min-gap", type=float, help="Yellow Momentum minimum separation between 5 EMA and 10 EMA")
    parser.add_argument("--yellow-min-penetration", type=float, help="Yellow Momentum minimum yellow EMA penetration by the tail")
    parser.add_argument("--yellow-min-tail", type=float, help="Yellow Momentum minimum rejection tail length")
    parser.add_argument("--yellow-arity-lookback", type=int, help="Yellow Momentum arity lookback in bars")
    parser.add_argument("--yellow-max-overlap", type=float, help="Yellow Momentum maximum average recent overlap")
    parser.add_argument("--yellow-max-reversals", type=int, help="Yellow Momentum maximum recent direction reversals")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")
    parser.add_argument("--optimize", action="store_true", help="Run parameter optimization sweep")
    parser.add_argument("--optimize-yellow-momentum", action="store_true", help="Run Yellow Momentum 1:1 parameter optimization sweep")
    parser.add_argument("--experiment-mes-reg5-quarantine", action="store_true", help="Run MES Reg5 paper-trade quarantine experiments")
    
    args = parser.parse_args()
 
    # Build active config
    config = DEFAULT_CONFIG.copy()
    if args.slope_threshold is not None:
        config["ema_slope_threshold"] = args.slope_threshold
    if args.retest_tolerance is not None:
        config["wick_retest_tolerance"] = args.retest_tolerance
    if args.min_wick is not None:
        config["min_wick_length"] = args.min_wick
    if args.max_ema_dist is not None:
        config["max_ema_distance"] = args.max_ema_dist
    if args.cooldown_bars is not None:
        config["cooldown_bars"] = args.cooldown_bars
    if args.wick_body_offset is not None:
        config["wick_body_offset_ticks"] = args.wick_body_offset
    if args.start_time is not None:
        config["start_time"] = args.start_time
    if args.end_time is not None:
        config["end_time"] = args.end_time
    if args.arid_lookback is not None:
        config["arid_lookback"] = args.arid_lookback
    if args.arid_max_overlap is not None:
        config["arid_max_overlap_bricks"] = args.arid_max_overlap
    if args.arid_max_reversals is not None:
        config["arid_max_reversals"] = args.arid_max_reversals
    if args.arid_slope_threshold is not None:
        config["arid_ema_slope_threshold"] = args.arid_slope_threshold
    if args.arid_min_gap is not None:
        config["arid_min_ema_gap_bricks"] = args.arid_min_gap
    config["bounce_type_filter"] = args.bounce_type
    if args.set3_left_lookback is not None:
        config["set3_left_lookback"] = args.set3_left_lookback
    if args.set3_max_left_overlaps is not None:
        config["set3_max_left_overlaps"] = args.set3_max_left_overlaps
    if args.set3_slope_threshold is not None:
        config["set3_ema_slope_threshold"] = args.set3_slope_threshold
    if args.set3_min_gap is not None:
        config["set3_min_ema_gap_bricks"] = args.set3_min_gap
    if args.set3_synthetic_min_gap is not None:
        config["set3_synthetic_min_ema_gap_bricks"] = args.set3_synthetic_min_gap
    if args.yellow_slope_period is not None:
        config["yellow_momentum_slope_period"] = args.yellow_slope_period
    if args.yellow_fast_slope is not None:
        config["yellow_momentum_fast_slope_threshold"] = args.yellow_fast_slope
    if args.yellow_slow_slope is not None:
        config["yellow_momentum_slow_slope_threshold"] = args.yellow_slow_slope
    if args.yellow_min_gap is not None:
        config["yellow_momentum_min_ema_gap"] = args.yellow_min_gap
    if args.yellow_min_penetration is not None:
        config["yellow_momentum_min_penetration"] = args.yellow_min_penetration
    if args.yellow_min_tail is not None:
        config["yellow_momentum_min_tail"] = args.yellow_min_tail
    if args.yellow_arity_lookback is not None:
        config["yellow_momentum_arity_lookback"] = args.yellow_arity_lookback
    if args.yellow_max_overlap is not None:
        config["yellow_momentum_max_overlap"] = args.yellow_max_overlap
    if args.yellow_max_reversals is not None:
        config["yellow_momentum_max_reversals"] = args.yellow_max_reversals

    config["chart_name"] = args.chart

    project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    chart_path = os.path.join(project_dir, "data", f"{args.chart}.json")
    annotations_path = os.path.join(project_dir, "data", "annotations.json")

    try:
        data = load_json_data(chart_path)
        annotations = load_annotations(annotations_path, args.chart)
        ha_data = []
        ha_path = os.path.join(project_dir, "data", "MES_2sec_HA.json")
        if args.chart in ("MES3", "MESM_reg_5") and os.path.exists(ha_path):
            ha_data = load_json_data(ha_path)
        
        if args.optimize:
            best_config = run_optimization(data, annotations)
            print(json.dumps(best_config, indent=2))
            import sys
            sys.exit(0)
        if args.optimize_yellow_momentum:
            optimization_results = run_yellow_momentum_optimization(data, config)
            print(json.dumps(optimization_results, indent=2))
            import sys
            sys.exit(0)
            
        signals, signal_details, signal_evaluations = run_strategy(data, config)
        signal_set_2_details, signal_set_2_evaluations = run_ema_bounce_strategy(data, config)
        signal_set_3_details, signal_set_3_evaluations, arid_e_trades = run_no_tail_arity_strategy(data, config)
        yellow_momentum_details, yellow_momentum_evaluations = run_yellow_momentum_strategy(data, config)
        mes3_trend_tail_details, mes3_trend_tail_evaluations = run_mes3_trend_tail_strategy(data, config)
        mes3_previous_tail_details, mes3_previous_tail_evaluations = run_mes3_previous_tail_rejection_strategy(data, config)
        mes3_ha_ema_approach_details = run_mes3_ha_ema_approach_strategy(data, ha_data, config)
        mes_mes3_trend_tail_details = []  # wait, not needed, keep it clean
        mes_reg5_long_tail_details, mes_reg5_long_tail_evaluations = run_mes_reg5_long_tail_strategy(data, config)
        mes_reg5_ema_bounce_arity_details, mes_reg5_ema_bounce_arity_evaluations = run_mes_reg5_ema_bounce_arity_strategy(data, config)
        mes_reg5_pin_bar_breakout_details, mes_reg5_pin_bar_breakout_evaluations = run_mes_reg5_pin_bar_breakout_strategy(data, config)
        if args.experiment_mes_reg5_quarantine:
            experiment_results = run_mes_reg5_quarantine_experiments(
                data,
                mes_reg5_ema_bounce_arity_details,
                config,
            )
            print(json.dumps(experiment_results, indent=2))
            import sys
            sys.exit(0)
        matches, false_negatives, false_positives = analyze_alignment(signals, annotations, data)
        campaign_results = run_daily_campaign(data, signal_details, config, exit_strategy=args.exit_strategy)
        ema_bounce_campaign_results = run_ema_bounce_campaign(data, signal_set_2_details, config)
        yellow_momentum_campaign_results = run_yellow_momentum_campaign(data, yellow_momentum_details, config)
        mes_reg5_daily_recovery_campaign_results = run_mes_reg5_daily_recovery_campaign(
            data,
            mes_reg5_ema_bounce_arity_details,
            config,
        )
        
        if args.json:
            result = {
                "signals": signals,
                "signal_details": signal_details,
                "signal_evaluations": signal_evaluations,
                "signal_set_2_details": signal_set_2_details,
                "signal_set_2_evaluations": signal_set_2_evaluations,
                "signal_set_3_details": signal_set_3_details,
                "signal_set_3_evaluations": signal_set_3_evaluations,
                "arid_e_trades": arid_e_trades,
                "yellow_momentum_details": yellow_momentum_details,
                "yellow_momentum_evaluations": yellow_momentum_evaluations,
                "mes3_trend_tail_details": mes3_trend_tail_details,
                "mes3_trend_tail_evaluations": mes3_trend_tail_evaluations,
                "mes3_previous_tail_details": mes3_previous_tail_details,
                "mes3_previous_tail_evaluations": mes3_previous_tail_evaluations,
                "mes3_ha_ema_approach_details": mes3_ha_ema_approach_details,
                "mes_reg5_long_tail_details": mes_reg5_long_tail_details,
                "mes_reg5_long_tail_evaluations": mes_reg5_long_tail_evaluations,
                "mes_reg5_ema_bounce_arity_details": mes_reg5_ema_bounce_arity_details,
                "mes_reg5_ema_bounce_arity_evaluations": mes_reg5_ema_bounce_arity_evaluations,
                "mes_reg5_pin_bar_breakout_details": mes_reg5_pin_bar_breakout_details,
                "mes_reg5_pin_bar_breakout_evaluations": mes_reg5_pin_bar_breakout_evaluations,
                "campaign_results": campaign_results,
                "ema_bounce_campaign_results": ema_bounce_campaign_results,
                "yellow_momentum_campaign_results": yellow_momentum_campaign_results,
                "mes_reg5_daily_recovery_campaign_results": mes_reg5_daily_recovery_campaign_results,
                "config": config,
                "alignment": {
                    "matches_count": len(matches),
                    "false_negatives_count": len(false_negatives),
                    "false_positives_count": len(false_positives)
                }
            }
            print(json.dumps(result, indent=2))
        else:
            print_report(
                args.chart,
                signals,
                signal_evaluations,
                matches,
                false_negatives,
                false_positives,
                config,
                campaign_results
            )
        
    except Exception as e:
        import sys
        if args.json or args.optimize:
            print(json.dumps({"error": str(e)}))
            sys.exit(1)
        else:
            print(f"Error: {e}")
            sys.exit(1)
