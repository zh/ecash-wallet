import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { themeAtom } from '../atoms';
import PropTypes from 'prop-types';

const ThemeProvider = ({ children }) => {
  const [theme] = useAtom(themeAtom);

  useEffect(() => {
    // Apply theme to document root on mount and theme change
    document.documentElement.setAttribute('data-theme', theme);

    // Also apply theme class to body for any global styles that need it
    document.body.className = `theme-${theme}`;

    // Set meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
    } else {
      // Create meta theme-color if it doesn't exist
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = theme === 'dark' ? '#000000' : '#ffffff';
      document.head.appendChild(meta);
    }
  }, [theme]);

  // Initialize theme on first load - use ecash-wallet-theme key
  useEffect(() => {
    // This ensures the theme is applied immediately on app load
    const initialTheme = localStorage.getItem('ecash-wallet-theme') || 'light';
    document.documentElement.setAttribute('data-theme', initialTheme);
    document.body.className = `theme-${initialTheme}`;
  }, []);

  return children;
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ThemeProvider;