/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { setCookie, deleteCookie } from "cookies-next";
import { jwtDecode } from "jwt-decode";
import apiService from "@/lib/api/core";
import { fetchAuth } from "@/lib/api/services/fetchAuth";
import { getAuthCookieConfig } from "@/utils/cookieConfig";
import type { RootState, AppDispatch } from "../store";

export interface User {
  id: string;
  email: string;
  userNname: string;
  role: string[];
}

export interface DecodedToken extends User {
  nbf?: number;
  exp?: number;
  iat?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

let refreshTimer: NodeJS.Timeout | null = null;

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const decodeToken = (token: string): User | null => {
  try {
    const decoded: any = jwtDecode(token);
    if (decoded.role && !Array.isArray(decoded.role)) {
      decoded.role = [decoded.role];
    }
    return decoded as User;
  } catch {
    return null;
  }
};

export const decodeTokenWithExpiry = (token: string): DecodedToken | null => {
  try {
    const decoded: any = jwtDecode(token);
    if (decoded.role && !Array.isArray(decoded.role)) {
      decoded.role = [decoded.role];
    }
    return decoded as DecodedToken;
  } catch {
    return null;
  }
};

export const setupAutoRefresh = (token: string, dispatch: AppDispatch) => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const decoded = decodeTokenWithExpiry(token);
  if (!decoded?.exp) return;

  const refreshTime = decoded.exp * 1000 - Date.now() - 2 * 60 * 1000;

  if (refreshTime <= 0) {
    dispatch(refreshTokenAsync());
    return;
  }

  refreshTimer = setTimeout(() => dispatch(refreshTokenAsync()), refreshTime);
};

export const clearAutoRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
};

export const loginAsync = createAsyncThunk(
  "auth/login",
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await fetchAuth.login(credentials);

      if (response.isSuccess && response.data.accessToken) {
        const { accessToken, refreshToken } = response.data;
        const user = decodeToken(accessToken);

        setCookie("authToken", accessToken, getAuthCookieConfig());
        apiService.setAuthToken(accessToken);

        return { token: accessToken, refreshToken, user };
      }

      return rejectWithValue(response.message || "Login failed");
    } catch (error: any) {
      return rejectWithValue(error.message || "Login failed");
    }
  }
);

export const logoutAsync = createAsyncThunk("auth/logout", async (_, { rejectWithValue }) => {
  try {
    await apiService.post("/api/v1/auth/logout");
    deleteCookie("authToken", { path: "/" });
    apiService.setAuthToken(null);
    clearAutoRefresh();
    return true;
  } catch (error: any) {
    return rejectWithValue(error.message);
  }
});

export const refreshTokenAsync = createAsyncThunk(
  "auth/refreshToken",
  async (_, { rejectWithValue, dispatch, getState }) => {
    try {
      const state = getState() as RootState;
      const { refreshToken } = state.auth;
      if (!refreshToken) return rejectWithValue("No refresh token");

      const response = await apiService.post<{
        isSuccess: boolean;
        data: { accessToken: string; refreshToken: string };
      }>("/api/v1/auth/refresh-token", { refreshToken });

      if (response.data.isSuccess && response.data.data.accessToken) {
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        const user = decodeToken(accessToken);

        setCookie("authToken", accessToken, getAuthCookieConfig());
        apiService.setAuthToken(accessToken);

        setupAutoRefresh(accessToken, dispatch as AppDispatch);

        return { token: accessToken, refreshToken: newRefreshToken, user };
      }

      return rejectWithValue("Refresh failed");
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setTokenWithRefresh: (
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string }>
    ) => {
      state.token = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      apiService.setAuthToken(action.payload.accessToken);
      const user = decodeToken(action.payload.accessToken);
      if (user) {
        state.user = user;
        state.isAuthenticated = true;
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
      deleteCookie("authToken", { path: "/" });
      apiService.setAuthToken(null);
      clearAutoRefresh();
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken ?? null;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    builder.addCase(logoutAsync.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    });

    builder
      .addCase(refreshTokenAsync.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
      })
      .addCase(refreshTokenAsync.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      });
  },
});

export const { setTokenWithRefresh, logout, clearError } = authSlice.actions;

export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectAuthToken = (state: RootState) => state.auth.token;

export default authSlice.reducer;
