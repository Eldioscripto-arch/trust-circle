'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { id: 'home',    path: '/',        icon: '⬡',  label: 'Inicio'   },
  { id: 'explore', path: '/explore', icon: '🔍', label: 'Explorar' },
  { id: 'history', path: '/history', icon: '📊', label: 'Historial'},
  { id: 'profile', path: '/profile', icon: '👤', label: 'Perfil'   },
];

export function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 flex"
      style={{
        background:     'rgba(13,17,23,0.95)',
        backdropFilter: 'blur(12px)',
        borderTop:      '1px solid #2a3441',
        paddingBottom:  20,
        zIndex: 99,
      }}
    >
      {TABS.map(tab => {
        const active = tab.path === '/'
          ? pathname === '/'
          : pathname.startsWith(tab.path);
        return (
          <div
            key={tab.id}
            onClick={() => router.push(tab.path)}
            className="flex-1 flex flex-col items-center gap-1 pt-2.5 cursor-pointer"
          >
            <span style={{ fontSize: 20, opacity: active ? 1 : 0.4 }}>{tab.icon}</span>
            <span className="text-xs" style={{ color: active ? '#f0b429' : '#4a5568' }}>
              {tab.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
