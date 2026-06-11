// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeProvider, ThemeContext } from '../../src/contexts/ThemeContext';
import { useContext } from 'react';

// jsdom 不支持 matchMedia，需要 mock
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

function ThemeConsumer() {
  const ctx = useContext(ThemeContext)!;
  return (
    <div>
      <span data-testid="theme">{ctx.theme}</span>
      <span data-testid="actual">{ctx.actualTheme}</span>
      <span data-testid="palette">{ctx.palette}</span>
      <button data-testid="toggle" onClick={ctx.toggleTheme}>toggle</button>
      <button data-testid="set-dark" onClick={() => ctx.setTheme('dark')}>dark</button>
      <button data-testid="set-light" onClick={() => ctx.setTheme('light')}>light</button>
      <button data-testid="set-system" onClick={() => ctx.setTheme('system')}>system</button>
      <button data-testid="set-palette" onClick={() => ctx.setPalette('ocean')}>ocean</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ThemeProvider>
      <ThemeConsumer />
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-palette');
});

afterEach(() => {
  cleanup();
});

describe('ThemeContext', () => {
  describe('初始状态', () => {
    it('默认主题为 system', () => {
      renderWithProvider();
      expect(screen.getByTestId('theme').textContent).toBe('system');
    });

    it('默认配色为 copper', () => {
      renderWithProvider();
      expect(screen.getByTestId('palette').textContent).toBe('copper');
    });

    it('从 localStorage 恢复主题', () => {
      localStorage.setItem('theme', 'dark');
      renderWithProvider();
      expect(screen.getByTestId('theme').textContent).toBe('dark');
      expect(screen.getByTestId('actual').textContent).toBe('dark');
    });

    it('从 localStorage 恢复配色', () => {
      localStorage.setItem('color_palette', 'ocean');
      renderWithProvider();
      expect(screen.getByTestId('palette').textContent).toBe('ocean');
    });
  });

  describe('actualTheme 解析', () => {
    it('system 模式跟随系统偏好', () => {
      renderWithProvider();
      const actual = screen.getByTestId('actual').textContent;
      expect(['light', 'dark']).toContain(actual);
    });

    it('显式 dark → actualTheme 为 dark', () => {
      localStorage.setItem('theme', 'dark');
      renderWithProvider();
      expect(screen.getByTestId('actual').textContent).toBe('dark');
    });

    it('显式 light → actualTheme 为 light', () => {
      localStorage.setItem('theme', 'light');
      renderWithProvider();
      expect(screen.getByTestId('actual').textContent).toBe('light');
    });
  });

  describe('setTheme', () => {
    it('切换主题并持久化到 localStorage', () => {
      renderWithProvider();
      fireEvent.click(screen.getByTestId('set-dark'));
      expect(screen.getByTestId('theme').textContent).toBe('dark');
      expect(localStorage.getItem('theme')).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('在 light 和 dark 之间切换', () => {
      localStorage.setItem('theme', 'light');
      renderWithProvider();
      fireEvent.click(screen.getByTestId('toggle'));
      expect(screen.getByTestId('theme').textContent).toBe('dark');
      fireEvent.click(screen.getByTestId('toggle'));
      expect(screen.getByTestId('theme').textContent).toBe('light');
    });
  });

  describe('setPalette', () => {
    it('切换配色并持久化', () => {
      renderWithProvider();
      fireEvent.click(screen.getByTestId('set-palette'));
      expect(screen.getByTestId('palette').textContent).toBe('ocean');
      expect(localStorage.getItem('color_palette')).toBe('ocean');
    });
  });

  describe('DOM 属性同步', () => {
    it('设置 data-theme 属性', () => {
      renderWithProvider();
      fireEvent.click(screen.getByTestId('set-dark'));
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('设置 data-palette 属性', () => {
      renderWithProvider();
      fireEvent.click(screen.getByTestId('set-palette'));
      expect(document.documentElement.getAttribute('data-palette')).toBe('ocean');
    });
  });
});
