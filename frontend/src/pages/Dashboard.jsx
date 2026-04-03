import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";

function formatExerciseLabel(type) {
  if (type === "pushup") return "Push-up";
  if (type === "squat") return "Squat";
  return String(type || "Workout");
}

function localDayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function buildLast7DaysSeries(workouts) {
  const now = new Date();
  const keys = [];
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    keys.push(k);
    labels.push(
      d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    );
  }
  const byDay = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const w of workouts) {
    const k = localDayKey(w.timestamp);
    if (k in byDay) byDay[k] += Number(w.reps) || 0;
  }
  return keys.map((k, i) => ({ label: labels[i], reps: byDay[k] }));
}

export default function Dashboard() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setUnauthorized(false);
      setLoading(true);
      try {
        const { data } = await api.get("/workout/history");
        if (cancelled) return;
        setWorkouts(Array.isArray(data.workouts) ? data.workouts : []);
      } catch (e) {
        if (cancelled) return;
        if (axios.isAxiosError(e) && e.response?.status === 401) {
          setUnauthorized(true);
        } else if (axios.isAxiosError(e)) {
          setError(
            e.response?.data?.error || e.message || "Failed to load history"
          );
        } else {
          setError("Something went wrong");
        }
        setWorkouts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalReps = useMemo(
    () => workouts.reduce((sum, w) => sum + (Number(w.reps) || 0), 0),
    [workouts]
  );

  const weeklyReps = useMemo(
    () => buildLast7DaysSeries(workouts).reduce((s, d) => s + d.reps, 0),
    [workouts]
  );

  const chartData = useMemo(() => buildLast7DaysSeries(workouts), [workouts]);

  if (unauthorized) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-8 shadow-xl">
          <h1 className="text-xl font-semibold text-white">Sign in required</h1>
          <p className="mt-2 text-slate-400">Log in to view your workout history and stats.</p>
          <Link
            to="/login"
            className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-semibold text-slate-950"
          >
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-slate-400">Progress overview and logged sessions.</p>
      </div>

      {error ? (
        <div
          className="mb-6 rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/[0.06] bg-slate-900/40 p-10 text-center text-slate-400">
          Loading your data…
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-emerald-500/10 via-slate-900/80 to-slate-900/40 p-6 shadow-lg shadow-emerald-950/20">
              <p className="text-sm font-medium text-emerald-200/80">Total reps</p>
              <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-white">{totalReps}</p>
              <p className="mt-2 text-xs text-slate-500">All logged workouts</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-6">
              <p className="text-sm font-medium text-slate-400">Last 7 days</p>
              <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-white">{weeklyReps}</p>
              <p className="mt-2 text-xs text-slate-500">Reps in the chart window</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-6 sm:col-span-2 lg:col-span-1">
              <p className="text-sm font-medium text-slate-400">Sessions logged</p>
              <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-white">
                {workouts.length}
              </p>
              <p className="mt-2 text-xs text-slate-500">Total entries</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/50 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Weekly activity</h2>
            <p className="mt-1 text-sm text-slate-400">Reps per day (local time), last 7 days</p>
            <div className="mt-6 h-[280px] w-full min-w-0">
              {chartData.every((d) => d.reps === 0) ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-slate-950/50 text-sm text-slate-500">
                  No reps in the last 7 days — log a workout to see the chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={{ stroke: "#475569" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(52, 211, 153, 0.08)" }}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "10px",
                        color: "#e2e8f0",
                      }}
                      labelStyle={{ color: "#cbd5e1", marginBottom: 4 }}
                    />
                    <Bar dataKey="reps" fill="#34d399" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-slate-900/50 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Workout history</h2>
            <p className="mt-1 text-sm text-slate-400">Newest first</p>
            {workouts.length === 0 ? (
              <p className="mt-8 text-center text-sm text-slate-500">
                No workouts yet.{" "}
                <Link to="/workout" className="text-emerald-400 hover:text-emerald-300">
                  Start a session
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {workouts.map((w) => (
                  <li
                    key={w.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-slate-950/50 px-4 py-3 transition hover:border-emerald-500/20"
                  >
                    <div>
                      <p className="font-medium text-white">{formatExerciseLabel(w.exercise_type)}</p>
                      <p className="text-xs text-slate-500">Session #{w.id}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(w.timestamp).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-right">
                      <p className="text-xs text-slate-400">Reps</p>
                      <p className="font-mono text-lg font-semibold text-emerald-200">{w.reps}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
