'use client';

import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';

export default function TyCPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen pb-28" style={{ background: '#0d1117', color: '#e2e8f0' }}>

      <div className="flex items-center gap-3 px-5 pt-5 mb-5">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: '#161b22', border: '1px solid #2a3441' }}>←</button>
        <h1 className="font-bold text-base">Términos y Condiciones</h1>
      </div>

      <div className="px-5">
        <div className="rounded-2xl p-5" style={{ background: '#161b22', border: '1px solid #2a3441' }}>
          <p className="text-xs mb-4" style={{ color: '#718096' }}>
            Versión 1.0 · Marzo 2026 · World Chain
          </p>
          <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#e2e8f0' }}>
            PEGAR_TEXTO_TYC
          </div>
          <p className="text-xs mt-6 text-center" style={{ color: '#4a5568' }}>
            AIONICA Security Lab · "Compilamos desde fuente. Auditamos desde cero."
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
