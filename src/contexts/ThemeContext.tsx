import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
type ActualTheme = 'light' | 'dark';
export type ColorPalette = 'copper' | 'ocean' | 'forest' | 'lavender' | 'rose' | 'slate';

interface ThemeContextType {
  theme: Theme;
  actualTheme: ActualTheme;
  palette: ColorPalette;
  setTheme: (theme: Theme) => void;
  setPalette: (palette: ColorPalette) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const PALETTE_LABELS: Record<ColorPalette, string> = {
  copper: '琥珀',
  ocean: '海洋',
  forest: '森林',
  lavender: '薰衣草',
  rose: '玫瑰',
  slate: '石板',
};

export const PALETTE_PREVIEW: Record<ColorPalette, { light: string; accent: string; dark: string; darkAccent: string }> = {
  copper: { light: '#faf8f5', accent: '#b87333', dark: '#0f0e0c', darkAccent: '#d4956a' },
  ocean:  { light: '#f5f8fc', accent: '#2563eb', dark: '#0a0f1a', darkAccent: '#60a5fa' },
  forest: { light: '#f5faf6', accent: '#1a7a4c', dark: '#0a120e', darkAccent: '#5cc88a' },
  lavender: { light: '#f8f5fc', accent: '#7c3aed', dark: '#0e0a14', darkAccent: '#a78bfa' },
  rose:   { light: '#fcf5f7', accent: '#d94070', dark: '#140a0e', darkAccent: '#f472b6' },
  slate:  { light: '#f6f7f9', accent: '#475569', dark: '#0c0d10', darkAccent: '#94a3b8' },
};

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

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const setPalette = (newPalette: ColorPalette) => {
    setPaletteState(newPalette);
    localStorage.setItem('color_palette', newPalette);
  };

  const toggleTheme = () => {
    setTheme(actualTheme === 'light' ? 'dark' : 'light');
  };

  const contextValue = useMemo(() => ({
    theme,
    actualTheme,
    palette,
    setTheme,
    setPalette,
    toggleTheme,
  }), [theme, actualTheme, palette]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export { ThemeProvider };

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
