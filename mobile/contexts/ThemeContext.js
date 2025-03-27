// ThemeContext.js - Theme context for mobile app
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create context
const ThemeContext = createContext();

// Custom hook to use the theme context
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Get system color scheme
  const systemColorScheme = useColorScheme();
  
  // Initialize theme state
  const [theme, setTheme] = useState('system');
  const [loading, setLoading] = useState(true);
  
  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme_preference');
        if (savedTheme) {
          setTheme(savedTheme);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTheme();
  }, []);
  
  // Get the actual theme based on preference and system
  const getActualTheme = () => {
    if (theme === 'system') {
      return systemColorScheme || 'light';
    }
    return theme;
  };
  
  // Set theme explicitly
  const setThemePreference = async (newTheme) => {
    try {
      if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
        setTheme(newTheme);
        await AsyncStorage.setItem('theme_preference', newTheme);
      }
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };
  
  // Toggle between light and dark theme
  const toggleTheme = async () => {
    const newTheme = getActualTheme() === 'dark' ? 'light' : 'dark';
    await setThemePreference(newTheme);
  };
  
  // Calculate actual theme colors
  const actualTheme = getActualTheme();
  
  // Context value
  const value = {
    theme,
    actualTheme,
    isDarkMode: actualTheme === 'dark',
    toggleTheme,
    setTheme: setThemePreference,
    loading,
  };
  
  return (
    <ThemeContext.Provider value={value}>
      {!loading && children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;