import axios, { type InternalAxiosRequestConfig, type AxiosError } from "axios";

export interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _triedRefresh?: boolean;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;
    if (!originalRequest) return Promise.reject(error);
    if (originalRequest.url?.includes("/api/v1/auth/refresh")) {
      if (!["/login", "/"].includes(window.location.pathname)) {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && !originalRequest._triedRefresh) {
      originalRequest._triedRefresh = true;

      try {
        await api.post("/api/v1/auth/refresh");
        return api(originalRequest);
      } catch (refreshError) {
        if (typeof window !== "undefined") {
          if (!["/login", "/"].includes(window.location.pathname)) {
            if (window.location.pathname !== "/")
              window.location.href = "/login";
          }
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
