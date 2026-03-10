'use client';

import { useSession } from 'next-auth/react';
import { AuthButton } from '@/components/AuthButton';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type CircleStatus = 'pending' | 'paid' | 'open';

interface Circle {
  id: string;
  name: string;
  members: number;
  maxMembers: number;
  contribution: number;
  currency: string;
  cycle: number;
  totalCycles: number;
  daysLeft: number;
  hoursLeft?: number;
  paidCount: number;
  status: CircleStatus;
  poolAmount: number;
}

function Badge({ status }: { status: CircleStatus }) {
  const cfg = {
    pending: { bg: 'rgba(229,62,62,0.15)', color: '#fc8181', label: 'Pagar ahora' },
    paid:    { bg: 'rgba(56,161,105,0.15)', color: '#68d391', label: '✓ Pagado' },
    open:    { bg: 'rgba(113,128,150,0.15)', color: '#718096', label: 'Abierto' },
  }[status];
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0"
      style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
  );
}

function CircleCard({ circle }: { circle: Circle }) {
  const progress = circle.status === 'open' ? (circle.members / circle.maxMembers) * 100
    : circle.status === 'pending' ? 87 : 22;
  const barColor = circle.status === 'pending' ? '#e53e3e' : circle.status === 'paid' ? '#38a169' : '#f0b429';
  const timeLabel = circle.status === 'pending' ? `${circle.hoursLeft}h restantes`
    : circle.status === 'paid' ? `${circle.daysLeft} días restantes` : `${circle.maxMembers - circle.members} slots libres`;
  const timeColor = circle.status === 'pending' ? '#fc8181' : '#718096';
  return (
    <div className="rounded-2xl p-4 cursor-pointer" style={{ background: '#161b22',
      border: `1px solid ${circle.status === 'pending' ? 'rgba(229,62,62,0.4)' : circle.status === 'paid' ? 'rgba(56,161,105,0.3)' : '#2a3441'}`,
      borderTopWidth: 2, borderTopColor: circle.status === 'pending' ? '#e53e3e' : circle.status === 'paid' ? '#38a169' : '#2a3441' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-sm" style={{ color: '#e2e8f0' }}>{circle.name}</p>
          <p className="text-xs mt-0.5" style={{ color: '#718096' }}>{circle.members}/{circle.maxMembers} miembros · ${circle.contribution} USDC/ciclo</p>
        </div>
        <Badge status={circle.status} />
      </div>
      <div className="mb-3">
        <div className="flex justify-between mb-1.5">
          <span className="text-xs" style={{ color: '#4a5568' }}>{circle.status === 'open' ? 'Esperando miembros' : `Ciclo ${circle.cycle} de ${circle.totalCycles}`}</span>
          <span className="text-xs" style={{ color: timeColor }}>{timeLabel}</span>
        </div>
        <div className="h-1 rounded-full" style={{ background: '#1c2330' }}>
          <div className="h-full rounded-full" style={{ width: `${progress}%`, background: barColor }} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(circle.maxMembers, 10) }).map((_, i) => (
              <div key={i} className="w-2 h-2 rounded-full" style={{ background: i < circle.paidCount ? '#38a169' : '#2a3441' }} />
            ))}
          </div>
          <span className="text-xs" style={{ color: '#718096' }}>
            {circle.status === 'open' ? `${circle.members}/${circle.maxMembers} unidos` : `${circle.paidCount}/${circle.members} pagaron`}
          </span>
        </div>
        <span className="font-bold text-sm" style={{ color: '#f0b429' }}>
          {circle.status === 'open' ? 'Invitar →' : `$${circle.poolAmount} en pozo`}
        </span>
      </div>
    </div>
  );
}

function CelebrationScreen({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50" style={{ background: 'rgba(13,17,23,0.97)' }}>
      <div className="text-6xl">🎉</div>
      <p className="mt-5 text-xs uppercase tracking-widest" style={{ color: '#f0b429' }}>¡Recibiste el pozo!</p>
      <p className="font-black mt-2" style={{ fontSize: 56, letterSpacing: -3, color: '#e2e8f0' }}>
        <span style={{ fontSize: 24, color: '#2775ca', verticalAlign: 'super' }}>$</span>350.00
      </p>
      <p className="text-base mt-1.5" style={{ color: '#718096' }}>Ciclo completado</p>
      <button onClick={onClose} className="mt-8 px-12 py-4 rounded-2xl font-bold text-black"
        style={{ background: '#f0b429', fontSize: 15 }}>Ver mi balance ✦</button>
    </div>
  );
}

