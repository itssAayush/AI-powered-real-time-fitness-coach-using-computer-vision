"""
AI fitness coach — Flask API. Run from backend/:  python app.py
"""
from __future__ import annotations

import base64
import binascii
import logging
import os
import sqlite3
import uuid
from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

import cv2
import jwt
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

from ai_engine.exercises.pushup import PushUp
from ai_engine.exercises.squat import Squat
from ai_engine.form_scoring import compute_form_score
from ai_engine.pose_detector import PoseDetector
from ai_engine.pushup_posture import user_message_for_pose_reason

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "fitness_coach.db"
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-change-me-in-production")
JWT_ALGO = "HS256"
JWT_EXP_DAYS = 7

_pose_detector = PoseDetector()
MAX_SESSION_EXERCISES = 256
_session_exercises: OrderedDict[str, PushUp | Squat] = OrderedDict()


def _get_session_exercise(key: str, exercise_type: str) -> PushUp | Squat:
    if key in _session_exercises:
        _session_exercises.move_to_end(key)
        return _session_exercises[key]
    exercise = _exercise_instance(exercise_type)
    _session_exercises[key] = exercise
    while len(_session_exercises) > MAX_SESSION_EXERCISES:
        _session_exercises.popitem(last=False)
    return exercise


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS workouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                reps INTEGER NOT NULL,
                exercise_type TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )
        conn.commit()


def create_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=JWT_EXP_DAYS),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)
    if isinstance(token, bytes):
        return token.decode("utf-8")
    return token


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])


