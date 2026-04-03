from __future__ import annotations

import logging

import numpy as np

from ..angle_utils import calculate_angle
from ..pushup_posture import validate_pushup_posture
from ..rep_cycle_tracker import RepCycleTracker
from .base_exercise import BaseExercise

logger = logging.getLogger(__name__)


class PushUp(BaseExercise):
    """
    Push-up reps only when:
    - Full-body plank posture passes validate_pushup_posture (strict).
    - Raw elbow angle completes a down (<= bottom) then up (>= top) cycle (RepCycleTracker).
    Head is not used for counting; wrists must align with supporting posture.
    """

    TOP_ANGLE = 158
    BOTTOM_ANGLE = 132
    COOLDOWN_FRAMES = 6
    MAX_ANGLE_HISTORY = 5

    def __init__(self):
        super().__init__()
        self.angle_history: list[float] = []
        self.direction: str | None = None
        self._rep = RepCycleTracker(
            self.TOP_ANGLE, self.BOTTOM_ANGLE, self.COOLDOWN_FRAMES
        )
        self.last_pose_valid: bool = False
        self.last_pose_reason: str = "init"
        self.bottom_reached: bool = False
        self._last_debug_reason: str | None = None

    @staticmethod
    def _visible(landmark, threshold: float = 0.5) -> bool:
        return getattr(landmark, "visibility", 1.0) > threshold

    def smooth_angle(self, angle: float) -> float:
        self.angle_history.append(angle)
        if len(self.angle_history) > self.MAX_ANGLE_HISTORY:
            self.angle_history = self.angle_history[-self.MAX_ANGLE_HISTORY :]
        return float(np.mean(self.angle_history))

    def _arm_angle(self, landmarks, shoulder_i: int, elbow_i: int, wrist_i: int) -> float | None:
        s, e, w = landmarks[shoulder_i], landmarks[elbow_i], landmarks[wrist_i]
        if not (self._visible(s) and self._visible(e) and self._visible(w)):
            return None
        return calculate_angle([s.x, s.y], [e.x, e.y], [w.x, w.y])

    def _elbow_angle(self, landmarks) -> float:
        angles: list[float] = []
        left = self._arm_angle(landmarks, 11, 13, 15)
        right = self._arm_angle(landmarks, 12, 14, 16)
        if left is not None:
            angles.append(left)
        if right is not None:
            angles.append(right)
        if angles:
            return float(np.mean(angles))
        return calculate_angle(
            [landmarks[11].x, landmarks[11].y],
            [landmarks[13].x, landmarks[13].y],
            [landmarks[15].x, landmarks[15].y],
        )

    def _log_pose_gate(self, reason: str, *, rep_blocked: bool = False) -> None:
        if reason == self._last_debug_reason:
            return
        self._last_debug_reason = reason
        if reason == "ok":
            logger.debug("pushup: posture valid — rep counting enabled")
        else:
            extra = " (rep cycle reset)" if rep_blocked else ""
            logger.debug("pushup: reps not counted — %s%s", reason, extra)

    def update(self, landmarks):
        raw = self._elbow_angle(landmarks)
        angle_smooth = self.smooth_angle(raw)

        pose_ok, reason = validate_pushup_posture(landmarks)
        self.last_pose_valid = pose_ok
        self.last_pose_reason = reason

        if not pose_ok:
            self._rep.invalidate()
            self.bottom_reached = False
            self._log_pose_gate(reason, rep_blocked=True)
            if angle_smooth < self.BOTTOM_ANGLE:
                self.direction = "up"
            elif angle_smooth > self.TOP_ANGLE:
                self.direction = "down"
            return self.counter, angle_smooth, self.direction, False

        self._log_pose_gate("ok")

        rep_completed = self._rep.step(raw)
        self.bottom_reached = self._rep.reached_bottom_depth()

        if rep_completed:
            self.counter += 1
            logger.debug(
                "pushup: rep %s counted — elbow extended after depth (bottom_reached cycle)",
                self.counter,
            )

        if angle_smooth < self.BOTTOM_ANGLE:
            self.direction = "up"
        elif angle_smooth > self.TOP_ANGLE:
            self.direction = "down"

        return self.counter, angle_smooth, self.direction, rep_completed
