# AI-Powered Real-Time Fitness Coach Using Computer Vision

A real-time fitness coaching application that uses computer vision and pose estimation to track exercise form, count repetitions, and provide instant on-screen and voice feedback. The system runs locally on-device for low latency and better privacy.

## Features

- Real-time pose tracking with MediaPipe and OpenCV
- Push-up and squat detection with rep counting
- Live coaching feedback such as `Go Lower`, `Push Up`, and `Stand Up`
- Keyboard-based exercise switching during a session
- Portable camera initialization with macOS-specific backend support
- Optional voice guidance with `pyttsx3`

## Controls

- `P`: Switch to push-up mode
- `S`: Switch to squat mode
- `Q`: Quit the application

## Tech Stack

- Python
- OpenCV
- MediaPipe
- NumPy
- pyttsx3

## Project Structure

```text
.
├── main.py
├── pose_detector.py
├── angle_utils.py
├── requirements.txt
└── exercises/
    ├── base_exercise.py
    ├── pushup.py
    └── squat.py
```

## Getting Started

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the application:

```bash
python main.py
```

## Demo Flow

1. Start the app and allow camera access if prompted.
2. Press `P` for push-ups or `S` for squats.
3. Follow the on-screen guidance and voice feedback.
4. Press `Q` to exit.
