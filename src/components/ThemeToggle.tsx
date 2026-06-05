import { useTheme } from '../contexts/ThemeContext';
import Icon from './Icon';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { actualTheme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`grid h-10 w-10 place-items-center rounded-xl p-0 text-text-muted hover:text-copper hover:bg-copper-glow active:scale-95 transition-all ${className}`}
      aria-label={`Switch to ${actualTheme === 'light' ? 'dark' : 'light'} mode`}
    >
      <Icon
        name={actualTheme === 'light' ? 'moon' : 'sun'}
        size={20}
        className="text-text-secondary"
      />
    </button>
  );
}
