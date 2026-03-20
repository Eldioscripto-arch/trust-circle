'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';

interface Circle {
  id: string;
  name: string;
  creator_wallet: string;
  contribution_amount: number;
  cycle_duration_seconds: number;
  max_members: number;
  member_count: number;
  status: string;
  is_public: boolean;
  created_at: string;
  token?: string;
}

function shortWallet(w: string) {
  return `${w.slice(0, 6)}...${w.slice(-4)}`;
}

function formatDuration(s: number) {
  if (s >= 2592000) return `${Math.round(s / 2592000)} mes`;
  if (s >= 604800)  return `${Math.round(s / 604800)} sem`;
  return `${Math.round(s / 86400)} días`;
}

export default function ExplorePage() {
  const router = useRouter();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    fetch('/api/explore')
      .then(r => r.json())
      .then(d => setCircles(d.circles ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = circles.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-28 px-5 pt-5" style={{ background: '#0d1117', color: '#e2e8f0' }}>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="font-black text-lg" style={{ color: '#f0b429', letterSpacing: -0.5 }}>Explorar</h1>
        <span className="ml-auto text-xs px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(240,180,41,0.12)', color: '#f0b429' }}>
          {filtered.length} círculos
        </span>
      </div>

      <div className="relative mb-5">
        <span className="absolute left-3 top-3 text-sm" style={{ color: '#4a5568' }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar círculo..."
          className="w-full rounded-xl pl-9 pr-4 py-3 text-sm outline-none"
          style={{ background: '#161b22', border: '1px solid #2a3441', color: '#e2e8f0' }} />
      </div>

      {loading && <div className="text-center py-16" style={{ color: '#4a5568' }}>Cargando...</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#161b22', border: '1px solid #2a3441' }}>
          <p className="text-2xl mb-3">⬡</p>
          <p className="text-sm" style={{ color: '#718096' }}>No hay círculos públicos abiertos</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map(c => {
          const slots = c.max_members - c.member_count;
          const pct   = Math.round((c.member_count / c.max_members) * 100);
          const net   = c.contribution_amount * c.max_members * 0.99;
          return (
            <div key={c.id} onClick={() => router.push(`/circles/${c.id}`)}
              className="rounded-2xl p-4 cursor-pointer"
              style={{ background: '#161b22', border: '1px solid #2a3441' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-sm">{c.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#718096' }}>por {shortWallet(c.creator_wallet)}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(240,180,41,0.12)', color: '#f0b429' }}>Abierto</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  ['Contribución', `${c.token === '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1' ? '$' : ''}${c.contribution_amount} ${c.token === '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1' ? 'USDC' : c.token === '0x2cFc85d8E48F8EAB294be644d9E25C3030863003' ? 'WLD' : 'AIONICO'}`],
                  ['Pozo neto',    `$${net.toFixed(0)}`],
                  ['Ciclo',        formatDuration(c.cycle_duration_seconds)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl p-2.5" style={{ background: '#1c2330' }}>
                    <p className="text-xs" style={{ color: '#4a5568' }}>{label}</p>
                    <p className="text-sm font-semibold mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs" style={{ color: '#4a5568' }}>{c.member_count}/{c.max_members} miembros</span>
                  <span className="text-xs" style={{ color: slots > 0 ? '#f0b429' : '#68d391' }}>
                    {slots > 0 ? `${slots} slots libres` : 'Lleno'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: '#1c2330' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#f0b429' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
