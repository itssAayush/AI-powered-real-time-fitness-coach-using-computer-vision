import { Link } from "react-router-dom";

const features = [
  {
    title: "Live pose feedback",
    description:
      "Computer vision tracks your form in real time so every rep counts and stays safe.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    gradient: "from-cyan-500/20 to-blue-600/20",
  },
  {
    title: "Rep counting",
    description:
      "Automatic rep detection for push-ups, squats, and more—no wearables required.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    gradient: "from-emerald-500/20 to-teal-600/20",
  },
  {
    title: "Progress & history",
    description:
      "Log workouts, review sessions, and watch your strength improve over time.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    gradient: "from-violet-500/20 to-fuchsia-600/20",
  },
  {
    title: "Works in your browser",
    description:
      "Use your webcam from any modern laptop or tablet—no app install needed.",
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    gradient: "from-amber-500/20 to-orange-600/20",
  },
];

export default function Home() {
  return (
    <div className="overflow-x-hidden">
      <section className="relative isolate">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(52,211,153,0.22),transparent)]"
          aria-hidden
        />
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_100%_20%,rgba(139,92,246,0.12),transparent)]"
          aria-hidden
        />
        <div className="absolute inset-x-0 -top-px -z-10 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" aria-hidden />

        <div className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:px-8 lg:pb-28 lg:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-widest text-emerald-300/90">
              Powered by AI + computer vision
            </p>
            <h1 className="bg-gradient-to-br from-white via-emerald-100 to-cyan-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl sm:leading-[1.1] lg:text-6xl lg:leading-[1.05]">
              AI Real-Time Fitness Coach
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-400 sm:text-xl">
              Train smarter with instant form cues, automatic rep counting, and a clean
              dashboard—your personal coach, on every set.
            </p>
            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                to="/workout"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-teal-400 hover:shadow-emerald-400/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Start Workout
                <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-base font-semibold text-white backdrop-blur transition hover:border-emerald-500/40 hover:bg-emerald-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-xl border border-transparent bg-gradient-to-r from-white/10 to-white/5 px-6 py-3.5 text-base font-semibold text-white transition hover:from-violet-500/20 hover:to-fuchsia-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50"
                >
                  Sign up
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative border-y border-white/[0.06] bg-gradient-to-b from-slate-950 via-slate-900/80 to-slate-950 py-16 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.08),transparent_55%)]" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              See it in action
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              Watch how real-time tracking keeps your sessions focused and consistent.
            </p>
          </div>
          <div className="relative mt-10 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/50 to-slate-900/80 shadow-2xl shadow-indigo-950/50">
            <div className="aspect-video w-full">
              <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-800/90 via-slate-900 to-slate-950 p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/30">
                  <svg className="ml-1 h-8 w-8" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-center text-sm font-medium text-slate-400">
                  Demo video — embed your player or <span className="text-emerald-400">MP4</span> here
                </p>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5" aria-hidden />
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_40%_at_50%_100%,rgba(45,212,191,0.12),transparent)]"
          aria-hidden
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              Built for better workouts
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Everything you need to move with confidence—whether you are at home or in the gym.
            </p>
          </div>
          <ul className="mx-auto mt-14 grid max-w-6xl gap-6 sm:grid-cols-2 lg:gap-8">
            {features.map((f) => (
              <li
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent p-6 transition hover:border-emerald-500/25 hover:shadow-lg hover:shadow-emerald-950/20 sm:p-8"
              >
                <div
                  className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${f.gradient} p-3 text-emerald-200 ring-1 ring-white/10`}
                >
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-slate-400">{f.description}</p>
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-emerald-500/10 to-transparent blur-2xl transition group-hover:from-emerald-400/15" aria-hidden />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-white/[0.06] bg-gradient-to-r from-emerald-950/40 via-slate-950 to-violet-950/40 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <p className="text-lg font-medium text-slate-300">
            Ready when you are — open the camera and start your first session.
          </p>
          <Link
            to="/workout"
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-md shadow-cyan-500/20 transition hover:from-emerald-400 hover:to-cyan-400"
          >
            Start Workout
          </Link>
        </div>
      </section>
    </div>
  );
}
