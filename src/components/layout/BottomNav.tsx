import { NavLink, useLocation } from 'react-router-dom';

const tabs = [
  { to: '/', icon: '💬', label: 'Chat' },
  { to: '/data', icon: '📈', label: 'Data' },
  { to: '/plans', icon: '📋', label: 'Plans' },
  { to: '/exercises', icon: '🏋️', label: 'Exercises' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="flex items-center justify-around bg-slate-900 border-t border-slate-800 safe-bottom h-16 shrink-0">
      {tabs.map((tab) => {
        const isActive = tab.to === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(tab.to);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              isActive ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
