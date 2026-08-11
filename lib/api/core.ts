/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { deleteCookie } from "cookies-next";

let store: any;
export const injectStore = (_store: any) => {
  store = _store;
};

export function getAuthToken(): string | null {
  try {
    return store?.getState()?.auth?.token ?? null;
  } catch {
    return null;
  }
}

export interface ApiError {
  code?: number;
  message: string;
  status: boolean;
  data?: unknown;
  /** true khi request bị hủy do vượt axios `timeout` — không có nghĩa là backend thất bại. */
  isTimeout?: boolean;
  /** true khi request không nhận được response nào (mất mạng/proxy cắt) — cũng không có nghĩa backend thất bại. */
  isNetworkError?: boolean;
}

export interface RequestParams {
  [key: string]: string | number | boolean | undefined | null | string[];
}

class ApiService {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }> = [];

  constructor(baseURL: string, timeout = 600000) {
    this.client = axios.create({
      baseURL,
      timeout,
      headers: { "Content-Type": "application/json" },
    });
    this.setupInterceptors();
  }

  private processQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach((prom) => {
      if (error) prom.reject(error);
      else prom.resolve(token!);
    });
    this.failedQueue = [];
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        const token = store?.getState()?.auth?.token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
        if (config.data instanceof FormData) delete config.headers["Content-Type"];
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers["Authorization"] = "Bearer " + token;
                return this.client(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = store?.getState()?.auth?.refreshToken;
            if (!refreshToken) throw new Error("No refresh token");

            const response = await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL}api/v1/auth/refresh-token`,
              { refreshToken },
              { headers: { "Content-Type": "application/json" } }
            );

            if (response.data?.data?.accessToken) {
              const { accessToken, refreshToken: newRefreshToken } = response.data.data;

              const { setTokenWithRefresh } = await import("@/lib/redux/slices/authSlice");
              const { setCookie } = await import("cookies-next");
              const { getAuthCookieConfig } = await import("@/utils/cookieConfig");

              if (store)
                store.dispatch(setTokenWithRefresh({ accessToken, refreshToken: newRefreshToken }));
              setCookie("authToken", accessToken, getAuthCookieConfig());
              this.setAuthToken(accessToken);

              this.processQueue(null, accessToken);
              this.isRefreshing = false;

              originalRequest.headers["Authorization"] = "Bearer " + accessToken;
              return this.client(originalRequest);
            }

            throw new Error("Invalid refresh response");
          } catch (refreshError) {
            this.isRefreshing = false;
            this.processQueue(refreshError, null);

            deleteCookie("authToken", { path: "/" });
            if (store) {
              import("@/lib/redux/slices/authSlice").then(({ logout }) => {
                store.dispatch(logout());
              });
            }

            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("logout"));
            }

            return Promise.reject({
              code: 401,
              message: "Session expired. Please login again.",
              status: false,
            } as ApiError);
          }
        }

        const apiError: ApiError = {
          code: error.response?.status,
          message: error.response?.data?.message || error.message || "Có lỗi xảy ra",
          status: false,
          data: error.response?.data,
          isTimeout: error.code === "ECONNABORTED",
          isNetworkError: !error.response && error.code !== "ECONNABORTED",
        };

        return Promise.reject(apiError);
      }
    );
  }

  setAuthToken(token: string | null) {
    if (token) {
      this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common.Authorization;
    }
  }

  async request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.request<T>(config);
  }

  async get<T>(
    url: string,
    params?: Record<string, any>,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: "GET", url, params });
  }

  async post<T, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: "POST", url, data });
  }

  async put<T, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: "PUT", url, data });
  }

  async patch<T, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: "PATCH", url, data });
  }

  async delete<T>(url: string): Promise<AxiosResponse<T>> {
    return this.request<T>({ method: "DELETE", url });
  }

  async upload<T>(
    url: string,
    formData: FormData,
    onProgress?: (progress: number) => void
  ): Promise<AxiosResponse<T>> {
    return this.request<T>({
      method: "POST",
      url,
      data: formData,
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });
  }
}

import { resolveApiBaseUrl } from "./resolve-api-base-url";

const apiService = new ApiService(resolveApiBaseUrl());

export default apiService;
