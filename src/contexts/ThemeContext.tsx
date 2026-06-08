import { createContext, useEffect, useState, useMemo, useCallback, type ReactNode } from 'react';
import type { ColorPalette } from './themeConstants';
import { PALETTE_PREVIEW } from './themeConstants';

export type { ColorPalette } from './themeConstants';

export type Theme = 'light' | 'dark' | 'system';
type ActualTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  actualTheme: ActualTheme;
  palette: ColorPalette;
  setTheme: (theme: Theme) => void;
  setPalette: (palette: ColorPalette) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export { ThemeContext };

const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme;
    return stored || 'system';
  });

  const [palette, setPaletteState] = useState<ColorPalette>(() => {
    const stored = localStorage.getItem('color_palette') as ColorPalette;
    return stored || 'copper';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const actualTheme: ActualTheme = useMemo(() => {
    if (theme === 'system') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemPrefersDark]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', actualTheme);
    document.documentElement.setAttribute('data-palette', palette);

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const preview = PALETTE_PREVIEW[palette];
      metaTheme.setAttribute('content', actualTheme === 'dark' ? preview.dark : preview.light);
    }
  }, [actualTheme, palette]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  const setPalette = useCallback((newPalette: ColorPalette) => {
    setPaletteState(newPalette);
    localStorage.setItem('color_palette', newPalette);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(actualTheme === 'light' ? 'dark' : 'light');
  }, [actualTheme, setTheme]);

  const contextValue = useMemo(() => ({
    theme,
    actualTheme,
    palette,
    setTheme,
    setPalette,
    toggleTheme,
  }), [theme, actualTheme, palette, setTheme, setPalette, toggleTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export { ThemeProvider };
