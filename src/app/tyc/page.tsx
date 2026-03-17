'use client';

import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';

const TEXTO_TYC = `1. Descripción del Protocolo

Trust Circle es un protocolo de ROSCA (Rotating Savings and Credit Association) digital, verificado con World ID y desplegado en World Chain. Permite a grupos de personas organizarse para realizar aportes periódicos en ciclos, donde cada ciclo un miembro recibe el total del fondo acumulado.

El protocolo opera mediante contratos inteligentes auditados e inmutables. Todas las reglas están codificadas en la blockchain y se ejecutan de forma automática y transparente, sin intermediarios.

2. Definiciones

• Circulo: Instancia de una ROSCA creada en el protocolo. Puede ser Cerrado (orden fijo) o Abierto (orden determinado por VRF).
• Miembro: Dirección de wallet verificada con World ID que participa en un Circulo.
• Creador: Miembro que inicia un Circulo y define sus parámetros.
• Ciclo: Período de tiempo dentro de un Circulo al final del cual se distribuye el fondo al receptor designado.
• Receptor: Miembro que recibe el fondo acumulado en un ciclo específico.
• Default: Incumplimiento de pago de un miembro en un ciclo. Genera deuda registrada on-chain.
• Score: Puntuación de reputación on-chain calculada por rondas completadas y defaults acumulados.
• VRF: Sistema de azar cuántico implementado nativamente por AIONICA para sorteos en círculos abiertos.

3. Requisitos de Participación

3.1 Verificación de Identidad
Para unirse a cualquier Circulo se requiere verificación válida mediante World ID. Cada identidad humana puede unirse a un mismo Circulo una única vez.

3.2 Elegibilidad
Un miembro no puede participar en más de un Circulo activo simultáneamente. Un miembro con deuda pendiente (excluded = true) no puede unirse a nuevos Circulos hasta rehabilitarse mediante el pago completo de su deuda.

3.3 Tokens Aceptados
El protocolo acepta: USDC, WLD, y $AIONICO (token nativo del protocolo).

4. Parámetros de Círculos

• Miembros mínimos: 2
• Miembros máximos: 20
• Contribución mínima USDC: 0.10 USDC
• Duración mínima de ciclo: 1 día (86,400 segundos)
• Fee estándar: 1% sobre el fondo bruto del ciclo
• Fee con AIONICO: 0.5% (descuento del 50%)

5. Tipos de Círculos

5.1 Círculo Cerrado
El creador define el orden de distribución al momento de crear el Circulo. Este orden es inmutable una vez que el Circulo se activa.

5.2 Círculo Abierto
Cualquier wallet elegible puede unirse hasta completar el cupo. El orden de distribución se determina de forma verificablemente aleatoria mediante VRF de AIONICA al momento en que el último miembro se une.

6. Ciclo de Vida de un Círculo

6.1 Creación: El creador define nombre, token, monto, duración, número de miembros y tipo.
6.2 Fase de Unión (Open): Los miembros se unen mediante joinCircle(), verificando identidad con World ID.
6.3 Contribuciones: Durante cada ciclo, los miembros realizan su aporte usando Permit2. Cada pago a tiempo otorga 10 tokens AIONICO.
6.4 Distribución: Al finalizar el período, cualquier miembro puede llamar a triggerDistribution(). El receptor recibe 50 AIONICO adicionales.
6.5 Cierre: Al completar todos los ciclos, todos reciben 200 AIONICO como recompensa de ROSCA completada.

7. Sistema de Defaults y Deudas

7.1 Default: Si un miembro no realiza su aporte durante el período del ciclo, queda registrado como moroso y excluido de nuevos Círculos.

7.2 Distribución de la Deuda cuando el moroso paga:
• Víctima (miembro perjudicado): 75%
• Equipo de desarrollo: 7%
• Fondo de Garantía Colectiva: 18%

7.3 Rehabilitación: Un miembro excluido puede rehabilitarse pagando su deuda completa mediante settleDebt() en MembershipContract.

8. Sistema de Score y Posicionamiento

Rondas completadas | Score base | Posición mínima permitida
0 - 2              | 0          | Última posición
3 - 5              | 1          | 75% del total de posiciones
6 - 10             | 2          | 50% del total de posiciones
11 - 20            | 3          | Primera posición
21+                | 4          | 25% del total de posiciones

Cada default activo resta 1 punto al Score.

9. Fondo de Garantía Colectiva (MembershipInsurance)

Participación voluntaria. Primas en USDC:

Nivel | Prima anual | Cobertura | Tope anual
L1    | $5 USDC     | 20%       | $200/año
L2    | $10 USDC    | 30%       | $300/año
L3    | $15 USDC    | 40%       | $400/año
L4    | $20 USDC    | 60%       | $600/año
L5    | $40 USDC    | 75%       | $750/año

De cada prima: 20% al equipo, 80% al fondo de cobertura. Anualmente, el 60% del excedente se sortea entre miembros activos sin deuda.

10. Token $AIONICO y Recompensas

Supply total: 100,000,000 AIONICO
• 40% recompensas usuarios
• 20% equipo (vesting 2 años)
• 20% liquidez DEX
• 10% fondo de seguro
• 10% reserva ecosistema

Recompensas automáticas:
• Pago a tiempo: 10 AIONICO
• Recibir distribución: 50 AIONICO
• ROSCA completada: 200 AIONICO
• Primer círculo creado: 100 AIONICO

11. Riesgos y Limitaciones

• Riesgo de default: si un miembro no paga, la víctima recibe menos de lo esperado.
• Riesgo de contrato: aunque auditados, ningún smart contract es libre de riesgo absoluto.
• Riesgo de liquidez: el protocolo no garantiza la disponibilidad de tokens en el mercado.
• Riesgo de oracle: la cobertura multi-token del Fondo de Garantía requiere oracle de precio activo.

12. Aceptación de Términos

Al realizar cualquier transacción con los contratos del protocolo Trust Circle, el usuario declara haber leído, comprendido y aceptado la totalidad de estos Términos y Condiciones.

Dado que los contratos son inmutables y operan de forma autónoma en blockchain, no existe mecanismo de apelación, reversión ni mediación. El usuario acepta este hecho explícitamente al interactuar con el protocolo.

AIONICA Security Lab · Marzo 2026
"Compilamos desde fuente. Auditamos desde cero."`;

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
            {TEXTO_TYC}
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

