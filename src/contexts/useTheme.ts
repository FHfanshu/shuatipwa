import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';
import type { Theme } from './ThemeContext';
import type { ColorPalette } from './themeConstants';

export type { Theme, ColorPalette };

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
