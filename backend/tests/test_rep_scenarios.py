"""
Simulated workout streams (joint angles only) for push-up / squat rep counting.

Mirrors RepCycleTracker thresholds used in PushUp / Squat classes.
"""

from __future__ import annotations

import unittest

from ai_engine.rep_cycle_tracker import RepCycleTracker


def count_reps(angles: list[float], top: float, bottom: float, cooldown: int = 6) -> int:
    t = RepCycleTracker(top, bottom, cooldown)
    return sum(1 for a in angles if t.step(a))


def rep_flags(angles: list[float], top: float, bottom: float, cooldown: int = 6) -> list[bool]:
    t = RepCycleTracker(top, bottom, cooldown)
    return [t.step(a) for a in angles]


class TestRepCycleTrackerDepth(unittest.TestCase):
    def test_reached_bottom_depth(self):
        t = RepCycleTracker(158, 132, 6)
        self.assertFalse(t.reached_bottom_depth())
        for _ in range(3):
            t.step(160)
        t.step(120)
        self.assertTrue(t.reached_bottom_depth())


class TestPushupRepScenarios(unittest.TestCase):
    TOP = 158
    BOTTOM = 132
    CD = 6

    def test_partial_shallow_never_counts(self):
        """User bounces mid-range without reaching depth."""
        angles = [162, 145, 162, 138, 162, 140, 162]
        self.assertEqual(
            count_reps(angles, self.TOP, self.BOTTOM, self.CD),
            0,
            "Shallow partials should not register reps",
        )

    def test_slow_controlled_rep(self):
        """Many intermediate angles, one full cycle."""
        angles = [162, 155, 145, 130, 115, 105, 120, 135, 150, 162]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 1)

    def test_fast_rep_skipping_smoothed_bottom(self):
        """Only top → deep → top; trough must capture deep angle between sparse samples."""
        angles = [162, 95, 162]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 1)

    def test_two_fast_reps_with_cooldown_padding(self):
        """Second rep only after cooldown frames (simulating extended hold at top)."""
        pad = [161] * self.CD
        angles = [162, 92, 162, *pad, 94, 162]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 2)

    def test_two_reps_produce_two_completion_pulses(self):
        pad = [161] * self.CD
        angles = [162, 95, 162, *pad, 94, 162]
        flags = rep_flags(angles, self.TOP, self.BOTTOM, self.CD)
        self.assertEqual(sum(flags), 2)

    def test_three_fast_reps(self):
        pad = [161] * self.CD
        angles = [162, 90, 162, *pad, 93, 162, *pad, 91, 162]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 3)

    def test_exact_bottom_threshold_counts(self):
        angles = [162, 132, 162]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 1)

    def test_no_double_count_same_extension(self):
        """Stay at top without new descent — only one completion."""
        angles = [162, 100, 162, 162, 162, 162]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 1)

    def test_invalidate_clears_stale_depth(self):
        t = RepCycleTracker(self.TOP, self.BOTTOM, self.CD)
        self.assertFalse(t.step(162))
        self.assertFalse(t.step(100))
        t.invalidate()
        self.assertFalse(t.step(162))
        self.assertFalse(t.step(110))
        self.assertTrue(t.step(162))

    def test_start_mid_rep_still_counts_once_extended(self):
        """Camera starts in bottom position then user presses out."""
        angles = [110, 162]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 1)


class TestSquatRepScenarios(unittest.TestCase):
    TOP = 152
    BOTTOM = 98
    CD = 6

    def test_partial_squat_high_depth(self):
        angles = [155, 125, 155, 128, 155]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 0)

    def test_slow_full_squat(self):
        angles = [155, 140, 120, 100, 92, 105, 130, 150, 155]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 1)

    def test_fast_squat_rep(self):
        angles = [155, 90, 155]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 1)

    def test_two_squats_with_cooldown(self):
        pad = [154] * self.CD
        angles = [155, 95, 155, *pad, 96, 155]
        self.assertEqual(count_reps(angles, self.TOP, self.BOTTOM, self.CD), 2)


if __name__ == "__main__":
    unittest.main()
