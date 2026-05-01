import axios from "axios";
import * as SecureStore from "expo-secure-store";

// We changed this line to use your computer's exact Wi-Fi IP address
// so your physical phone can talk to your computer!
const baseURL = "http://192.168.8.100:5000/api";

const client = axios.create({
  baseURL,
  timeout: 15000,
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
