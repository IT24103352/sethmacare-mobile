import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { dark, light } from '../theme/colors';

const ThemeContext = createContext(null);
const THEME_KEY = 'sethmacareTheme';
const themes = { light, dark };

const getSystemTheme = () => (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');

const normalizeTheme = (value) => (value === 'dark' || value === 'light' ? value : null);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getSystemTheme);

  useEffect(() => {
    let isMounted = true;

    const loadThemePreference = async () => {
      try {
        const storedTheme = normalizeTheme(await SecureStore.getItemAsync(THEME_KEY));

        if (storedTheme && isMounted) {
          setThemeState(storedTheme);
        }
      } catch (error) {
        console.warn(`Unable to load theme preference: ${error.message}`);
      }
    };

    loadThemePreference();

    return () => {
      isMounted = false;
    };
  }, []);

  const setTheme = useCallback(async (nextTheme) => {
    const normalizedTheme = normalizeTheme(nextTheme);

    if (!normalizedTheme) {
      return;
    }

    setThemeState(normalizedTheme);

    try {
      await SecureStore.setItemAsync(THEME_KEY, normalizedTheme);
    } catch (error) {
      console.warn(`Unable to save theme preference: ${error.message}`);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

      SecureStore.setItemAsync(THEME_KEY, nextTheme).catch((error) => {
        console.warn(`Unable to save theme preference: ${error.message}`);
      });

      return nextTheme;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      colors: themes[theme],
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider.');
  }

  return context;
};

export default ThemeContext;
