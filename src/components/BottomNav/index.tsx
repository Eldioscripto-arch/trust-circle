'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, StatsReport, User } from 'iconoir-react';

const TABS = [
  { id: 'home',    path: '/',        icon: Home,        label: 'Inicio'   },
  { id: 'explore', path: '/explore', icon: Search,      label: 'Explorar' },
  { id: 'history', path: '/history', icon: StatsReport, label: 'Historial'},
  { id: 'profile', path: '/profile', icon: User,        label: 'Perfil'   },
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
        const Icon = tab.icon;
        return (
          <div
            key={tab.id}
            onClick={() => router.push(tab.path)}
            className="flex-1 flex flex-col items-center gap-1 pt-2.5 cursor-pointer"
          >
            <Icon
              width={22}
              height={22}
              style={{ opacity: active ? 1 : 0.4, color: active ? '#f0b429' : '#4a5568' }}
            />
            <span className="text-xs" style={{ color: active ? '#f0b429' : '#4a5568' }}>
              {tab.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
