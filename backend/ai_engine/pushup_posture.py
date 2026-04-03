"""
Strict 2D heuristics to reject non–push-up poses (standing, sitting, partial body).

Uses MediaPipe pose indices. y increases downward in normalized image space.
"""

from __future__ import annotations

from .angle_utils import calculate_angle

# Visibility — require a clear view of the full chain used for a real push-up
VIS_CORE = 0.62  # shoulders, hips
VIS_LIMB = 0.5  # elbows, wrists, knees
VIS_FOOT = 0.4  # ankles (slightly more lenient)

# Shoulders and hips level (horizontal trunk in frame)
SHOULDER_HIP_MAX_DELTA = 0.24

# Reject obvious upright torso: hips well below shoulders in image
MAX_HIP_BELOW_SHOULDER = 0.11  # hy - sy; above this → standing-like
MAX_SHOULDER_BELOW_HIP = 0.11  # sy - hy; headstand / bad crop

# Wrists should support near shoulders (reject disconnected / hand-only high)
WRIST_MIN_BELOW_SHOULDER = -0.06  # wy - sy must be > this (slightly above ok)

# Ankles should sit with lower body (reject floating feet / crop)
ANKLE_MIN_REL_HIP = -0.18  # ay - hy

# At least one leg extended (reject deep seated)
MIN_KNEE_ANGLE_EXTENDED = 132.0


def _v(lm) -> float:
    return float(getattr(lm, "visibility", 1.0))


def validate_pushup_posture(landmarks) -> tuple[bool, str]:
    """
    Returns (is_valid_pushup_plank, reason_code).
    reason_code is "ok" when valid; otherwise a stable machine string for logs/API.
    """
    ls, rs = landmarks[11], landmarks[12]
    lh, rh = landmarks[23], landmarks[24]
    le, re = landmarks[13], landmarks[14]
    lw, rw = landmarks[15], landmarks[16]
    lk, rk = landmarks[25], landmarks[26]
    la, ra = landmarks[27], landmarks[28]

    # --- 1) Full body visibility (core + arms + lower chain) ---
    if min(_v(ls), _v(rs)) < VIS_CORE:
        return False, "low_visibility_shoulders"
    if min(_v(lh), _v(rh)) < VIS_CORE:
        return False, "low_visibility_hips"
    if min(_v(le), _v(re)) < VIS_LIMB:
        return False, "low_visibility_elbows"
    if min(_v(lw), _v(rw)) < VIS_LIMB:
        return False, "low_visibility_wrists"

    if max(_v(la), _v(ra)) < VIS_FOOT:
        return False, "low_visibility_ankles"

    # --- 2) Horizontal shoulder–hip alignment (plank, not twisted torso) ---
    sy = (ls.y + rs.y) / 2
    hy = (lh.y + rh.y) / 2
    if abs(sy - hy) > SHOULDER_HIP_MAX_DELTA:
        return False, "shoulder_hip_not_level"

    # --- 3) Not vertical / standing (hips much lower than shoulders in frame) ---
    if hy - sy > MAX_HIP_BELOW_SHOULDER:
        return False, "torso_too_vertical_standing"
    if sy - hy > MAX_SHOULDER_BELOW_HIP:
        return False, "torso_inverted_or_bad_angle"

    # --- 4) Wrists near shoulder vertical band (supporting posture, not hands-only high) ---
    wy = (lw.y + rw.y) / 2
    if wy - sy < WRIST_MIN_BELOW_SHOULDER:
        return False, "wrists_not_supporting_shoulder_line"

    # --- 5) Ankles coherent with hips (full body in plank region) ---
    ay = (la.y + ra.y) / 2
    if ay - hy < ANKLE_MIN_REL_HIP:
        return False, "ankles_not_aligned_with_lower_body"

    # --- 6) At least one extended leg (reject seated / deep squat) ---
    def knee_angle(hip_i, knee_i, ankle_i):
        hip = landmarks[hip_i]
        knee = landmarks[knee_i]
        ankle = landmarks[ankle_i]
        if min(_v(hip), _v(knee), _v(ankle)) < VIS_FOOT:
            return None
        return calculate_angle(
            [hip.x, hip.y], [knee.x, knee.y], [ankle.x, ankle.y]
        )

    ka_l = knee_angle(23, 25, 27)
    ka_r = knee_angle(24, 26, 28)
    angles = [a for a in (ka_l, ka_r) if a is not None]
    if not angles:
        return False, "leg_angle_unknown"
    if max(angles) < MIN_KNEE_ANGLE_EXTENDED:
        return False, "knees_too_bent_not_plank"

    return True, "ok"


def user_message_for_pose_reason(reason: str) -> str:
    """Short coaching copy when posture gate blocks rep counting."""
    messages = {
        "low_visibility_shoulders": "Show your shoulders clearly — full upper body in frame.",
        "low_visibility_hips": "Hips are unclear — step back and improve lighting.",
        "low_visibility_elbows": "Elbows not visible — widen the frame.",
        "low_visibility_wrists": "Hands must be visible for push-ups.",
        "low_visibility_legs_feet": "Include legs and feet in frame for a real plank.",
        "low_visibility_ankles": "Feet must be visible — back up from the camera.",
        "shoulder_hip_not_level": "Level your plank — shoulders and hips in one straight line.",
        "torso_too_vertical_standing": "Get into a horizontal plank, not standing.",
        "torso_inverted_or_bad_angle": "Adjust camera angle — body should be horizontal.",
        "wrists_not_supporting_shoulder_line": "Place hands under shoulders — push-up position only.",
        "ankles_not_aligned_with_lower_body": "Whole body in plank line — feet with hips.",
        "leg_angle_unknown": "Legs not visible enough to confirm a plank.",
        "knees_too_bent_not_plank": "Straighten legs — sitting or squatting is not counted.",
        "init": "Move into a full plank to start counting.",
    }
    return messages.get(reason, "Hold a proper push-up plank to count reps.")
