'use client';

import { useRouter } from 'next/navigation';
import { BottomNav } from '@/components/BottomNav';

const TEXTO_TYC = `AVISO IMPORTANTE — LEA ANTES DE PARTICIPAR

Los contratos inteligentes de Trust Circle son inmutables e irreversibles una vez desplegados. Toda transacción es definitiva. No existe mecanismo de pausa, reversión ni recuperación de fondos. Este documento no constituye asesoramiento legal, financiero, tributario ni de inversión. Consulte a un profesional calificado antes de participar.

DESCARGO PRINCIPAL — NO ES UN SERVICIO FINANCIERO

Trust Circle es un protocolo de código abierto e inmutable publicado por AIONICA Security Lab bajo licencia open-source. No es un servicio financiero, institución financiera, producto de inversión regulado, entidad de pago, fondo de inversión, cooperativa de ahorro, sistema de seguro regulado, ni money service business (MSB) bajo ninguna jurisdicción. AIONICA Security Lab no custodia fondos, no intermedia en transacciones y no tiene capacidad técnica ni legal de modificar, pausar, detener ni revertir operaciones una vez desplegados los contratos. AIONICA Security Lab mantiene infraestructura auxiliar (nodo VRF) que no otorga control sobre fondos ni decisiones de distribución, operando bajo parámetros inmutables del contrato. La participación es completamente voluntaria y bajo la exclusiva responsabilidad del usuario.

El protocolo es una implementación digital de una ROSCA (Rotating Savings and Credit Association), práctica de ahorro colectivo con siglos de historia mundial (tanda, cundina, hui, chama, sou-sou). El usuario es el único responsable de verificar la legalidad de su participación en su jurisdicción.

ADVERTENCIA GEOGRÁFICA — JURISDICCIONES CON RESTRICCIONES CONOCIDAS

Colombia: La SIC emitió en 2025 resoluciones restringiendo el uso de datos biométricos de Worldcoin/World ID. Dado que el protocolo requiere World ID obligatoriamente, los usuarios colombianos NO DEBEN participar hasta verificar expresamente y por escrito con un profesional legal que su participación es legal bajo las disposiciones SIC vigentes. AIONICA no asume responsabilidad por uso en violación de resoluciones SIC.

España / Unión Europea: El reglamento MiCA aplica a cualquier crypto-asset ofrecido a residentes de la UE. Los usuarios de la UE deben verificar el estatus regulatorio bajo MiCA y GDPR antes de participar. El protocolo no ha completado registro de white paper ante ninguna autoridad MiCA.

Estados Unidos: El protocolo no ha sido registrado ante la SEC ni la CFTC. Los usuarios estadounidenses participan bajo su exclusivo riesgo regulatorio. El protocolo no está dirigido específicamente a personas en jurisdicciones donde su uso esté prohibido.

SOFTWARE PROPORCIONADO "TAL CUAL" (AS IS)

EL PROTOCOLO SE PROPORCIONA "TAL CUAL" (AS IS) Y "SEGÚN DISPONIBILIDAD" (AS AVAILABLE), SIN GARANTÍAS DE NINGÚN TIPO, EXPRESAS O IMPLÍCITAS, INCLUYENDO PERO NO LIMITADO A: GARANTÍAS DE COMERCIABILIDAD, IDONEIDAD PARA UN PROPÓSITO PARTICULAR, TÍTULO, NO INFRACCIÓN, Y AUSENCIA DE VULNERABILIDADES EN CONTRATOS INTELIGENTES. El código del protocolo ha sido sometido a revisión técnica interna con fines de optimización lógica. Dicha revisión no garantiza la ausencia de bugs, vulnerabilidades ni la idoneidad para ningún fin específico, y no sustituye una auditoría de seguridad externa independiente.

1. Descripción del Protocolo

Trust Circle es un protocolo de ROSCA digital, verificado con World ID y desplegado en World Chain. Permite a grupos de personas organizarse para realizar aportes periódicos en ciclos, donde cada ciclo un miembro recibe el total del fondo acumulado. El protocolo opera mediante contratos inteligentes inmutables. Todas las reglas están codificadas en la blockchain y se ejecutan de forma automática y transparente, sin intermediarios.

2. Definiciones

• Círculo: Instancia de una ROSCA creada en el protocolo. Cerrado (orden fijo) o Abierto (orden por VRF).
• Miembro: Dirección de wallet verificada con World ID que participa en un Círculo.
• Creador: Miembro que inicia un Círculo y define sus parámetros.
• Ciclo: Período de tiempo al final del cual se distribuye el fondo al receptor designado.
• Receptor: Miembro que recibe el fondo acumulado en un ciclo específico.
• Default: Incumplimiento de pago que genera deuda registrada on-chain.
• Score: Puntuación de reputación on-chain calculada por rondas completadas y defaults activos.
• VRF: Sistema de aleatoriedad verificable implementado por AIONICA para círculos abiertos.
• Fondo de Mantenimiento: Porcentaje del protocolo destinado al mantenimiento técnico continuo (DEV_WALLET en el código). Se destina exclusivamente a: infraestructura VRF, desarrollo de seguridad, servidores y auditorías.
• Contrato inteligente: Código autoejecutable desplegado en blockchain, inmutable y sin control posterior de terceros.

3. Requisitos de Participación

3.1 Verificación de Identidad
Para unirse a cualquier Círculo se requiere verificación válida mediante World ID. Cada identidad humana puede unirse a un mismo Círculo una única vez (un nullifier por círculo). El usuario reconoce que la disponibilidad de World ID depende de Worldcoin Foundation, entidad completamente independiente de AIONICA Security Lab, y que restricciones regulatorias a World ID en ciertas jurisdicciones pueden impedir el acceso al protocolo.

3.2 Elegibilidad
Un miembro no puede participar en más de un Círculo activo simultáneamente. Un miembro con deuda pendiente (excluded = true) no puede unirse a nuevos Círculos hasta rehabilitarse mediante el pago completo de su deuda.

3.3 Cumplimiento AML y Sanciones Internacionales
El protocolo utiliza World ID para verificar que cada participante es un ser humano único. World ID no constituye un programa KYC/AML completo. El usuario declara, garantiza y acepta bajo responsabilidad personal que: (a) no pertenece a ninguna lista de sanciones internacionales (OFAC, ONU, UE u otras); (b) no utilizará el protocolo para actividades ilícitas incluyendo lavado de dinero, financiamiento del terrorismo o evasión de sanciones; (c) es mayor de edad en su jurisdicción (mínimo 18 años o la edad legal aplicable) y tiene plena capacidad legal para celebrar este acuerdo; (d) cualquier violación libera automáticamente a AIONICA Security Lab de toda responsabilidad y el usuario asume todas las consecuencias legales derivadas. AIONICA Security Lab no tiene capacidad técnica de bloquear wallets individuales dado el carácter inmutable del protocolo.

3.4 Tokens Aceptados
USDC (0x79A02482A880bCE3F13e09Da970dC34db4CD24d1), WLD (0x2cFc85d8E48F8EAB294be644d9E25C3030863003), y $AIONICO — token de utilidad del protocolo (ver Sección 10).

4. Parámetros de Círculos

• Miembros mínimos: 2
• Miembros máximos: 20
• Contribución mínima (USDC): 0.10 USDC (100,000 unidades de 6 decimales)
• Duración mínima de ciclo: 1 día (86,400 segundos)
• Fee estándar: 1% sobre el fondo bruto del ciclo
• Fee con $AIONICO: 0.5% (descuento del 50%)

5. Tipos de Círculos

5.1 Círculo Cerrado
El creador define el orden de distribución al momento de crear el Círculo. Este orden es inmutable una vez que el Círculo se activa. Solo las direcciones incluidas en el orden de distribución pueden unirse.

5.2 Círculo Abierto
Cualquier wallet elegible puede unirse hasta completar el cupo. El orden de distribución se determina de forma verificablemente aleatoria mediante el nodo VRF de AIONICA al completarse el cupo. El nodo VRF opera bajo parámetros técnicos inmutables definidos en el contrato; su operación no otorga a AIONICA control sobre fondos ni decisiones de distribución. Una falla del nodo VRF puede retrasar o impedir la activación del Círculo. En caso de falla prolongada por más de 7 días, el creador puede cancelar el Círculo mediante cancelOpenCircle().

6. Ciclo de Vida de un Círculo

6.1 Creación: El creador define nombre, token, monto, duración, número de miembros y tipo. El creador queda registrado como miembro activo desde la creación.
6.2 Fase de Unión (Open): Los miembros se unen mediante joinCircle(), verificando identidad con World ID. El Círculo pasa a estado Active cuando se completa el cupo.
6.3 Contribuciones: Durante cada ciclo, los miembros realizan su aporte mediante contribute() usando Permit2 (firma off-chain, transferencia on-chain). Cada pago a tiempo otorga 10 tokens AIONICO de recompensa automática.
6.4 Distribución: Al finalizar el período, cualquier miembro puede llamar a triggerDistribution(). El receptor recibe 50 AIONICO adicionales. El fee se descuenta automáticamente.
6.5 Cierre: Al completar todos los ciclos, el sistema calcula y reintegra automáticamente la diferencia neta a cada miembro (descontando deudas pendientes). Todos reciben 200 AIONICO como recompensa de ROSCA completada.

7. Sistema de Defaults y Deudas

7.1 Default
Si un miembro no realiza su aporte durante el período del ciclo, queda registrado como moroso on-chain y excluido de nuevos Círculos (excluded = true) hasta saldar su deuda.

7.2 Distribución de la deuda cuando el moroso paga (via settleDebt):
• Víctima (miembro perjudicado): 75% (7,500 BPS)
• Fondo de Mantenimiento del Protocolo: 7% (700 BPS)
• Fondo de Garantía Colectiva: 18% (1,800 BPS)

Nota: El Fondo de Mantenimiento (DEV_WALLET en el código) se destina exclusivamente a costos operativos: infraestructura VRF, servidores, desarrollo de seguridad y auditorías. No constituye distribución de ganancias ni comisión por intermediación financiera.

7.3 Rehabilitación
Un miembro excluido puede rehabilitarse pagando su deuda completa mediante settleDebt() en MembershipContract. Una vez saldada, recupera la elegibilidad para nuevos Círculos.

8. Sistema de Score y Posicionamiento

Rondas completadas | Score base | Posición mínima en Círculos Abiertos
0 — 2             | 0          | Última posición
3 — 5             | 1          | 75% del total de posiciones
6 — 10            | 2          | 50% del total de posiciones
11 — 20           | 3          | Primera posición disponible
21+               | 4          | 25% del total de posiciones

Cada default activo (sin rehabilitar) resta 1 punto al Score. Un miembro que fue víctima de un default recibe ventaja de posicionamiento adicional en Círculos Abiertos futuros.

9. Fondo de Garantía Colectiva (MembershipInsurance)

Participación completamente voluntaria. Las primas se pagan exclusivamente en USDC. Al contratar una membresía, el 20% de la prima se destina al Fondo de Mantenimiento del Protocolo y el 80% al fondo de cobertura colectiva. El Fondo de Garantía no es un contrato de seguro regulado y no está respaldado por ninguna entidad supervisora gubernamental. El fondo opera sin reservas regulatorias ni reaseguro. En escenarios de estrés con múltiples defaults simultáneos, el fondo puede resultar insuficiente para cubrir todas las pérdidas, incluso por debajo de los topes anunciados.

Nivel | Prima anual | Cobertura máx. | Tope anual
L1    | $5 USDC     | 20%            | $200/año
L2    | $10 USDC    | 30%            | $300/año
L3    | $15 USDC    | 40%            | $400/año
L4    | $20 USDC    | 60%            | $600/año
L5    | $40 USDC    | 75%            | $750/año

Al cierre del ciclo anual, el excedente se distribuye: 20% reserva acumulativa, 20% Fondo de Mantenimiento del Protocolo, 20% reducción de primas del próximo año, 40% distribución proporcional entre miembros activos sin deuda ponderada por Score (mayor Score = mayor proporción asignada automáticamente por el contrato). Esta distribución es algorítmica y determinista, no un sorteo aleatorio.

10. Token $AIONICO y Recompensas

$AIONICO es un token de utilidad. Su función es otorgar acceso a descuentos en fees y recompensas automáticas por participación activa en el protocolo. $AIONICO NO constituye: un valor (security), una participación en ganancias del protocolo, un instrumento de inversión, un derecho de gobernanza que constituya "common enterprise" bajo el Test de Howey, ni un dividendo o reparto de utilidades. Las recompensas en $AIONICO son incentivos de uso del protocolo (usage incentives) similares a puntos de programa de lealtad, sin valor monetario garantizado. La tenencia de $AIONICO no crea expectativa de ganancias derivadas del esfuerzo de AIONICA Security Lab ni de terceros. AIONICA no garantiza valor de mercado, liquidez ni disponibilidad en exchanges.

Advertencia fiscal: Las distribuciones de Círculos y recompensas en $AIONICO pueden generar obligaciones tributarias en la jurisdicción del usuario. El usuario es el único responsable de declarar y cumplir con sus obligaciones fiscales locales.

Supply total: 100,000,000 AIONICO
• 40% recompensas usuarios (Pool de rewards)
• 20% equipo AIONICA Lab (Vesting 2 años, cliff 6 meses)
• 20% liquidez inicial (DEX World Chain)
• 10% fondo de seguro (MembershipInsurance)
• 10% reserva (Partnerships/Ecosistema)

Recompensas automáticas:
• Pago de contribución a tiempo: 10 AIONICO
• Recibir distribución del ciclo: 50 AIONICO
• ROSCA completada (todos los ciclos): 200 AIONICO
• Crear el primer Círculo: 100 AIONICO

11. Fees y Destino de Fondos

El fee se descuenta automáticamente del fondo bruto en cada distribución. El 100% del fee se transfiere al Fondo de Mantenimiento del Protocolo en la misma transacción. No existe fee de creación ni de unión a Círculos. Si el receptor del ciclo tiene deuda pendiente en ese Círculo, el protocolo aplica un neteo automático on-chain.

12. Cancelación de Círculos

El creador puede cancelar un Círculo en estado Open (antes de activarse). Los Círculos en estado Open no tienen fondos depositados: las contribuciones solo se realizan una vez que el Círculo está Active. La cancelación no genera pérdida de fondos. Un Círculo Abierto que no recibe confirmación VRF en 7 días puede ser cancelado por el creador mediante cancelOpenCircle().

13. Riesgos y Limitaciones — Declaración Completa

El usuario reconoce, acepta y asume explícitamente los siguientes riesgos antes de participar. Esta lista no es exhaustiva.

• Riesgo de default: Si un miembro no paga, la víctima recibe menos de lo esperado. El Fondo de Garantía cubre parcialmente solo si la víctima tiene membresía activa y el fondo tiene liquidez suficiente. La cobertura máxima es limitada (ver Sección 9). El fondo puede resultar insolvente ante defaults simultáneos.
• Riesgo de pérdida total de fondos: Ningún smart contract es libre de riesgo absoluto. Un bug no detectado, un vector de ataque desconocido o una falla de la red puede resultar en la pérdida parcial o total de los fondos. Los fondos en contratos inteligentes NO están cubiertos por ningún seguro de depósito gubernamental. La revisión técnica interna no garantiza la ausencia de vulnerabilidades.
• Riesgo de selección adversa: En círculos abiertos, participantes con mayor probabilidad de default pueden unirse estratégicamente. El Score mitiga pero no elimina este riesgo.
• Riesgo de VRF comprometido: Una falla o compromiso del nodo VRF de AIONICA puede retrasar la activación de Círculos Abiertos o afectar la aleatoriedad del orden. En caso de falla prolongada, el círculo puede cancelarse. Los fondos en estado Open no están en riesgo (no hay fondos depositados en estado Open).
• Riesgo de World ID: El protocolo depende de World ID (Worldcoin Foundation, entidad independiente). Interrupciones, cambios de política, restricciones regulatorias o clausura de World ID pueden impedir el acceso al protocolo en ciertas jurisdicciones o globalmente.
• Riesgo MEV / front-running: Las transacciones de contribute() y triggerDistribution() son públicas en la mempool de World Chain. Validadores o bots pueden reordenar transacciones (MEV) para obtener ventajas.
• Riesgo de liquidez: El protocolo no garantiza disponibilidad de tokens en el mercado. El valor de $AIONICO puede caer a cero. USDC puede ser congelado por Circle Inc. WLD tiene riesgos propios de Worldcoin Foundation.
• Riesgo de oracle: La cobertura multi-token (WLD/AIONICO) del Fondo de Garantía requiere oracle de precio activo. Sin oracle, la cobertura para esos tokens es cero. El oracle puede ser manipulado.
• Riesgo regulatorio: Las leyes sobre blockchain, ROSCAs digitales y activos virtuales varían por jurisdicción y evolucionan constantemente. El usuario es el único responsable de verificar la legalidad de su participación.
• Riesgo de inmutabilidad: Los contratos son inmutables. No existe mecanismo de pausado de emergencia, upgrade ni recuperación de fondos ante errores del usuario o bugs del contrato.
• Riesgo de red: Fallas, congestión, ataques al 51%, hard forks o cambios en World Chain pueden afectar la disponibilidad del protocolo.
• Riesgo de custodia: El usuario es el único custodio de su wallet y claves privadas. La pérdida de acceso a la wallet implica la pérdida permanente e irrecuperable de fondos y posiciones.
• Riesgo fiscal: Las distribuciones recibidas y recompensas en $AIONICO pueden constituir renta gravable u otras obligaciones fiscales. El usuario es el único responsable de sus obligaciones tributarias.
• Riesgo de fuerza mayor: AIONICA no es responsable por fallas derivadas de: interrupciones de World Chain o World ID, ataques de consenso, vulnerabilidades de terceros, cambios regulatorios, desastres naturales, conflictos, o cualquier evento fuera del control razonable.

14. Limitación de Responsabilidad de AIONICA Security Lab

AIONICA Security Lab publicó el código fuente del protocolo Trust Circle como software de código abierto. AIONICA Security Lab no opera la lógica de negocio del protocolo ni tiene control sobre los fondos una vez desplegado. AIONICA mantiene infraestructura auxiliar (nodo VRF) que opera bajo parámetros inmutables del contrato y no otorga control sobre fondos ni distribuciones. No existe relación fiduciaria entre AIONICA Security Lab y los usuarios del protocolo.

EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY APLICABLE, LA RESPONSABILIDAD TOTAL DE AIONICA SECURITY LAB NO EXCEDERÁ EL MONTO TOTAL DE LOS FEES EFECTIVAMENTE PAGADOS POR EL USUARIO AL PROTOCOLO EN LOS 12 MESES ANTERIORES AL EVENTO GENERADOR DEL DAÑO, O USD 100 (CIEN DÓLARES ESTADOUNIDENSES), EL MONTO QUE SEA MENOR. AIONICA NO SERÁ RESPONSABLE POR DAÑOS CONSECUENTES, INCIDENTALES, ESPECIALES, PUNITIVOS O EJEMPLARES, INCLUSO SI FUE INFORMADA DE SU POSIBILIDAD.

Indemnización: El usuario se compromete a indemnizar, defender y mantener indemne a AIONICA Security Lab y sus colaboradores de cualquier reclamo, daño, pérdida, costo y gasto (incluyendo honorarios legales razonables) derivados de: (a) el uso del protocolo por parte del usuario; (b) violación de estos términos; (c) violación de leyes de sanciones o AML; (d) reclamaciones de terceros relacionadas con la participación del usuario.

15. Resolución de Disputas y Arbitraje

CUALQUIER DISPUTA, CONTROVERSIA O RECLAMO DERIVADO DE ESTOS TÉRMINOS O DEL USO DEL PROTOCOLO SERÁ RESUELTO EXCLUSIVAMENTE MEDIANTE ARBITRAJE INTERNACIONAL VINCULANTE E INDIVIDUAL, ADMINISTRADO CONFORME A LAS REGLAS DE LA CÁMARA DE COMERCIO INTERNACIONAL (CCI).

Renuncia a acción colectiva: EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, EL USUARIO RENUNCIA EXPRESAMENTE A SU DERECHO DE PARTICIPAR EN CUALQUIER DEMANDA COLECTIVA (CLASS ACTION), ARBITRAJE COLECTIVO O PROCEDIMIENTO REPRESENTATIVO CONTRA AIONICA SECURITY LAB.

El arbitraje se realizará en idioma español o inglés, a elección de AIONICA. El laudo arbitral será definitivo y vinculante. Esta cláusula no impide al usuario recurrir a autoridades de protección al consumidor donde dicho derecho sea irrenunciable por ley.

16. Jurisdicción y Ley Aplicable

El protocolo opera de forma autónoma en World Chain, red pública global. AIONICA Security Lab no realiza marketing dirigido a jurisdicciones específicas. La disponibilidad del protocolo depende de la infraestructura de World Chain y World ID. El usuario es el único responsable de cumplir con las leyes locales aplicables. Los consumidores en jurisdicciones donde los derechos de protección al consumidor sean irrenunciables por ley conservan dichos derechos. Dado que los contratos son inmutables, no existe mecanismo de apelación, reversión ni mediación para disputas derivadas del protocolo en sí mismo.

17. Disposiciones Generales

• Separabilidad: Si cualquier cláusula fuera declarada inválida, las restantes continuarán en plena vigencia. La cláusula inválida será reemplazada por la disposición válida más cercana a la intención original.
• Integridad del acuerdo: Estos términos constituyen el acuerdo completo entre el usuario y AIONICA Security Lab respecto al protocolo Trust Circle.
• Sin renuncia: La falta de AIONICA de ejercer cualquier derecho no constituye renuncia al mismo.
• Actualización: AIONICA puede actualizar estos términos documentales. Los contratos on-chain son inmutables. La versión vigente estará disponible en el repositorio oficial del protocolo. Las actualizaciones no afectan contratos ya desplegados.
• Sin relación de agencia: Nada en estos términos crea relación de agencia, sociedad, joint venture, empleo ni representación entre el usuario y AIONICA Security Lab.
• Sin asesoramiento: AIONICA no proporciona asesoramiento de inversión, legal, tributario ni financiero. El usuario declara haber consultado con asesores independientes antes de participar.

18. Información Técnica — Contratos Desplegados

• TrustCircle v6.0: 0xc32Bdc20014B8aE63FCA57597b29DAC856BCE2Cf — Principal: Círculos, contribuciones, distribuciones
• AionicoToken v5.1: 0x89C2A3fC33bc7cc1140e6408e050De230D5cC0Dc — Token de utilidad ERC-20
• MembershipContract v1.0: 0x9adCCF3df7170ae5bED7dD17FDb977F866b0f8B3 — Deuda, scoring, elegibilidad
• MembershipInsurance v1.0: 0xB953016dF10c80496E86E8779697972cC9780094 — Fondo de garantía colectiva
• AionicaVRF v2.0: 0x1b82bFcE5f96c15086A77e0f98340edE0A287E4B — Aleatoriedad verificable

Red: World Chain (EVM compatible, Chain ID 480). Transacciones gratuitas para usuarios verificados con World ID. Código fuente disponible públicamente. Los contratos han sido sometidos a revisión técnica interna con fines de optimización lógica. Dicha revisión no sustituye una auditoría de seguridad externa independiente.

19. Aceptación de Términos

AL UNIRSE A UN CÍRCULO O REALIZAR CONTRIBUCIONES EN EL PROTOCOLO TRUST CIRCLE, EL USUARIO DECLARA QUE: (a) ha leído, comprendido y acepta íntegramente estos Términos y Condiciones; (b) reconoce, acepta y asume todos los riesgos descritos en la Sección 13; (c) es mayor de edad en su jurisdicción y tiene capacidad legal plena para celebrar este acuerdo; (d) no es una persona sancionada bajo las listas OFAC, ONU o UE; (e) ha verificado la legalidad de su participación bajo sus leyes locales; (f) comprende que los contratos son inmutables, irreversibles y no existe mecanismo de recuperación de fondos.

AIONICA Security Lab · Versión 3.0 · Marzo 2026
"Compilamos desde fuente. Auditamos desde cero."
Este documento no constituye asesoramiento legal. Consulte a un profesional calificado en su jurisdicción.`;

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
            Versión 3.0 · Marzo 2026 · World Chain
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
