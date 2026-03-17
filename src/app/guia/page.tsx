'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';

const SECCION_1 = `Trust Circle es un protocolo de ROSCA (Rotating Savings and Credit Association) digital.

Una ROSCA funciona así: un grupo de personas se une, cada una aporta una cantidad fija en cada período, y en cada período un miembro diferente recibe todo el fondo acumulado. Al final, todos recibieron una vez.

Trust Circle hace esto on-chain en World Chain:
• Las reglas son inmutables. Ningún administrador puede cambiarlas.
• Los fondos se mueven automáticamente. No hay intermediarios.
• Cada participante es una persona humana única, verificada con World ID.

Tokens aceptados: USDC (principal), WLD, y $AIONICO (con fee reducido).`;

const SECCION_2 = `1. CREACIÓN — El creador define nombre, token, monto, duración de ciclo, número de miembros (2-20), y tipo: Cerrado u Abierto.

2. UNIÓN — Necesitás World ID verificado. No podés estar en otro círculo activo ni tener deuda pendiente.

3. ACTIVACIÓN — El círculo se activa cuando se completa el cupo. En círculos abiertos, el orden se sortea con VRF cuántico.

4. CONTRIBUCIONES — Durante cada ciclo, aportás usando Permit2. Si no pagás, quedás como moroso. Cada pago a tiempo da 10 AIONICO.

5. DISTRIBUCIÓN — Al terminar el ciclo, cualquier miembro puede llamar a la distribución. El receptor recibe 50 AIONICO adicionales.

6. FIN — Al completar todos los ciclos, todos reciben 200 AIONICO.`;

const SECCION_3 = `Tu Score determina tu posición en círculos abiertos:

• 0-2 rondas: Score 0 — última posición
• 3-5 rondas: Score 1 — 75% del orden  
• 6-10 rondas: Score 2 — 50% del orden
• 11-20 rondas: Score 3 — primera disponible
• 21+ rondas: Score 4 — 25% del orden

Cada default activo resta 1 punto. Si fuiste víctima de un default, tenés ventaja adicional en el próximo círculo.`;

const SECCION_4 = `Participación voluntaria. Pagás una prima anual en USDC y, si sos víctima de un default, el seguro cubre parte del monto que te faltaba recibir.

Niveles:
• L1: $5/año — 20% cobertura, tope $200
• L2: $10/año — 30% cobertura, tope $300
• L3: $15/año — 40% cobertura, tope $400
• L4: $20/año — 60% cobertura, tope $600
• L5: $40/año — 75% cobertura, tope $750

De cada prima: 20% al equipo, 80% al fondo. Anualmente, el 60% del excedente se sortea entre miembros activos (ponderado por Score).`;

const SECCION_5 = `Supply total: 100,000,000 AIONICO

Distribución:
• 40% recompensas usuarios
• 20% equipo (vesting 2 años)
• 20% liquidez DEX
• 10% fondo de seguro
• 10% reserva ecosistema

Beneficios:
• Fee reducido al 0.5% en círculos AIONICO (vs 1% estándar)
• Recompensas automáticas por participar
• Mayor peso en sorteos del Fondo de Garantía

Recompensas:
• Pago a tiempo: 10 AIONICO
• Recibir distribución: 50 AIONICO
• ROSCA completada: 200 AIONICO
• Primer círculo creado: 100 AIONICO`;

const SECCION_6 = `¿Puedo estar en varios círculos a la vez?
No. Solo un círculo activo por wallet.

¿Qué pasa si creo un círculo y nadie se une?
Podés cancelarlo con cancelCircle() mientras esté en estado Open.

¿El sorteo es manipulable?
No. Usamos VRF cuántico nativo de AIONICA. Nadie puede predecir el resultado.

¿Puedo recuperar mi dinero si se cancela?
Sí, pero solo en estado Open (antes de activarse). Una vez activo, las contribuciones van al pool.

¿El seguro es obligatorio?
No, es voluntario. Pero sin él no tenés cobertura ante defaults.

¿Cuánto tengo para pagar?
El tiempo del ciclo que definió el creador. No hay prórroga.`;

const SECCIONES = [
  { titulo: '¿Qué es Trust Circle?',      contenido: SECCION_1 },
  { titulo: 'Cómo funciona paso a paso',  contenido: SECCION_2 },
  { titulo: 'Score y posicionamiento',    contenido: SECCION_3 },
  { titulo: 'Fondo de Garantía',          contenido: SECCION_4 },
  { titulo: 'Token $AIONICO',             contenido: SECCION_5 },
  { titulo: 'Preguntas frecuentes',       contenido: SECCION_6 },
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