def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401
        raw = auth[7:].strip()
        if not raw:
            return jsonify({"error": "Missing token"}), 401
        try:
            payload = decode_token(raw)
            user_id = int(payload["sub"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        except (KeyError, TypeError, ValueError):
            return jsonify({"error": "Invalid token payload"}), 401
        request.user_id = user_id  # type: ignore[attr-defined]
        return f(*args, **kwargs)

    return decorated


def decode_base64_image(b64: str) -> np.ndarray | None:
    s = (b64 or "").strip()
    if not s:
        return None
    if "base64," in s:
        s = s.split("base64,", 1)[1]
    s = s.replace("\n", "").replace("\r", "")
    pad = len(s) % 4
    if pad:
        s += "=" * (4 - pad)
    try:
        raw = base64.b64decode(s, validate=False)
    except (binascii.Error, ValueError):
        return None
    if not raw:
        return None
    arr = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None or frame.size == 0:
        return None
    return frame


def encode_frame_jpeg_data_url(image_bgr: np.ndarray, quality: int = 78) -> str | None:
    """JPEG data URL for optional preview; lower quality keeps payloads smaller."""
    ok, buf = cv2.imencode(".jpg", image_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok or buf is None:
        return None
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def _exercise_instance(exercise_type: str) -> PushUp | Squat:
    if exercise_type == "pushup":
        return PushUp()
    if exercise_type == "squat":
        return Squat()
    raise ValueError("exercise_type must be 'pushup' or 'squat'")


def _pushup_shoulder_hip_gap(landmarks) -> float | None:
    ls, rs = landmarks[11], landmarks[12]
    lh, rh = landmarks[23], landmarks[24]
    vis = all(
        getattr(x, "visibility", 1.0) > 0.5 for x in (ls, rs, lh, rh)
    )
    if not vis:
        return None
    sy = (ls.y + rs.y) / 2
    hy = (lh.y + rh.y) / 2
    return abs(sy - hy)


def _coaching_feedback(
    exercise_type: str,
    landmarks,
    angle: float,
    direction: str | None,
) -> tuple[str, str]:
    """
    Returns (message, kind) where kind is hint | praise | neutral | warn.
    """
    gap = _pushup_shoulder_hip_gap(landmarks) if exercise_type == "pushup" else None

    if exercise_type == "squat":
        if angle > 158:
            return (
                "Stand tall — now break at the hips and sit back like a chair.",
                "hint",
            )
        if angle > 152:
            return (
                "Go lower — knees track over toes; chest stays proud.",
                "hint",
            )
        if angle < 88:
            return (
                "Drive up — push the floor away, squeeze glutes at the top.",
                "hint",
            )
        if angle < 98:
            return (
                "Great depth. Stand with power through your whole foot.",
                "praise",
            )
        if 120 <= angle <= 145:
            return (
                "Good form — smooth tempo through the middle.",
                "praise",
            )
        return (
            "Keep weight mid-foot; knees open in line with your toes.",
            "neutral",
        )

    # push-up
    if gap is not None and gap > 0.34:
        return (
            "Straighten your line — stack shoulders over hips (strong plank).",
            "warn",
        )
    if angle > 165:
        return (
            "Go lower — bend elbows; chest toward the floor with control.",
            "hint",
        )
    if angle > 158:
        return (
            "Keep descending — elbows at ~45° to your body.",
            "hint",
        )
    if angle < 118:
        return (
            "Press up — drive through palms; finish with arms straight.",
            "hint",
        )
    if angle < 132:
        return (
            "Solid depth. Push the ground away back to plank.",
            "praise",
        )
    if direction == "up":
        return (
            "Strong push — keep hips level; no piking or sagging.",
            "praise",
        )
    if direction == "down":
        return (
            "Controlled lower — core braced, one straight line.",
            "praise",
        )
    return (
        "Hold a tight plank — head neutral, glutes engaged.",
        "neutral",
    )


app = Flask(__name__)
CORS(app)
init_db()


@app.errorhandler(404)
def not_found(_e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def server_error(_e):
    logger.exception("Unhandled server error")
    return jsonify({"error": "Internal server error"}), 500


@app.post("/auth/signup")
def signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    pw_hash = generate_password_hash(password)
    created = datetime.now(timezone.utc).isoformat()
    try:
        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
                (email, pw_hash, created),
            )
            conn.commit()
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"error": "Email already registered"}), 409
    except sqlite3.Error:
        logger.exception("signup db error")
        return jsonify({"error": "Database error"}), 500

    token = create_token(user_id)
    return jsonify({"token": token, "user_id": user_id}), 201


@app.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "email and password required"}), 400

    try:
        with get_db() as conn:
            row = conn.execute(
                "SELECT id, password_hash FROM users WHERE email = ?",
                (email,),
            ).fetchone()
    except sqlite3.Error:
        logger.exception("login db error")
        return jsonify({"error": "Database error"}), 500

    if row is None or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_token(row["id"])
    return jsonify({"token": token, "user_id": row["id"]})


@app.post("/workout/save")
@auth_required
def workout_save():
    data = request.get_json(silent=True) or {}
    reps = data.get("reps")
    exercise_type = (data.get("exercise_type") or "").strip().lower()
    if reps is None or exercise_type not in ("pushup", "squat"):
        return jsonify({"error": "reps and exercise_type (pushup|squat) required"}), 400
    try:
        reps_int = int(reps)
    except (TypeError, ValueError):
        return jsonify({"error": "reps must be an integer"}), 400
    if reps_int < 0:
        return jsonify({"error": "reps must be non-negative"}), 400

    user_id = request.user_id  # type: ignore[attr-defined]
    ts = datetime.now(timezone.utc).isoformat()
    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO workouts (user_id, reps, exercise_type, timestamp) VALUES (?, ?, ?, ?)",
                (user_id, reps_int, exercise_type, ts),
            )
            conn.commit()
    except sqlite3.Error:
        logger.exception("workout save db error")
        return jsonify({"error": "Database error"}), 500

    return jsonify({"ok": True}), 201


