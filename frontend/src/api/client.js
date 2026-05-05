import axios from "axios";
import * as SecureStore from "expo-secure-store";

const DEFAULT_API_BASE_URL = "https://sethmacare-backend.onrender.com/api";
const API_TIMEOUT_MS = 60000;

const configuredBaseURL =
  typeof process !== "undefined"
    ? process.env?.EXPO_PUBLIC_API_BASE_URL
    : undefined;

const baseURL = configuredBaseURL || DEFAULT_API_BASE_URL;

const client = axios.create({
  baseURL,
  timeout: API_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync("userToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401 || status === 403) {
      console.warn(
        `SethmaCare API authorization warning: received ${status}. Token may be expired or role access may be forbidden.`,
      );
    }

    return Promise.reject(error);
  },
);

export default client;
