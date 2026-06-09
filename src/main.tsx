import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'

// Detect and apply initial theme before React renders (prevents flash)
const storedTheme = (() => {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
})();
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
const initialTheme = storedTheme === 'dark' || ((storedTheme === 'system' || !storedTheme) && prefersDark) ? 'dark' : 'light';
document.documentElement.setAttribute('data-theme', initialTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
