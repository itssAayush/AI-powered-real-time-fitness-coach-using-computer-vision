from __future__ import annotations

import numpy as np

from ..angle_utils import calculate_angle
from ..rep_cycle_tracker import RepCycleTracker
from .base_exercise import BaseExercise


class Squat(BaseExercise):
    """Rep counting uses raw knee angle + RepCycleTracker (fast/slow/partial safe)."""

    TOP_ANGLE = 152
    BOTTOM_ANGLE = 98
    COOLDOWN_FRAMES = 6
    MAX_ANGLE_HISTORY = 5

    def __init__(self):
        super().__init__()
        self.angle_history: list[float] = []
        self.direction: str | None = None
        self._rep = RepCycleTracker(
            self.TOP_ANGLE, self.BOTTOM_ANGLE, self.COOLDOWN_FRAMES
        )

    def smooth_angle(self, angle: float) -> float:
        self.angle_history.append(angle)
        if len(self.angle_history) > self.MAX_ANGLE_HISTORY:
            self.angle_history = self.angle_history[-self.MAX_ANGLE_HISTORY :]
        return float(np.mean(self.angle_history))

    def landmark_visible(self, landmark, threshold: float = 0.5) -> bool:
        return getattr(landmark, "visibility", 1.0) > threshold

    def get_leg_angle(self, landmarks):
        candidate_angles = []
        leg_sets = (
            (23, 25, 27),
            (24, 26, 28),
        )

        for hip_idx, knee_idx, ankle_idx in leg_sets:
            hip = landmarks[hip_idx]
            knee = landmarks[knee_idx]
            ankle = landmarks[ankle_idx]

            if not all(
                self.landmark_visible(point) for point in (hip, knee, ankle)
            ):
                continue

            candidate_angles.append(
                calculate_angle(
                    [hip.x, hip.y],
                    [knee.x, knee.y],
                    [ankle.x, ankle.y],
                )
            )

        if candidate_angles:
            return float(np.mean(candidate_angles))

        for hip_idx, knee_idx, ankle_idx in leg_sets:
            hip = landmarks[hip_idx]
            knee = landmarks[knee_idx]
            ankle = landmarks[ankle_idx]
            if all(
                self.landmark_visible(point) for point in (hip, knee, ankle)
            ):
                return calculate_angle(
                    [hip.x, hip.y],
                    [knee.x, knee.y],
                    [ankle.x, ankle.y],
                )

        hip = [landmarks[24].x, landmarks[24].y]
        knee = [landmarks[26].x, landmarks[26].y]
        ankle = [landmarks[28].x, landmarks[28].y]
        return calculate_angle(hip, knee, ankle)

    def update(self, landmarks):
        raw = self.get_leg_angle(landmarks)
        angle_smooth = self.smooth_angle(raw)

        rep_completed = self._rep.step(raw)
        if rep_completed:
            self.counter += 1

        if angle_smooth < self.BOTTOM_ANGLE:
            self.direction = "up"
        elif angle_smooth > self.TOP_ANGLE:
            self.direction = "down"

        return self.counter, angle_smooth, self.direction, rep_completed
