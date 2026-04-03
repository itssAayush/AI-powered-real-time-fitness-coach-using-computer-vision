import axios, { CanceledError } from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { isMobileDevice } from "../utils/device";
import { playRepChime } from "../utils/repChime";

const CAPTURE_MS = 120;
const SOUND_STORAGE_KEY = "workout_rep_chime";

function loadSoundPref() {
  try {
    const v = localStorage.getItem(SOUND_STORAGE_KEY);
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

function saveSoundPref(on) {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const FEEDBACK_STYLES = {
  praise:
    "border-emerald-400/45 bg-gradient-to-br from-emerald-500/15 via-slate-900/85 to-teal-900/20 shadow-[0_0_32px_-6px_rgba(52,211,153,0.35)] ring-1 ring-emerald-400/25",
  hint: "border-amber-400/40 bg-gradient-to-br from-amber-500/12 via-slate-900/85 to-slate-900/40 ring-1 ring-amber-400/20",
  neutral:
    "border-white/[0.1] bg-slate-900/75 ring-1 ring-white/[0.06]",
  warn: "border-rose-400/40 bg-gradient-to-br from-rose-500/12 via-slate-900/85 to-slate-900/40 ring-1 ring-rose-400/20",
};

function formBarGradient(score) {
  if (score >= 85) return "from-emerald-400 to-teal-400";
  if (score >= 65) return "from-amber-300 to-amber-500";
  return "from-rose-400 to-orange-400";
}

function cameraErrorMessage(err) {
  const name = err && typeof err === "object" && "name" in err ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera access was denied. Allow camera in your browser or site settings, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return "The camera is busy or unavailable. Close other apps using the camera and try again.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "This camera mode is not supported. Try the other camera option.";
  }
  if (name === "TypeError") {
    return "Camera is not available (secure connection required on some browsers).";
  }
  return "Could not start the camera. Check permissions or try another browser.";
}

function Stat({ label, value, bump, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-white/[0.08] bg-slate-900/60 px-4 py-3 transition-shadow duration-300 ${bump ? "animate-stat-bump shadow-lg shadow-emerald-500/20" : ""} ${className}`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

export default function Workout() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const frameAbortRef = useRef(null);
  const lastRepsRef = useRef(0);
  const feedbackNonceRef = useRef(0);
  const desktopAutoStartedRef = useRef(false);

  const isMobile = useMemo(() => isMobileDevice(), []);

  const [exerciseType, setExerciseType] = useState("pushup");
  const [running, setRunning] = useState(false);
  const sessionIdRef = useRef(null);

  const [reps, setReps] = useState("—");
  const [angle, setAngle] = useState("—");
  const [direction, setDirection] = useState("—");
  const [formScore, setFormScore] = useState(null);
  const [feedback, setFeedback] = useState(
    isMobile ? "Choose a camera to begin tracking." : "Starting camera…"
  );
  const [feedbackKind, setFeedbackKind] = useState("neutral");
  const [feedbackAnimKey, setFeedbackAnimKey] = useState(0);
  const [apiError, setApiError] = useState("");
  const [camError, setCamError] = useState("");
  const [cameraLoading, setCameraLoading] = useState(false);
  const [activeFacing, setActiveFacing] = useState(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [skeletonPreview, setSkeletonPreview] = useState(null);
  const [repChimeOn, setRepChimeOn] = useState(loadSoundPref);
  const [repBump, setRepBump] = useState(false);
  const [repHistory, setRepHistory] = useState([]);

  const stopTracksOnly = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const v = videoRef.current;
    if (v) v.srcObject = null;
  }, []);

  const stopSession = useCallback(() => {
    frameAbortRef.current?.abort();
    frameAbortRef.current = null;
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopTracksOnly();
    setSkeletonPreview(null);
    setRunning(false);
    setActiveFacing(null);
    setCameraLoading(false);
  }, [stopTracksOnly]);

  const captureFrameBase64 = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const sendFrame = useCallback(async () => {
    const image = captureFrameBase64();
    if (!image) return;

    frameAbortRef.current?.abort();
    const controller = new AbortController();
    frameAbortRef.current = controller;

    setApiError("");
    try {
      const body = {
        image,
        exercise_type: exerciseType,
        draw_pose: showSkeleton,
        ...(sessionIdRef.current ? { session_id: sessionIdRef.current } : {}),
      };
      const { data } = await api.post("/ai/process-frame", body, {
        signal: controller.signal,
      });
      if (data.session_id) sessionIdRef.current = data.session_id;
      if (data.reps != null && !Number.isNaN(Number(data.reps))) {
        lastRepsRef.current = Math.max(0, Math.floor(Number(data.reps)));
      }
      setReps(data.reps != null ? String(data.reps) : "—");
      setAngle(data.angle != null ? String(Math.round(data.angle * 10) / 10) : "—");
      setDirection(data.direction != null ? String(data.direction) : "—");

      const kind = ["praise", "hint", "neutral", "warn"].includes(data.feedback_kind)
        ? data.feedback_kind
        : "neutral";
      setFeedbackKind(kind);
      const nextFb = data.feedback || "—";
      setFeedback(nextFb);
      feedbackNonceRef.current += 1;
      setFeedbackAnimKey(feedbackNonceRef.current);

      if (data.form_score != null && !Number.isNaN(Number(data.form_score))) {
        setFormScore(Math.max(0, Math.min(100, Math.round(Number(data.form_score)))));
      } else {
        setFormScore(null);
      }

      if (data.rep_completed) {
        if (repChimeOn) playRepChime();
        setRepBump(true);
        window.setTimeout(() => setRepBump(false), 450);
        const n = data.reps != null ? Math.floor(Number(data.reps)) : null;
        const sc =
          data.form_score != null && !Number.isNaN(Number(data.form_score))
            ? Math.round(Number(data.form_score))
            : null;
        if (n != null && n > 0) {
          setRepHistory((h) =>
            [...h, { rep: n, score: sc, t: Date.now() }].slice(-16)
          );
        }
      }

      setSkeletonPreview(
        typeof data.preview_image === "string" ? data.preview_image : null
      );
    } catch (e) {
      if (e instanceof CanceledError) return;
      if (axios.isAxiosError(e) && e.code === "ERR_CANCELED") return;
      if (axios.isAxiosError(e)) {
        const msg = e.response?.data?.error || e.message || "Request failed";
        setApiError(msg);
      } else {
        setApiError("Something went wrong");
      }
    }
  }, [captureFrameBase64, exerciseType, showSkeleton, repChimeOn]);

  const openCamera = useCallback(
    async (facingMode, { resetSession }) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError(
          "Camera is not supported here. Use a modern browser or HTTPS and try again."
        );
        return;
      }

      setCamError("");
      setCameraLoading(true);

      const videoConstraints = isMobile
        ? {
            facingMode: { ideal: facingMode },
            width: { ideal: 720, max: 1280 },
            height: { ideal: 1280, max: 1920 },
            frameRate: { ideal: 24, max: 30 },
          }
        : {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        const previous = streamRef.current;
        streamRef.current = stream;
        previous?.getTracks().forEach((t) => t.stop());

        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play();
        }
        setActiveFacing(facingMode);

        if (resetSession) {
          lastRepsRef.current = 0;
          setRepHistory([]);
          setFormScore(null);
          setFeedbackKind("neutral");
          setApiError("");
          sessionIdRef.current = null;
        }

        if (intervalRef.current == null) {
          setRunning(true);
          intervalRef.current = window.setInterval(() => {
            void sendFrame();
          }, CAPTURE_MS);
          void sendFrame();
        }

        setCameraLoading(false);
      } catch (err) {
        setCameraLoading(false);
        setCamError(cameraErrorMessage(err));
      }
    },
    [isMobile, sendFrame, stopTracksOnly]
  );

  const openCameraRef = useRef(openCamera);
  openCameraRef.current = openCamera;

  useEffect(() => {
    if (isMobile || desktopAutoStartedRef.current) return;
    desktopAutoStartedRef.current = true;
    void openCameraRef.current("user", { resetSession: true });
  }, [isMobile]);

  const handleToggle = () => {
    if (running) {
      const sessionReps = lastRepsRef.current;
      const ex = exerciseType;
      const token = localStorage.getItem("token");

      stopSession();
      sessionIdRef.current = null;
      lastRepsRef.current = 0;
      setReps("—");
      setAngle("—");
      setDirection("—");
      setFormScore(null);
      setFeedbackKind("neutral");
      setFeedback("Session stopped.");
      setFeedbackAnimKey((k) => k + 1);
      setSkeletonPreview(null);

      if (token && sessionReps > 0) {
        void api
          .post("/workout/save", { reps: sessionReps, exercise_type: ex })
          .catch(() => {});
      }

      if (!isMobile) {
        desktopAutoStartedRef.current = false;
      }
    } else if (!isMobile) {
      sessionIdRef.current = null;
      void openCamera("user", { resetSession: true });
    }
  };

  const onMobilePickCamera = (facingMode) => {
    setCamError("");
    void openCamera(facingMode, { resetSession: true });
  };

  const onMobileSwitchCamera = (facingMode) => {
    if (activeFacing === facingMode || cameraLoading) return;
    void openCamera(facingMode, { resetSession: false });
  };

  const toggleChime = () => {
    setRepChimeOn((prev) => {
      const next = !prev;
      saveSoundPref(next);
      return next;
    });
  };

  useEffect(() => () => stopSession(), [stopSession]);

  const feedbackRing = FEEDBACK_STYLES[feedbackKind] || FEEDBACK_STYLES.neutral;
  const formPct = formScore != null ? formScore : 0;
  const mirrorVideo = activeFacing !== "environment";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 px-3 py-4 sm:px-4 sm:py-6">
      <div className="mx-auto grid max-w-[1600px] gap-4 lg:grid-cols-[280px_1fr_280px] lg:items-stretch">
        <aside className="order-2 flex flex-col gap-3 lg:order-1">
          <h1 className="text-lg font-semibold text-white lg:hidden">Workout</h1>
          <Stat label="Reps" value={reps} bump={repBump} />
          <Stat label="Angle (°)" value={angle} />
          <div className="rounded-xl border border-white/[0.08] bg-slate-900/60 px-4 py-3 transition-all duration-500">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Form score
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums text-white">
                {formScore != null ? `${formScore}%` : "—"}
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800/90">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${formScore != null ? formBarGradient(formScore) : "from-slate-600 to-slate-600"}`}
                style={{
                  width: formScore != null ? `${formPct}%` : "0%",
                  opacity: formScore != null ? 1 : 0.35,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-slate-500">
              Blend of alignment, symmetry, and depth/extension vs ideal ranges.
            </p>
          </div>
          <div
            className={`rounded-xl border-2 px-4 py-4 transition-all duration-300 ${feedbackRing}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Live coaching
            </p>
            <p
              key={feedbackAnimKey}
              className="mt-2 animate-feedback-in text-base font-medium leading-relaxed text-slate-50"
            >
              {feedback}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-900/40 px-4 py-3 text-xs text-slate-500">
            <span className="text-slate-400">Phase: </span>
            <span className="font-medium capitalize text-slate-300">{direction}</span>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-slate-900/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Rep history (session)
            </p>
            {repHistory.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Complete reps to build a timeline.</p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1 text-sm">
                {[...repHistory].reverse().map((row, i) => (
                  <li
                    key={`${row.t}-${row.rep}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-slate-950/50 px-2.5 py-1.5 tabular-nums text-slate-300 transition hover:border-emerald-500/15"
                  >
                    <span className="font-medium text-white">Rep {row.rep}</span>
                    <span className="text-xs text-slate-500">
                      {row.score != null ? `${row.score}%` : "—"}
                      <span className="ml-2 text-slate-600">
                        {new Date(row.t).toLocaleTimeString(undefined, {
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className="order-1 flex flex-col gap-3 lg:order-2">
          <h1 className="hidden text-xl font-semibold tracking-tight text-white lg:block">Workout</h1>
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50 workout-video-enter">
            <video
              ref={videoRef}
              className={`absolute inset-0 h-full w-full bg-black object-cover transition-opacity duration-300 ${
                mirrorVideo ? "[transform:scaleX(-1)]" : ""
              } ${showSkeleton && skeletonPreview ? "opacity-0" : "opacity-100"}`}
              playsInline
              muted
              autoPlay
            />
            {showSkeleton && skeletonPreview ? (
              <img
                src={skeletonPreview}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                  mirrorVideo ? "[transform:scaleX(-1)]" : ""
                }`}
                draggable={false}
              />
            ) : null}

            {cameraLoading ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-slate-950/85 backdrop-blur-sm"
                role="status"
                aria-live="polite"
              >
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
                <p className="text-sm font-medium text-slate-200">Starting camera…</p>
              </div>
            ) : null}

            {isMobile && !running && !cameraLoading ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-slate-950/92 p-6 text-center">
                <p className="max-w-xs text-sm text-slate-300">
                  Select which camera to use for pose tracking. You can switch later while
                  training.
                </p>
                <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => onMobilePickCamera("user")}
                    className="min-h-[52px] flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-4 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition active:scale-[0.98] hover:from-emerald-400 hover:to-teal-400"
                  >
                    Front camera
                  </button>
                  <button
                    type="button"
                    onClick={() => onMobilePickCamera("environment")}
                    className="min-h-[52px] flex-1 rounded-2xl border-2 border-emerald-500/50 bg-slate-900/80 px-6 py-4 text-base font-semibold text-emerald-100 transition active:scale-[0.98] hover:border-emerald-400 hover:bg-slate-800"
                  >
                    Back camera
                  </button>
                </div>
              </div>
            ) : null}

            {camError ? (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/95 p-4 text-center">
                <div className="max-w-sm rounded-xl border border-rose-500/30 bg-rose-950/60 p-4">
                  <p className="text-sm font-medium text-rose-100">{camError}</p>
                  <button
                    type="button"
                    onClick={() => setCamError("")}
                    className="mt-4 w-full rounded-xl bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}

            {running && formScore != null ? (
              <div className="pointer-events-none absolute right-3 top-3 z-[5] rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition-all duration-500">
                Form <span className="text-emerald-300">{formScore}%</span>
              </div>
            ) : null}
          </div>

          {isMobile && running ? (
            <div className="grid grid-cols-2 gap-3 sm:mx-auto sm:max-w-md">
              <button
                type="button"
                disabled={cameraLoading || activeFacing === "user"}
                onClick={() => onMobileSwitchCamera("user")}
                className="min-h-[48px] rounded-xl border border-white/15 bg-slate-900/80 py-3 text-sm font-semibold text-white transition enabled:hover:border-emerald-500/40 enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Front camera
              </button>
              <button
                type="button"
                disabled={cameraLoading || activeFacing === "environment"}
                onClick={() => onMobileSwitchCamera("environment")}
                className="min-h-[48px] rounded-xl border border-white/15 bg-slate-900/80 py-3 text-sm font-semibold text-white transition enabled:hover:border-emerald-500/40 enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back camera
              </button>
            </div>
          ) : null}

          <canvas ref={canvasRef} className="hidden" />
          {apiError ? (
            <p className="rounded-lg border border-rose-500/30 bg-rose-950/50 px-3 py-2 text-sm text-rose-200" role="alert">
              {apiError}
            </p>
          ) : null}
        </div>

        <aside className="order-3 flex flex-col gap-4 lg:order-3">
          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/50 p-4">
            <label htmlFor="exercise" className="block text-sm font-medium text-slate-300">
              Exercise
            </label>
            <select
              id="exercise"
              value={exerciseType}
              disabled={running}
              onChange={(e) => {
                setExerciseType(e.target.value);
                sessionIdRef.current = null;
              }}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-white outline-none transition focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="pushup">Push-up</option>
              <option value="squat">Squat</option>
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Stop the session to change exercise (resets rep count). Logged in users save reps when you press Stop.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-300">Rep chime</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Short sound when a rep registers (browser).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={repChimeOn}
                aria-label="Toggle rep completion sound"
                onClick={toggleChime}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  repChimeOn ? "bg-emerald-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    repChimeOn ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-300">Pose skeleton</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Off by default. When on, the preview shows MediaPipe landmarks (slightly more work per frame).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showSkeleton}
                aria-label="Toggle pose skeleton overlay"
                onClick={() => {
                  setShowSkeleton((prev) => {
                    const next = !prev;
                    if (!next) setSkeletonPreview(null);
                    return next;
                  });
                }}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  showSkeleton ? "bg-emerald-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    showSkeleton ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={handleToggle}
              disabled={!running}
              className={
                running
                  ? "min-h-[48px] rounded-xl border border-rose-500/50 bg-rose-500/15 py-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25"
                  : "min-h-[48px] cursor-not-allowed rounded-xl border border-white/10 bg-slate-800/80 py-4 text-sm font-medium text-slate-500"
              }
            >
              {running ? "Stop session" : "Use the camera buttons on the video"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggle}
              className={
                running
                  ? "min-h-[48px] rounded-xl border border-rose-500/50 bg-rose-500/15 py-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25"
                  : "min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-400"
              }
            >
              {running ? "Stop" : "Start"}
            </button>
          )}

          <p className="text-xs leading-relaxed text-slate-500">
            {isMobile
              ? "Choose front or back camera, then train. Switch cameras anytime below the video."
              : `Camera starts automatically on desktop. Frames about every ${CAPTURE_MS} ms.`}
          </p>
        </aside>
      </div>
    </div>
  );
}
