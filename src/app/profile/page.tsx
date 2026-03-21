'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';
import { MiniKit } from '@worldcoin/minikit-js';
import MembershipInsuranceABI from '@/abi/MembershipInsurance.json';

const MEMBERSHIP_INSURANCE_ADDRESS = '0xB953016dF10c80496E86E8779697972cC9780094';
const USDC_ADDRESS = '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1';

interface Stats {
  totalCircles: number;
  completedCircles: number;
  score: number;
  isEligible: boolean;
  membership?: { level: number; expires_at: string } | null;
  debtUSDC?: string;
  debtWLD?: string;
  debtAIONICO?: string;
}

const MEMBERSHIP_LEVELS = [
  { level: 1, price: 5,  coverage: '20%', cap: '$200/año', color: '#63b3ed' },
  { level: 2, price: 10, coverage: '30%', cap: '$300/año', color: '#68d391' },
  { level: 3, price: 15, coverage: '40%', cap: '$400/año', color: '#f0b429' },
  { level: 4, price: 20, coverage: '60%', cap: '$600/año', color: '#ed8936' },
  { level: 5, price: 40, coverage: '75%', cap: '$750/año', color: '#b794f4' },
];

function shortWallet(w: string) {
  return `${w.slice(0, 6)}...${w.slice(-4)}`;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<'perfil' | 'membresia'>('perfil');
  
  const MC_ADDRESS = '0x9adCCF3df7170ae5bED7dD17FDb977F866b0f8B3'
  const USDC_ADDR    = '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1'
  const WLD_ADDR     = '0x2cFc85d8E48F8EAB294be644d9E25C3030863003'
  const AIONICO_ADDR = '0x89C2A3fC33bc7cc1140e6408e050De230D5cC0Dc'

  async function handleSettleDebt() {
    if (!MiniKit.isInstalled()) { alert('Abrí desde World App'); return; }
    if (!stats) return;
    const debtU = BigInt(stats.debtUSDC ?? '0')
    const debtW = BigInt(stats.debtWLD ?? '0')
    const debtA = BigInt(stats.debtAIONICO ?? '0')
    const token  = debtU > 0n ? USDC_ADDR : debtW > 0n ? WLD_ADDR : AIONICO_ADDR
    const amount = debtU > 0n ? debtU : debtW > 0n ? debtW : debtA
    if (amount === 0n) return;
    try {
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          { address: token, abi: [{ type: 'function', name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' }], functionName: 'approve', args: [MC_ADDRESS, amount.toString()] },
          { address: MC_ADDRESS, abi: [{ type: 'function', name: 'settleDebt', inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' }], functionName: 'settleDebt', args: [token, amount.toString()] },
        ],
      });
      if (finalPayload.status === 'success') {
        alert('Deuda saldada. Recargá tu perfil.');
      } else {
        alert('Transacción cancelada');
      }
    } catch (e: any) { alert(e.message || 'Error inesperado'); }
  }

  async function handleSubscribe(level: number, priceUSDC: number) {
    if (!MiniKit.isInstalled()) { alert('Abrí desde World App'); return; }
    const amountRaw = (priceUSDC * 1_000_000).toString();
    const nonce = Date.now().toString();
    const deadline = Math.floor((Date.now() + 30 * 60 * 1000) / 1000).toString();
    try {
      const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [{
          address: MEMBERSHIP_INSURANCE_ADDRESS,
          abi: MembershipInsuranceABI,
          functionName: 'subscribe',
          args: [level, USDC_ADDRESS],
        }],
        permit2: [{
          permitted: { token: USDC_ADDRESS, amount: amountRaw },
          nonce, deadline,
          spender: MEMBERSHIP_INSURANCE_ADDRESS,
        }],
      });
      if (finalPayload.status === 'success') {
        alert('Membresía contratada. Recargá tu perfil.');
      } else {
        alert('Transacción cancelada');
      }
    } catch (e: any) {
      alert(e.message || 'Error inesperado');
    }
  }

  useEffect(() => {
    if (!session) return;
    fetch('/api/profile/stats')
      .then(r => r.json())
      .then(d => setStats(d.stats ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  if (!session) { router.push('/'); return null; }

  const wallet = session.user?.id ?? '';

  return (
    <div className="min-h-screen pb-28 px-5 pt-5" style={{ background: '#0d1117', color: '#e2e8f0' }}>

      <div className="flex items-center justify-between mb-5">
        <h1 className="font-black text-lg" style={{ color: '#f0b429', letterSpacing: -0.5 }}>Perfil</h1>
        <button onClick={() => signOut({ redirect: false }).then(() => { window.location.href = '/'; })}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: '#161b22', color: '#718096', border: '1px solid #2a3441' }}>
          Salir
        </button>
      </div>

      <div className="flex items-center gap-4 rounded-2xl p-4 mb-4"
        style={{ background: '#161b22', border: '1px solid #2a3441' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg text-black flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#f0b429,#ed8936)' }}>
          {wallet.slice(2, 4).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{shortWallet(wallet)}</p>
          <span className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
            style={{ background: 'rgba(56,161,105,0.15)', color: '#68d391' }}>
            ✅ World ID verificado
          </span>
        </div>
      </div>

      <div className="flex rounded-xl p-1 mb-5" style={{ background: '#161b22', border: '1px solid #2a3441' }}>
        {(['perfil', 'membresia'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: tab === t ? '#f0b429' : 'transparent', color: tab === t ? '#000' : '#718096' }}>
            {t === 'perfil' ? 'Mi Perfil' : 'Membresía'}
          </button>
        ))}
      </div>

      {tab === 'perfil' && (
        <div className="flex flex-col gap-4">
          {loading ? <div className="text-center py-10" style={{ color: '#4a5568' }}>Cargando...</div> : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Score',            value: stats?.score ?? 0,             color: '#f0b429', icon: '⭐' },
                  { label: 'Círculos totales',  value: stats?.totalCircles ?? 0,      color: '#e2e8f0', icon: '⬡'  },
                  { label: 'Completados',       value: stats?.completedCircles ?? 0,  color: '#68d391', icon: '✅' },
                  { label: 'Elegible',          value: stats?.isEligible ? 'Sí' : 'No', color: stats?.isEligible ? '#68d391' : '#fc8181', icon: '🛡️' },
                ].map(item => (
                  <div key={item.label} className="rounded-xl p-4"
                    style={{ background: '#161b22', border: '1px solid #2a3441' }}>
                    <p className="text-xs" style={{ color: '#4a5568' }}>{item.icon} {item.label}</p>
                    <p className="text-2xl font-black mt-1" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>

                {(BigInt(stats?.debtUSDC ?? '0') > 0n || BigInt(stats?.debtWLD ?? '0') > 0n || BigInt(stats?.debtAIONICO ?? '0') > 0n) && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.4)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: '#fc8181' }}>⚠️ DEUDA PENDIENTE — REHABILITACIÓN REQUERIDA</p>
                  {BigInt(stats?.debtUSDC ?? '0') > 0n && <p className="text-sm mb-1" style={{ color: '#e2e8f0' }}>USDC: {(Number(BigInt(stats!.debtUSDC!)) / 1_000_000).toFixed(2)}</p>}
                  {BigInt(stats?.debtWLD ?? '0') > 0n && <p className="text-sm mb-1" style={{ color: '#e2e8f0' }}>WLD: {(Number(BigInt(stats!.debtWLD!)) / 1e18).toFixed(4)}</p>}
                  {BigInt(stats?.debtAIONICO ?? '0') > 0n && <p className="text-sm mb-1" style={{ color: '#e2e8f0' }}>AIONICO: {(Number(BigInt(stats!.debtAIONICO!)) / 1e18).toFixed(4)}</p>}
                  <button onClick={handleSettleDebt} style={{ marginTop: 8, width: '100%', background: 'linear-gradient(135deg,#fc8181,#e53e3e)', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    💸 Saldar Deuda y Rehabilitarse
                  </button>
                </div>
              )}

              <div className="rounded-xl p-4" style={{ background: '#161b22', border: '1px solid #2a3441' }}>
                <p className="text-xs font-semibold mb-3" style={{ color: '#718096' }}>SCORE · POSICIÓN EN CÍRCULOS ABIERTOS</p>
                {[
                  { rondas: '0–2',   score: 0, pos: 'Última posición'    },
                  { rondas: '3–5',   score: 1, pos: '75% del orden'      },
                  { rondas: '6–10',  score: 2, pos: '50% del orden'      },
                  { rondas: '11–20', score: 3, pos: 'Primera disponible' },
                  { rondas: '21+',   score: 4, pos: '25% del orden'      },
                ].map(row => {
                  const active = stats?.score === row.score;
                  return (
                    <div key={row.score} className="flex items-center justify-between py-1.5"
                      style={{ borderBottom: '1px solid #1c2330', opacity: active ? 1 : 0.45 }}>
                      <span className="text-xs" style={{ color: '#718096' }}>{row.rondas} rondas</span>
                      <span className="text-xs font-bold" style={{ color: active ? '#f0b429' : '#4a5568' }}>
                        {active ? '▶ ' : ''}{row.pos}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                {[
                  { label: 'Guía para usuarios',    path: '/guia', icon: '📖' },
                  { label: 'Términos y condiciones', path: '/tyc',  icon: '📄' },
                ].map(item => (
                  <div key={item.path} onClick={() => router.push(item.path)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
                    style={{ background: '#161b22', border: '1px solid #2a3441' }}>
                    <span>{item.icon}</span>
                    <span className="text-sm flex-1">{item.label}</span>
                    <span style={{ color: '#4a5568' }}>›</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'membresia' && (
        <div className="flex flex-col gap-4">
          {stats?.membership ? (
            <div className="rounded-2xl p-4"
              style={{ background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.3)' }}>
              <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#f0b429' }}>Membresía activa</p>
              <p className="text-2xl font-black" style={{ color: '#f0b429' }}>Nivel {stats.membership.level}</p>
              <p className="text-xs mt-1" style={{ color: '#718096' }}>
                Vence: {new Date(stats.membership.expires_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          ) : (
            <div className="rounded-xl p-4" style={{ background: '#161b22', border: '1px solid #2a3441' }}>
              <p className="text-sm font-medium mb-1">Sin membresía activa</p>
              <p className="text-xs" style={{ color: '#718096' }}>
                La membresía te cubre si alguien en tu círculo no paga. Opcional pero recomendada.
              </p>
            </div>
          )}

          <p className="text-xs uppercase tracking-widest" style={{ color: '#718096' }}>Niveles disponibles</p>

{MEMBERSHIP_LEVELS.map(m => (
            <div key={m.level} className="rounded-2xl p-4"
              style={{ background: '#161b22', border: '1px solid #2a3441' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-black"
                    style={{ background: m.color }}>L{m.level}</div>
                  <div>
                    <p className="text-sm font-bold">Nivel {m.level}</p>
                    <p className="text-xs" style={{ color: '#718096' }}>${m.price} USDC / año</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: m.color }}>{m.coverage}</p>
                  <p className="text-xs" style={{ color: '#4a5568' }}>{m.cap}</p>
                </div>
              </div>
              <button onClick={() => handleSubscribe(m.level, m.price)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg,#f0b429,#ed8936)', color: '#000', cursor: 'pointer', border: 'none' }}>
                Contratar L{m.level} — ${m.price} USDC/año
              </button>
            </div>
          ))}

          <p className="text-xs text-center pb-2" style={{ color: '#2a3441' }}>
            20% de la prima va al equipo · 80% al fondo de cobertura
          </p>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
