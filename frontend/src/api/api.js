import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

// Attach auth token automatically based on which role is logged in
api.interceptors.request.use((config) => {
  const workerToken = localStorage.getItem("workerToken");
  const customerToken = localStorage.getItem("customerToken");
  const adminToken = localStorage.getItem("adminToken");

  const path = config.url || "";
  const role = config.authRole || (
    path.startsWith("/admin") ? "admin" :
    path.startsWith("/workers/me") || path.startsWith("/auth/worker") ? "worker" :
    path.startsWith("/reviews") && config.method?.toLowerCase() !== "get" ? "customer" :
    null
  );
  const token = role === "admin" ? adminToken : role === "worker" ? workerToken : role === "customer" ? customerToken : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the backend rejects a token as invalid/expired, clear it immediately
// rather than letting a dead token linger in localStorage and keep failing
// silently on every subsequent request. We also broadcast a window event so
// any component (Navbar, dashboards, etc.) can react consistently - show a
// "session expired" message, update login state, redirect - without every
// page having to duplicate its own 401-handling logic.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const hadToken = ["workerToken", "customerToken", "adminToken"].some(
        (k) => localStorage.getItem(k)
      );

      ["workerToken", "customerToken", "adminToken"].forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem("workerName");
      localStorage.removeItem("customerName");

      // Only announce an "expiry" if there actually was a token - a plain
      // logged-out visitor hitting a public endpoint that happens to 401
      // for an unrelated reason shouldn't trigger a "session expired" banner.
      if (hadToken) {
        window.dispatchEvent(
          new CustomEvent("auth:expired", { detail: { message: err.response?.data?.message } })
        );
      }
    }
    return Promise.reject(err);
  }
);

export default api;