@app.get("/workout/history")
@auth_required
def workout_history():
    user_id = request.user_id  # type: ignore[attr-defined]
    try:
        with get_db() as conn:
            rows = conn.execute(
                """
                SELECT id, reps, exercise_type, timestamp
                FROM workouts
                WHERE user_id = ?
                ORDER BY timestamp DESC
                """,
                (user_id,),
            ).fetchall()
    except sqlite3.Error:
        logger.exception("workout history db error")
        return jsonify({"error": "Database error"}), 500

    return jsonify(
        {
            "workouts": [
                {
                    "id": r["id"],
                    "reps": r["reps"],
                    "exercise_type": r["exercise_type"],
                    "timestamp": r["timestamp"],
                }
                for r in rows
            ]
        }
    )


@app.post("/ai/process-frame")
def process_frame():
    if not request.is_json:
        return jsonify({"error": "Content-Type must be application/json"}), 415

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON body"}), 400

    b64 = data.get("image")
    exercise_type = (data.get("exercise_type") or "").strip().lower()
    draw_pose = bool(data.get("draw_pose", False))
    if exercise_type not in ("pushup", "squat"):
        return jsonify({"error": "exercise_type must be 'pushup' or 'squat'"}), 400

    session_id = (data.get("session_id") or "").strip() or str(uuid.uuid4())
    key = f"{session_id}:{exercise_type}"
    exercise = _get_session_exercise(key, exercise_type)

    frame = decode_base64_image(b64 if isinstance(b64, str) else "")
    if frame is None:
        return jsonify({"error": "Invalid or empty image (base64 required)"}), 400

    try:
        annotated, results = _pose_detector.detect_pose(
            frame, draw_landmarks=draw_pose
        )
        landmarks = _pose_detector.get_landmarks(results)
    except Exception:
        logger.exception("pose detection failed")
        return jsonify({"error": "Pose processing failed"}), 500

    preview_image = (
        encode_frame_jpeg_data_url(annotated) if draw_pose else None
    )

    if landmarks is None:
        direction = getattr(exercise, "direction", None)
        payload = {
            "reps": exercise.counter,
            "angle": None,
            "direction": direction,
            "feedback": "No pose detected. Step into frame and ensure good lighting.",
            "feedback_kind": "warn",
            "form_score": None,
            "rep_completed": False,
            "session_id": session_id,
        }
        if exercise_type == "pushup":
            payload["pushup_pose_ok"] = False
            payload["pushup_bottom_reached"] = False
        if preview_image:
            payload["preview_image"] = preview_image
        return jsonify(payload)

    try:
        reps, angle, direction, rep_completed = exercise.update(landmarks)
    except Exception as e:
        logger.exception("exercise update failed")
        return jsonify({"error": f"Exercise update failed: {e!s}"}), 500

    try:
        angle_out = float(angle) if angle is not None else None
    except (TypeError, ValueError):
        angle_out = None

    form_score = compute_form_score(exercise_type, landmarks, angle_out)

    if isinstance(exercise, PushUp) and not exercise.last_pose_valid:
        feedback = user_message_for_pose_reason(exercise.last_pose_reason)
        feedback_kind = "warn"
    elif angle_out is not None:
        feedback, feedback_kind = _coaching_feedback(
            exercise_type, landmarks, angle_out, direction
        )
    else:
        feedback = "Pose unclear — try adjusting distance from the camera."
        feedback_kind = "warn"

    payload = {
        "reps": reps,
        "angle": angle,
        "direction": direction,
        "feedback": feedback,
        "feedback_kind": feedback_kind,
        "form_score": form_score,
        "rep_completed": bool(rep_completed),
        "session_id": session_id,
    }
    if isinstance(exercise, PushUp):
        payload["pushup_pose_ok"] = exercise.last_pose_valid
        payload["pushup_bottom_reached"] = exercise.bottom_reached
        if bool(data.get("debug_pose")):
            payload["pushup_pose_reason"] = exercise.last_pose_reason

    if preview_image:
        payload["preview_image"] = preview_image
    return jsonify(payload)


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(host="0.0.0.0", port=5000)
