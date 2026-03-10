'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const DURATIONS = [
  { label: '1 semana', seconds: 604800 },
  { label: '2 semanas', seconds: 1209600 },
  { label: '1 mes', seconds: 2592000 },
];

export default function NewCircle() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    contribution: '',
    duration: 604800,
    maxMembers: 5,
    isPublic: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const wallet = session?.user?.name || '';
  const gross = Number(form.contribution) * form.maxMembers;
  const fee = gross * 0.01;
  const net = gross - fee;

  async function handleCreate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          contributionAmount: Number(form.contribution),
          cycleDurationSeconds: form.duration,
          maxMembers: form.maxMembers,
          isPublic: form.isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear');
      router.push('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!session) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen pb-10 px-5 pt-5" style={{ background: '#0d1117', color: '#e2e8f0' }}>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => step > 1 ? setStep(step - 1) : router.push('/')}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: '#161b22', border: '1px solid #2a3441' }}>←</button>
        <h1 className="font-bold text-lg" style={{ color: '#e2e8f0' }}>Nuevo círculo</h1>
        <span className="ml-auto text-xs" style={{ color: '#4a5568' }}>Paso {step} de 2</span>
      </div>

      {/* Progress */}
      <div className="h-1 rounded-full mb-6" style={{ background: '#1c2330' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${step * 50}%`, background: '#f0b429' }} />
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#718096' }}>Nombre del círculo</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Familia Martínez"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: '#161b22', border: '1px solid #2a3441', color: '#e2e8f0' }} />
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#718096' }}>Contribución por ciclo (USDC)</label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-sm" style={{ color: '#2775ca' }}>$</span>
              <input type="number" value={form.contribution} onChange={e => setForm({ ...form, contribution: e.target.value })}
                placeholder="50"
                className="w-full rounded-xl pl-8 pr-4 py-3 text-sm outline-none"
                style={{ background: '#161b22', border: '1px solid #2a3441', color: '#e2e8f0' }} />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#718096' }}>Duración de cada ciclo</label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button key={d.seconds} onClick={() => setForm({ ...form, duration: d.seconds })}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: form.duration === d.seconds ? 'rgba(240,180,41,0.15)' : '#161b22',
                    border: `1px solid ${form.duration === d.seconds ? '#f0b429' : '#2a3441'}`,
                    color: form.duration === d.seconds ? '#f0b429' : '#718096'
                  }}>{d.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#718096' }}>
              Número de miembros: <span style={{ color: '#f0b429' }}>{form.maxMembers}</span>
            </label>
            <input type="range" min={2} max={20} value={form.maxMembers}
              onChange={e => setForm({ ...form, maxMembers: Number(e.target.value) })}
              className="w-full accent-yellow-400" />
            <div className="flex justify-between text-xs mt-1" style={{ color: '#4a5568' }}>
              <span>2</span><span>20</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: '#161b22', border: '1px solid #2a3441' }}>
            <div>
              <p className="text-sm font-medium">Círculo público</p>
              <p className="text-xs mt-0.5" style={{ color: '#4a5568' }}>Aparece en Explorar</p>
            </div>
            <div onClick={() => setForm({ ...form, isPublic: !form.isPublic })}
              className="w-11 h-6 rounded-full cursor-pointer transition-all relative"
              style={{ background: form.isPublic ? '#f0b429' : '#2a3441' }}>
              <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all"
                style={{ left: form.isPublic ? '22px' : '2px' }} />
            </div>
          </div>

          <button onClick={() => setStep(2)}
            disabled={!form.name || !form.contribution}
            className="w-full py-4 rounded-2xl font-bold text-black mt-2"
            style={{ background: !form.name || !form.contribution ? '#2a3441' : '#f0b429',
              color: !form.name || !form.contribution ? '#4a5568' : '#000' }}>
            Continuar →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-5" style={{ background: '#161b22', border: '1px solid #2a3441' }}>
            <p className="text-xs uppercase tracking-widest mb-4" style={{ color: '#718096' }}>Resumen del círculo</p>

            <div className="flex flex-col gap-3">
              {[
                { label: 'Nombre', value: form.name },
                { label: 'Contribución', value: `$${form.contribution} USDC/ciclo` },
                { label: 'Duración', value: DURATIONS.find(d => d.seconds === form.duration)?.label },
                { label: 'Miembros', value: `${form.maxMembers} personas` },
                { label: 'Visibilidad', value: form.isPublic ? 'Público' : 'Privado' },
              ].map(item => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-sm" style={{ color: '#718096' }}>{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #2a3441' }}>
              <div className="flex justify-between mb-1">
                <span className="text-sm" style={{ color: '#718096' }}>Pozo total</span>
                <span className="text-sm font-bold" style={{ color: '#f0b429' }}>${gross} USDC</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-sm" style={{ color: '#718096' }}>Fee protocolo (1%)</span>
                <span className="text-sm" style={{ color: '#4a5568' }}>-${fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-bold">Recibes</span>
                <span className="text-sm font-bold" style={{ color: '#38a169' }}>${net.toFixed(2)} USDC</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(229,62,62,0.1)', color: '#fc8181' }}>
              {error}
            </div>
          )}

          <button onClick={handleCreate} disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-black"
            style={{ background: loading ? '#2a3441' : '#f0b429', color: loading ? '#4a5568' : '#000' }}>
            {loading ? 'Creando...' : 'Crear círculo ✦'}
          </button>

          <p className="text-center text-xs" style={{ color: '#4a5568' }}>
            El contrato on-chain se despliega cuando el círculo se llena
          </p>
        </div>
      )}
    </div>
  );
}
