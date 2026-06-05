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
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200 z-50 safe-area-bottom">
      <div className="max-w-lg mx-auto flex">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex-1 flex flex-col items-center py-2 pt-3 transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <Icon name={item.icon} size={22} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
