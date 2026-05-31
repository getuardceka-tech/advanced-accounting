import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("gca_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;
    
    // Auto-retry on transient gateway errors (502 / 503 / 504) — single retry after 1.2s
    const TRANSIENT = [502, 503, 504];
    if (TRANSIENT.includes(status) && !config.__retried) {
      config.__retried = true;
      await new Promise((r) => setTimeout(r, 1200));
      try {
        return await api.request(config);
      } catch (e) {
        // Second failure — proceed to handler below
        error = e;
      }
    }
    
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/login")) {
      localStorage.removeItem("gca_token");
      window.location.href = "/login";
    }
    
    // Emit a toast event for non-401 errors so UIs can show user feedback
    // without crashing on uncaught promise rejections.
    if (error.response?.status !== 401 && typeof window !== "undefined") {
      const msg = TRANSIENT.includes(error.response?.status)
        ? "Server trenutno nedostupan. Pokušaj ponovo za par sekundi."
        : (error.response?.data?.detail || error.message || "Greška u komunikaciji.");
      window.dispatchEvent(new CustomEvent("api-error", { detail: { status: error.response?.status, msg, url: config.url } }));
    }
    
    return Promise.reject(error);
  }
);

export default api;

export const getToken = () => localStorage.getItem("gca_token");
export const setToken = (t) => localStorage.setItem("gca_token", t);
export const clearToken = () => localStorage.removeItem("gca_token");

export const formatEur = (n) => {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(v);
};

export const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("sr-Latn-ME", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};
