/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "stat-bump": {
          "0%": { transform: "scale(1)" },
          "35%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
        "feedback-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(52, 211, 153, 0.35)" },
          "50%": { boxShadow: "0 0 24px 2px rgba(52, 211, 153, 0.2)" },
        },
      },
      animation: {
        "stat-bump": "stat-bump 0.45s cubic-bezier(0.34, 1.4, 0.64, 1)",
        "feedback-in": "feedback-in 0.35s ease-out",
        "glow-pulse": "glow-pulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
