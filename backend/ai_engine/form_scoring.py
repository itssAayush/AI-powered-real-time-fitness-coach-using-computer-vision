"""
Heuristic form quality scores (0–100) from pose landmarks + primary joint angle.
Intended for coaching UX, not clinical assessment.
"""

from __future__ import annotations

import numpy as np

from .angle_utils import calculate_angle


def _vis(lm, threshold: float = 0.5) -> bool:
    return getattr(lm, "visibility", 1.0) > threshold


def _pushup_alignment_score(landmarks) -> float:
    ls, rs = landmarks[11], landmarks[12]
    lh, rh = landmarks[23], landmarks[24]
    if not all(_vis(x) for x in (ls, rs, lh, rh)):
        return 72.0
    sy = (ls.y + rs.y) / 2
    hy = (lh.y + rh.y) / 2
    gap = abs(sy - hy)
    return float(max(0.0, min(100.0, 100.0 * (1.0 - gap / 0.42))))


def _pushup_symmetry_score(landmarks) -> float:
    def arm_ang(si, ei, wi):
        s, e, w = landmarks[si], landmarks[ei], landmarks[wi]
        if not (_vis(s) and _vis(e) and _vis(w)):
            return None
        return calculate_angle([s.x, s.y], [e.x, e.y], [w.x, w.y])

    left = arm_ang(11, 13, 15)
    right = arm_ang(12, 14, 16)
    if left is None or right is None:
        return 78.0
    diff = abs(left - right)
    return float(max(0.0, 100.0 - diff * 2.5))


def _pushup_depth_extension_score(elbow_angle: float) -> float:
    if elbow_angle >= 158:
        return 70.0 + min(30.0, (elbow_angle - 158) * 2.0)
    if elbow_angle <= 120:
        return 55.0 + min(40.0, (120 - elbow_angle) * 1.1)
    if elbow_angle < 132:
        return 82.0 + (132 - elbow_angle) * 0.5
    return 75.0 + min(20.0, (158 - elbow_angle) * 0.8)


def score_pushup_form(landmarks, elbow_angle: float) -> int:
    parts = (
        _pushup_alignment_score(landmarks),
        _pushup_symmetry_score(landmarks),
        _pushup_depth_extension_score(elbow_angle),
    )
    return int(max(0, min(100, round(float(np.mean(parts))))))


def _squat_knee_tracking_score(landmarks) -> float:
    scores = []
    for hip_i, knee_i, ankle_i in ((23, 25, 27), (24, 26, 28)):
        hip, knee, ankle = landmarks[hip_i], landmarks[knee_i], landmarks[ankle_i]
        if not all(_vis(x) for x in (hip, knee, ankle)):
            continue
        horiz = abs(knee.x - ankle.x)
        scores.append(max(0.0, 100.0 - horiz * 420.0))
    return float(np.mean(scores)) if scores else 75.0


def _squat_depth_score(knee_angle: float) -> float:
    if knee_angle > 152:
        return 78.0
    if knee_angle < 85:
        return 70.0
    if knee_angle < 98:
        return 92.0
    if knee_angle < 120:
        return 88.0
    return 82.0


def score_squat_form(landmarks, knee_angle: float) -> int:
    parts = (_squat_knee_tracking_score(landmarks), _squat_depth_score(knee_angle))
    return int(max(0, min(100, round(float(np.mean(parts))))))


def compute_form_score(exercise_type: str, landmarks, angle: float | None) -> int | None:
    if landmarks is None or angle is None:
        return None
    if exercise_type == "pushup":
        return score_pushup_form(landmarks, float(angle))
    if exercise_type == "squat":
        return score_squat_form(landmarks, float(angle))
    return None
