import cv2
import mediapipe as mp

class PoseDetector:
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose()
        self.mp_drawing = mp.solutions.drawing_utils

    def detect_pose(self, frame, draw_landmarks: bool = False):
        frame = cv2.flip(frame, 1)  # mirror for consistency
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(image)
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        if draw_landmarks and results.pose_landmarks:
            self.mp_drawing.draw_landmarks(
                image,
                results.pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS,
            )

        return image, results

    def get_landmarks(self, results):
        if results.pose_landmarks:
            return results.pose_landmarks.landmark
        return None

    def __del__(self):
        self.pose.close()