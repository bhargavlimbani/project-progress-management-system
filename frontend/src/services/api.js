import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const STORAGE = {
  token: "sapms_token",
  refresh: "sapms_refresh",
  user: "sapms_user",
};

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE.token);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Refresh-token handling. Concurrent 401s share a single refresh call so a
 * dashboard firing six requests at once doesn't trigger six refreshes.
 */
let refreshPromise = null;

function clearSession() {
  localStorage.removeItem(STORAGE.token);
  localStorage.removeItem(STORAGE.refresh);
  localStorage.removeItem(STORAGE.user);
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Never try to refresh the refresh call itself.
    if (status !== 401 || original?._retry || original?.url?.includes("/auth/refresh")) {
      return Promise.reject(error);
    }

    original._retry = true;
    const refreshToken = localStorage.getItem(STORAGE.refresh);

    if (!refreshToken) {
      clearSession();
      if (window.location.pathname !== "/") window.location.href = "/";
      return Promise.reject(error);
    }

    try {
      refreshPromise =
        refreshPromise ||
        axios
          .post(`${BASE_URL}/auth/refresh`, { refreshToken })
          .then(({ data }) => {
            localStorage.setItem(STORAGE.token, data.accessToken);
            return data.accessToken;
          })
          .finally(() => {
            refreshPromise = null;
          });

      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      clearSession();
      if (window.location.pathname !== "/") window.location.href = "/";
      return Promise.reject(refreshError);
    }
  }
);

export { STORAGE, clearSession };
export default api;
