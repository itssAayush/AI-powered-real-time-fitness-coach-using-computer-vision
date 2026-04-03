import queue
import sys
import threading
import cv2
import platform
from pathlib import Path

try:
    import pyttsx3
except ImportError:
    pyttsx3 = None

_ROOT = Path(__file__).resolve().parent
_BACKEND = _ROOT / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from ai_engine.pose_detector import PoseDetector
from ai_engine.exercises.pushup import PushUp
from ai_engine.exercises.squat import Squat
from ai_engine.form_scoring import compute_form_score


def activate_macos_app():
    if platform.system() != "Darwin":
        return

    try:
        from AppKit import NSApplication, NSApplicationActivationPolicyRegular

        app = NSApplication.sharedApplication()
        app.setActivationPolicy_(NSApplicationActivationPolicyRegular)
        app.activateIgnoringOtherApps_(True)
    except Exception:
        pass


def draw_panel(image, top_left, bottom_right, color=(18, 18, 18), alpha=0.55):
    overlay = image.copy()
    cv2.rectangle(overlay, top_left, bottom_right, color, -1)
    cv2.addWeighted(overlay, alpha, image, 1 - alpha, 0, image)


def draw_text(image, text, position, scale=0.55, color=(245, 245, 245), thickness=1):
    cv2.putText(
        image,
        text,
        position,
        cv2.FONT_HERSHEY_DUPLEX,
        scale,
        (0, 0, 0),
        thickness + 2,
        cv2.LINE_AA,
    )
    cv2.putText(
        image,
        text,
        position,
        cv2.FONT_HERSHEY_DUPLEX,
        scale,
        color,
        thickness,
        cv2.LINE_AA,
    )


class Speaker:
    def __init__(self):
        self.enabled = False
        self.engine = None
        self.messages = queue.Queue()
        self.worker = None

        if pyttsx3 is None:
            return

        try:
            self.engine = pyttsx3.init()
            self.engine.setProperty("rate", 175)
            self.worker = threading.Thread(target=self._run, daemon=True)
            self.worker.start()
            self.enabled = True
        except Exception:
            self.engine = None
            self.worker = None

    def _run(self):
        while True:
            message = self.messages.get()
            if message is None:
                break

            try:
                self.engine.say(message)
                self.engine.runAndWait()
            except Exception:
                continue

    def say(self, message):
        if self.enabled and message and self.messages.empty():
            self.messages.put(message)

    def stop(self):
        if self.enabled:
            self.messages.put(None)
            if self.worker is not None:
                self.worker.join(timeout=1)


def main():

    # Initialize detector and exercise
    detector = PoseDetector()
    exercise_type = "pushup"
    exercise = PushUp()
    speaker = Speaker()
    last_feedback_voice = None
    window_name = "Edge AI Gym"
    window_initialized = False

    activate_macos_app()

    # Use AVFoundation on macOS; let OpenCV choose the default backend elsewhere.
    if platform.system() == "Darwin":
        cap = cv2.VideoCapture(0, cv2.CAP_AVFOUNDATION)
    else:
        cap = cv2.VideoCapture(0)

    if not cap.isOpened():
        print("❌ Camera failed to open")
        return
    else:
        print("✅ Camera opened successfully")

    cv2.namedWindow(window_name, cv2.WINDOW_AUTOSIZE)

    while True:
        ret, frame = cap.read()

        if not ret:
            print("❌ Failed to grab frame")
            break

        frame = cv2.resize(frame, (640, 480))

        # Detect pose
        image, results = detector.detect_pose(frame, draw_landmarks=True)
        landmarks = detector.get_landmarks(results)
        count = exercise.counter
        angle = None
        direction = None
        form_pct = None
        feedback = "Find your pose"
        feedback_voice = None

        if landmarks is not None:
            count, angle, direction, rep_done = exercise.update(landmarks)
            if angle is not None:
                form_pct = compute_form_score(exercise_type, landmarks, float(angle))
            if rep_done:
                speaker.say("Nice rep")

            if exercise_type == "pushup":
                if angle > 158:
                    feedback = "Go Lower"
                    feedback_voice = "Go lower"
                elif angle < 132:
                    feedback = "Push Up"
                    feedback_voice = "Push up"
                else:
                    feedback = "Good Form"
            elif exercise_type == "squat":
                if angle > 152:
                    feedback = "Go Lower"
                    feedback_voice = "Go lower"
                elif angle < 98:
                    feedback = "Stand Up"
                    feedback_voice = "Stand up"
                else:
                    feedback = "Good Form"

        if feedback_voice and feedback_voice != last_feedback_voice:
            speaker.say(feedback_voice)
        last_feedback_voice = feedback_voice

        hud_left = 14
        hud_top = 14
        hud_width = 220
        hud_height = 210
        draw_panel(image, (hud_left, hud_top), (hud_left + hud_width, hud_top + hud_height))

        draw_text(image, f"Reps: {count}", (26, 42), scale=0.7, color=(255, 255, 255), thickness=1)
        draw_text(
            image,
            f"Angle: {int(angle) if angle is not None else '---'}",
            (26, 72),
            scale=0.5,
            color=(220, 220, 220),
            thickness=1,
        )
        draw_text(
            image,
            f"Direction: {direction if direction else '---'}",
            (26, 100),
            scale=0.5,
            color=(220, 220, 220),
            thickness=1,
        )
        draw_text(
            image,
            f"Exercise: {exercise_type.title()}",
            (26, 128),
            scale=0.5,
            color=(220, 220, 220),
            thickness=1,
        )
        draw_text(
            image,
            f"Form: {int(form_pct)}%" if form_pct is not None else "Form: ---",
            (26, 154),
            scale=0.5,
            color=(180, 255, 200),
            thickness=1,
        )
        draw_text(image, feedback, (26, 180), scale=0.55, color=(120, 230, 255), thickness=1)

        controls_text = "P: Pushup  S: Squat  Q: Quit"
        controls_scale = 0.42
        controls_thickness = 1
        (controls_width, controls_height), controls_baseline = cv2.getTextSize(
            controls_text,
            cv2.FONT_HERSHEY_DUPLEX,
            controls_scale,
            controls_thickness,
        )
        controls_x = image.shape[1] - controls_width - 24
        controls_y = 28
        draw_panel(
            image,
            (controls_x - 10, controls_y - controls_height - 8),
            (controls_x + controls_width + 10, controls_y + controls_baseline + 8),
            alpha=0.5,
        )
        draw_text(
            image,
            controls_text,
            (controls_x, controls_y),
            scale=controls_scale,
            color=(240, 240, 240),
            thickness=controls_thickness,
        )

        cv2.imshow(window_name, image)

        if not window_initialized:
            activate_macos_app()
            window_initialized = True

        key = cv2.waitKey(1) & 0xFF
        if key == ord("p"):
            exercise = PushUp()
            exercise_type = "pushup"
            last_feedback_voice = None
        elif key == ord("s"):
            exercise = Squat()
            exercise_type = "squat"
            last_feedback_voice = None
        elif key == ord("q"):
            break

    cap.release()
    speaker.stop()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
