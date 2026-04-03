"""
Rep counting FSM driven by raw (instant) joint angles — not smoothed.

Handles:
- Fast reps: min angle between frames is still captured in `trough`.
- Slow reps: same rules; smoothing only affects display elsewhere.
- Partial reps: must descend below `top_threshold` then reach `bottom_threshold`
  before extension counts; shallow pulses reset at the top without counting.

`eligible` is True after the user leaves the extended (top) zone, so we never
double-count a single extension or count before the first descent from session
start at the top.
"""

from __future__ import annotations


class RepCycleTracker:
    __slots__ = (
        "top_threshold",
        "bottom_threshold",
        "cooldown_frames",
        "cooldown",
        "trough",
        "eligible",
    )

    def __init__(self, top_threshold: float, bottom_threshold: float, cooldown_frames: int) -> None:
        self.top_threshold = top_threshold
        self.bottom_threshold = bottom_threshold
        self.cooldown_frames = max(0, int(cooldown_frames))
        self.cooldown = 0
        self.trough = float("inf")
        self.eligible = False

    def invalidate(self) -> None:
        self.trough = float("inf")
        self.eligible = False

    def step(self, raw_angle: float) -> bool:
        if self.cooldown > 0:
            self.cooldown -= 1

        if raw_angle < self.top_threshold:
            self.eligible = True
            self.trough = min(self.trough, raw_angle)
            return False

        # Extended (at or past lockout / standing)
        if (
            self.eligible
            and self.trough <= self.bottom_threshold
            and self.cooldown == 0
        ):
            self.cooldown = self.cooldown_frames
            self.trough = raw_angle
            self.eligible = False
            return True

        # Partial rep at top, or waiting out cooldown while extended: refresh
        # baseline only when safe (avoid wiping a valid trough during cooldown).
        if self.cooldown == 0 or self.trough > self.bottom_threshold:
            self.trough = raw_angle

        return False

    def reached_bottom_depth(self) -> bool:
        """True if the current cycle has gone at or past the depth threshold."""
        return self.trough <= self.bottom_threshold