export default function Home() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showCelebration, setShowCelebration] = useState(false);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;

    // Registrar usuario al hacer login
    fetch('/api/users', { method: 'POST' }).catch(() => {});

    // Cargar círculos reales
    setLoading(true);
    fetch('/api/circles')
      .then(r => r.json())
      .then(data => {
        if (data.circles && data.circles.length > 0) {
          const mapped: Circle[] = data.circles.map((item: any) => {
            const c = item.circles;
            const now = Date.now();
            const cycleEnd = c.cycle_start_time
              ? new Date(c.cycle_start_time).getTime() + c.cycle_duration_seconds * 1000
              : now;
            const msLeft = cycleEnd - now;
            const daysLeft = Math.max(0, Math.floor(msLeft / 86400000));
            const hoursLeft = Math.max(0, Math.floor((msLeft % 86400000) / 3600000));

            let status: CircleStatus = 'open';
            if (c.status === 'active') status = daysLeft === 0 ? 'pending' : 'paid';

            return {
              id: c.id,
              name: c.name,
              members: c.member_count,
              maxMembers: c.max_members,
              contribution: Number(c.contribution_amount),
              currency: 'USDC',
              cycle: c.current_cycle,
              totalCycles: c.max_members,
              daysLeft,
              hoursLeft,
              paidCount: 0,
              status,
              poolAmount: c.member_count * Number(c.contribution_amount),
            };
          });
          setCircles(mapped);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  const totalSaved = circles.reduce((sum, c) => sum + c.poolAmount, 0);
  const activeCount = circles.filter(c => c.status !== 'open').length;
  const pendingCircle = circles.find(c => c.status === 'pending');

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-8" style={{ background: '#0d1117' }}>
        <div className="text-center">
          <h1 className="font-black text-3xl" style={{ color: '#f0b429', letterSpacing: -1 }}>
            Trust<span style={{ color: '#718096', fontWeight: 400 }}>Circle</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#4a5568' }}>Círculos de ahorro verificados</p>
          <p className="mt-1 text-xs" style={{ color: '#2a3441' }}>by AIONICA Labs</p>
        </div>
        <AuthButton />
      </div>
    );
  }

  return (
    <>
      {showCelebration && <CelebrationScreen onClose={() => setShowCelebration(false)} />}
      <div className="min-h-screen pb-28" style={{ background: '#0d1117' }}>

        <div className="flex items-center justify-between px-5 pt-5">
          <h1 className="font-black text-lg" style={{ color: '#f0b429', letterSpacing: -0.5 }}>
            Trust<span style={{ color: '#718096', fontWeight: 400 }}>Circle</span>
          </h1>
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-black"
            style={{ background: 'linear-gradient(135deg, #f0b429, #ed8936)' }}>
            {session.user?.name?.slice(2, 4).toUpperCase() || 'TC'}
          </div>
        </div>

        {pendingCircle && (
          <div className="mx-5 mt-4 rounded-xl border px-4 py-3 flex items-center gap-3 cursor-pointer"
            style={{ background: 'rgba(229,62,62,0.10)', borderColor: 'rgba(229,62,62,0.35)' }}
            onClick={() => setShowCelebration(true)}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#e53e3e' }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: '#fc8181' }}>Pago pendiente hoy</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(252,129,129,0.7)' }}>
                {pendingCircle.name} · cierra en {pendingCircle.hoursLeft}h · ${pendingCircle.contribution} USDC
              </p>
            </div>
            <span style={{ color: '#fc8181', fontSize: 18 }}>›</span>
          </div>
        )}

        <div className="mx-5 mt-4 rounded-2xl p-6" style={{ background: '#161b22', border: '1px solid #2a3441' }}>
          <p className="text-xs uppercase tracking-widest" style={{ color: '#718096' }}>Total en círculos</p>
          <div className="mt-2 leading-none">
            <span className="text-lg font-semibold align-super" style={{ color: '#2775ca' }}>$</span>
            <span className="font-black" style={{ fontSize: 42, letterSpacing: -2, color: '#e2e8f0' }}>
              {loading ? '...' : totalSaved.toLocaleString()}
            </span>
          </div>
          <div className="mt-4 flex gap-5">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase" style={{ color: '#4a5568', letterSpacing: 1 }}>Círculos activos</span>
              <span className="text-sm font-semibold" style={{ color: '#f0b429' }}>{activeCount}</span>
            </div>
            <div style={{ width: 1, background: '#2a3441' }} />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase" style={{ color: '#4a5568', letterSpacing: 1 }}>Total círculos</span>
              <span className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{circles.length}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 mt-6 mb-3">
          <h2 className="font-bold text-base" style={{ color: '#e2e8f0' }}>Mis círculos</h2>
          <span className="text-xs cursor-pointer" style={{ color: '#f0b429' }}>Ver todos</span>
        </div>

        <div className="px-5 flex flex-col gap-2.5">
          {loading && (
            <div className="text-center py-8" style={{ color: '#4a5568' }}>Cargando...</div>
          )}
          {!loading && circles.length === 0 && (
            <div className="text-center py-12 rounded-2xl" style={{ background: '#161b22', border: '1px solid #2a3441' }}>
              <p className="text-2xl mb-3">⬡</p>
              <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>Aún no tienes círculos</p>
              <p className="text-xs mt-1" style={{ color: '#4a5568' }}>Toca + para crear el primero</p>
            </div>
          )}
          {circles.map(c => <CircleCard key={c.id} circle={c} />)}
        </div>

      </div>

      <div className="fixed bottom-24 right-5 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl text-black font-bold cursor-pointer z-50"
        style={{ background: '#f0b429', boxShadow: '0 4px 24px rgba(240,180,41,0.4)' }} onClick={() => router.push('/circles/new')}>＋</div>

      <div className="fixed bottom-0 left-0 right-0 flex" style={{ background: 'rgba(13,17,23,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #2a3441', paddingBottom: 20, zIndex: 99 }}>
        {[{ id: 'home', icon: '⬡', label: 'Inicio', active: true }, { id: 'explore', icon: '🔍', label: 'Explorar' }, { id: 'history', icon: '📊', label: 'Historial' }, { id: 'profile', icon: '👤', label: 'Perfil' }].map(item => (
          <div key={item.id} className="flex-1 flex flex-col items-center gap-1 pt-2.5 relative cursor-pointer">
            <span style={{ fontSize: 20, opacity: (item as any).active ? 1 : 0.4 }}>{item.icon}</span>
            <span className="text-xs" style={{ color: (item as any).active ? '#f0b429' : '#4a5568' }}>{item.label}</span>
          </div>
        ))}
      </div>

      <style>{`@keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-12px); } }`}</style>
    </>
  );
}
