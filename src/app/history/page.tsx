'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BottomNav } from '@/components/BottomNav';
import {
  HandCard, MultiplePages, StatsReport,
  CheckCircle, WarningTriangle, XmarkCircle, Hexagon
} from 'iconoir-react';

interface Event {
  circle_id: string;
  position: number;
  joined_at: string;
  circles?: { name: string; status: string; contribution_amount: number; token: string; max_members: number };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HistoryPage() {
  const { data: session } = useSession();
  const [events,  setEvents]  = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch('/api/history')
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  function getStatusCfg(status: string) {
    if (status === 'cancelled')  return { Icon: XmarkCircle,   label: 'Cancelado',  color: '#fc8181' };
    if (status === 'active')     return { Icon: MultiplePages,  label: 'Activo',     color: '#68d391' };
    if (status === 'completed')  return { Icon: CheckCircle,   label: 'Completado', color: '#f0b429' };
    return                              { Icon: HandCard,       label: 'Abierto',    color: '#63b3ed' };
  }

  return (
    <div className="min-h-screen pb-28 px-5 pt-5" style={{ background: '#0d1117', color: '#e2e8f0' }}>
      <div className="flex items-center mb-5">
        <h1 className="font-black text-lg" style={{ color: '#f0b429', letterSpacing: -0.5 }}>Historial</h1>
      </div>

      {loading && <div className="text-center py-16" style={{ color: '#4a5568' }}>Cargando...</div>}

      {!loading && events.length === 0 && (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#161b22', border: '1px solid #2a3441' }}>
          <StatsReport width={36} height={36} style={{ color: '#4a5568', margin: '0 auto 12px' }} />
          <p className="text-sm" style={{ color: '#718096' }}>Sin actividad todavía</p>
          <p className="text-xs mt-1" style={{ color: '#4a5568' }}>Acá vas a ver tu historial de círculos</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {events.map((ev, i) => {
          const status = ev.circles?.status ?? 'open';
          const { Icon, label, color } = getStatusCfg(status);
          return (
            <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: '#161b22', border: '1px solid #2a3441' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#1c2330' }}>
                <Icon width={20} height={20} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color }}>{ev.circles?.name ?? 'Circulo'}</p>
                <p className="text-xs mt-0.5" style={{ color: '#718096' }}>{label} · Turno #{ev.position + 1}</p>
              </div>
              <p className="text-xs flex-shrink-0" style={{ color: '#4a5568' }}>{formatDate(ev.joined_at)}</p>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
