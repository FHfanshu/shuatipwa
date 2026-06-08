import { useState, useEffect } from 'react';

export default function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/95 text-white text-center py-2 px-4 text-sm font-medium backdrop-blur-sm shadow-lg animate-pulse">
      当前离线，题库和练习可正常使用，AI 解析不可用
    </div>
  );
}
