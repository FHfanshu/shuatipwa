import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';

const navItems = [
  { path: '/', icon: 'book', label: '题库' },
  { path: '/import', icon: 'import', label: '导入' },
  { path: '/settings', icon: 'settings', label: '设置' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-glass/95 backdrop-blur-2xl border-t border-border-subtle">
      <div className="max-w-3xl mx-auto grid grid-cols-3">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center justify-center gap-1 py-3 transition-all active:scale-[0.98] ${
                isActive ? 'text-copper' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-copper" />}
              <Icon name={item.icon} size={22} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
