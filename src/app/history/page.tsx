'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { BottomNav } from '@/components/BottomNav';

interface Event {
  id: string;
  circle_id: string;
  event_type: string;
  created_at: string;
  circles?: { name: string };
}

const EVENT_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  joined:      { icon: '🤝', label: 'Te uniste',           color: '#63b3ed' },
  contributed: { icon: '💸', label: 'Contribución pagada', color: '#68d391' },
  received:    { icon: '🎉', label: 'Recibiste el pozo',   color: '#f0b429' },
  defaulted:   { icon: '⚠️', label: 'Incumplimiento',      color: '#fc8181' },
  completed:   { icon: '✅', label: 'Círculo completado',  color: '#68d391' },
  created:     { icon: '⬡',  label: 'Creaste un círculo',  color: '#b794f4' },
};

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

  return (
    <div className="min-h-screen pb-28 px-5 pt-5" style={{ background: '#0d1117', color: '#e2e8f0' }}>
      <div className="flex items-center mb-5">
        <h1 className="font-black text-lg" style={{ color: '#f0b429', letterSpacing: -0.5 }}>Historial</h1>
      </div>

      {loading && <div className="text-center py-16" style={{ color: '#4a5568' }}>Cargando...</div>}

      {!loading && events.length === 0 && (
        <div className="text-center py-16 rounded-2xl" style={{ background: '#161b22', border: '1px solid #2a3441' }}>
          <p className="text-3xl mb-3">📊</p>
          <p className="text-sm" style={{ color: '#718096' }}>Sin actividad todavía</p>
          <p className="text-xs mt-1" style={{ color: '#4a5568' }}>Acá vas a ver tu historial de círculos</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {events.map(ev => {
          const cfg = EVENT_LABELS[ev.event_type] ?? { icon: '•', label: ev.event_type, color: '#718096' };
          return (
            <div key={ev.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: '#161b22', border: '1px solid #2a3441' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: '#1c2330' }}>{cfg.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: cfg.color }}>{cfg.label}</p>
                {ev.circles?.name && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#718096' }}>{ev.circles.name}</p>
                )}
              </div>
              <p className="text-xs flex-shrink-0" style={{ color: '#4a5568' }}>{formatDate(ev.created_at)}</p>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
