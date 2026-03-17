'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';

const SECCIONES = [
  { titulo: '¿Qué es Trust Circle?',      contenido: 'PEGAR_SECCION_1' },
  { titulo: 'Cómo funciona paso a paso',  contenido: 'PEGAR_SECCION_2' },
  { titulo: 'Score y posicionamiento',    contenido: 'PEGAR_SECCION_3' },
  { titulo: 'Fondo de Garantía',          contenido: 'PEGAR_SECCION_4' },
  { titulo: 'Token $AIONICO',             contenido: 'PEGAR_SECCION_5' },
  { titulo: 'Preguntas frecuentes',       contenido: 'PEGAR_SECCION_6' },
];

export default function GuiaPage() {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="min-h-screen pb-28" style={{ background: '#0d1117', color: '#e2e8f0' }}>

      <div className="flex items-center gap-3 px-5 pt-5 mb-5">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: '#161b22', border: '1px solid #2a3441' }}>←</button>
        <h1 className="font-bold text-base">Guía para usuarios</h1>
      </div>

      <div className="px-5 flex flex-col gap-2">
        {SECCIONES.map((s, i) => (
          <div key={i} className="rounded-2xl overflow-hidden"
            style={{ background: '#161b22', border: '1px solid #2a3441' }}>
            <button onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-4 text-left">
              <span className="text-sm font-semibold">{s.titulo}</span>
              <span style={{ color: '#f0b429', fontSize: 18 }}>{open === i ? '−' : '+'}</span>
            </button>
            {open === i && (
              <div className="px-4 pb-4 text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: '#718096', borderTop: '1px solid #2a3441', paddingTop: 12 }}>
                {s.contenido}
              </div>
            )}
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
