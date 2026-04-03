/** Backend origin (no trailing slash). Set VITE_API_URL in .env for production. */
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000"
).replace(/\/$/, "");
