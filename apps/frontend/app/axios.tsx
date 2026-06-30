import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080",
  // headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/"
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
