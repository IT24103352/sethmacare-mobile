import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import client from '../api/client';

const AuthContext = createContext(null);

const TOKEN_KEY = 'userToken';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = useCallback(async (credentials) => {
    setIsLoading(true);

    try {
      const response = await client.post('/auth/login', credentials);
      const { token: apiToken, user: apiUser } = response.data;

      await SecureStore.setItemAsync(TOKEN_KEY, apiToken);
      setToken(apiToken);
      setUser(apiUser);

      return response.data;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload) => {
    const response = await client.post('/auth/register', payload);
    return response.data;
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const response = await client.patch('/auth/me', payload);
    setUser(response.data.user);
    return response.data;
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const checkToken = useCallback(async () => {
    setIsLoading(true);

    try {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);

      if (!storedToken) {
        setToken(null);
        setUser(null);
        return;
      }

      setToken(storedToken);
      const response = await client.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkToken();
  }, [checkToken]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      register,
      updateProfile,
      logout,
      checkToken,
      isAuthenticated: Boolean(user && token),
    }),
    [user, token, isLoading, login, register, updateProfile, logout, checkToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }

  return context;
};

export default AuthContext;
