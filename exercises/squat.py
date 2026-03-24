from exercises.base_exercise import BaseExercise
from angle_utils import calculate_angle
import numpy as np


class Squat(BaseExercise):
    def __init__(self):
        super().__init__()
        self.angle_history = []
        self.direction = None
        self.cooldown = 0
        self.bottom_reached = False

    def smooth_angle(self, angle):
        self.angle_history.append(angle)
        if len(self.angle_history) > 5:
            self.angle_history = self.angle_history[-5:]
        return np.mean(self.angle_history)

    def landmark_visible(self, landmark):
        return getattr(landmark, "visibility", 1.0) > 0.5

    def get_leg_angle(self, landmarks):
        candidate_angles = []
        leg_sets = [
            (23, 25, 27),
            (24, 26, 28),
        ]

        for hip_idx, knee_idx, ankle_idx in leg_sets:
            hip = landmarks[hip_idx]
            knee = landmarks[knee_idx]
            ankle = landmarks[ankle_idx]

            if not all(self.landmark_visible(point) for point in (hip, knee, ankle)):
                continue

            candidate_angles.append(
                calculate_angle(
                    [hip.x, hip.y],
                    [knee.x, knee.y],
                    [ankle.x, ankle.y],
                )
            )

        if not candidate_angles:
            hip = [landmarks[24].x, landmarks[24].y]
            knee = [landmarks[26].x, landmarks[26].y]
            ankle = [landmarks[28].x, landmarks[28].y]
            return calculate_angle(hip, knee, ankle)

        return float(np.mean(candidate_angles))

    def update(self, landmarks):
        raw_angle = self.get_leg_angle(landmarks)
        angle = self.smooth_angle(raw_angle)

        if self.cooldown > 0:
            self.cooldown -= 1
            return self.counter, angle, self.direction

        # At the top position, cue the user to go lower.
        if angle > 155:
            self.direction = "down"

        # Near the bottom position, cue the user to stand back up.
        elif angle < 95:
            self.direction = "up"
            self.bottom_reached = True

        # Count a rep once the user returns to the top after reaching the bottom.
        if angle > 155 and self.bottom_reached and self.direction == "down":
            self.counter += 1
            self.bottom_reached = False
            self.cooldown = 8

        return self.counter, angle, self.direction
