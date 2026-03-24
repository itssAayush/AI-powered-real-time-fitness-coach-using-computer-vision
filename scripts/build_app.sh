#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_PYTHON="$ROOT_DIR/gym_env/bin/python"

if [[ -n "${PYTHON_BIN:-}" ]]; then
  PYTHON="$PYTHON_BIN"
elif [[ -x "$DEFAULT_PYTHON" ]]; then
  PYTHON="$DEFAULT_PYTHON"
else
  PYTHON="python3"
fi

echo "Using Python: $PYTHON"
"$PYTHON" -m pip install -r "$ROOT_DIR/requirements.txt" -r "$ROOT_DIR/requirements-build.txt"
"$PYTHON" -m PyInstaller --noconfirm --clean "$ROOT_DIR/fitness_coach.spec"

echo
echo "Build complete."
echo "App bundle: $ROOT_DIR/dist/FitnessCoach.app"
echo "Build folder: $ROOT_DIR/dist/FitnessCoach"
