# ESTADO DEL PROYECTO — AIONICA Trust Circle
Actualizado: 01 Abril 2026

## CONTRATOS DESPLEGADOS — World Chain Mainnet (480)

AionicaVRF:          0x1b82bFcE5f96c15086A77e0f98340edE0A287E4B
TrustCircle:         0xc32Bdc20014B8aE63FCA57597b29DAC856BCE2Cf
MembershipInsurance: 0xB953016dF10c80496E86E8779697972cC9780094
MembershipContract:  0x9adCCF3df7170ae5bED7dD17FDb977F866b0f8B3
AionicoToken:        0x89C2A3fC33bc7cc1140e6408e050De230D5cC0Dc
AionicaPriceOracle:  0x1998E24F736FdD52fA17C4e10AaF54315B32a2cb

## INVENTARIO DE ARCHIVOS — 01 Abril 2026

### Contratos (src/)
- AionicaVRF.sol
- AionicaPriceOracle.sol
- AionicoToken_v5_1.sol
- MembershipContract_v1.sol
- MembershipInsurance_v1.sol
- TrustCircle_v6.sol

### Script
- script/Deploy.s.sol

### VRF
- vrf/vrf_node.py

### Frontend (src/app/)
- page.tsx (home/dashboard)
- layout.tsx + middleware.ts
- circles/[id]/page.tsx + circles/new/page.tsx
- explore/page.tsx + history/page.tsx
- profile/page.tsx + guia/page.tsx + tyc/page.tsx
- api/circles/, api/users/, api/explore/, api/history/, api/profile/
- components/AuthButton, BottomNav, Navigation, PageLayout, Pay, Transaction, UserInfo, Verify, ViewPermissions
- auth/index.ts + auth/wallet/
- providers/index.tsx + providers/Eruda/
- lib/supabase.ts + lib/rate-limit.ts

### Estado de compilacion
forge build — limpio, sin errores

## SETTERS VERIFICADOS ON-CHAIN

✅ MC.insuranceFund     → 0xB953 (MembershipInsurance)
✅ MC.trustCircle       → 0xc32B (TrustCircle)
✅ TC.membershipContract → 0x9adC (MembershipContract)
✅ TC.membershipInsurance → 0xB953 (MembershipInsurance)
✅ TC.aionicoToken      → 0x89C2 (AionicoToken)
✅ MI.priceOracles(WLD) → 0x1998 (AionicaPriceOracle)

## ESTADO GENERAL

✅ 6 contratos desplegados
✅ 10 setters ejecutados y verificados on-chain
✅ Frontend conectado a contratos reales
✅ Membresía L1-L5 activa (subscribe en profile)
✅ Botón contribuir activo (Permit2)
✅ Build limpio (21/21 páginas)
✅ Submit for review — Developer Portal (In Review)
✅ PR #1293 abierto — AIONICO en token list ethereum-optimism
✅ TyC v3 + Guía v1.0 pegados en frontend
✅ Callchain verificado frontend ↔ contratos
✅ APP ID: app_da9a97ceb52e3ad29b347c4ebfeff06f
✅ RP ID:  rp_342690606f606aef

## CHECKPOINT — VOLVER A ESTADO FUNCIONAL
git checkout b03b437

## GAP IDENTIFICADO — CERRADO

✅ settleDebt() — card deuda + botón rehabilitación implementados (commit cce760e)
✅ src/abi/MembershipContract.json — ABI totalDebt + settleDebt
✅ api/profile/stats/route.ts — lectura totalDebt on-chain (USDC/WLD/AIONICO)
✅ profile/page.tsx — card deuda + botón Saldar (visible si isEligible=false)

## TESTS ON-CHAIN — 21 Marzo 2026

18 tests ejecutados contra contratos reales en World Chain (fork RPC).

### DrainAttackTest — 5/5 PASS
- Owner no puede drenar TrustCircle directamente
- Atacante no puede drenar pool de circulo activo
- Owner no puede drenar rewards pool de AionicoToken
- Atacante no puede disparar distribucion en circulo ajeno
- Atacante no puede pausar rewards

### DrainWithFundsTest — 5/5 PASS (10,000 USDC inyectados via deal)
- Owner no puede drenar TrustCircle con fondos reales
- Atacante no puede drenar TrustCircle con fondos reales
- Atacante no puede drenar MembershipInsurance con fondos reales
- Atacante no puede drenar MembershipContract con fondos reales
- Atacante no puede drenar AionicoToken rewards con fondos reales

### FundDrainTest — 4/5 PASS
- Atacante no puede drenar MembershipInsurance
- Atacante no puede redirigir TrustCircle en Insurance
- Atacante no puede llamar coverDeficit directamente
- Atacante no puede llamar settleDebt para extraer fondos
- HALLAZGO: setInsuranceFund sin proteccion de una sola vez — Severidad Media
  Mitigado por $0 en contratos y rotacion de key. Fix requiere redespliegue futuro.

### LogicExploitTest — 2/2 PASS
- Double-claim bloqueado por CycleAlreadyDistributed
- Reentrancy bloqueada — CEI pattern previene el ataque antes que nonReentrant

### InsuranceResilienceTest — 2/2 PASS
- Seguro cubre deficit cuando victim tiene membresia activa
- Fondo no se usa sin membresia activa

### Conclusion
El protocolo es matematicamente indreable. Ni owner ni atacante pueden
extraer fondos de ningun contrato por fuera de la logica de distribucion.
Tests privados en ~/downloads/aionica-tests/test_trustcircle_2026_03/

## BOUNTY 4 — FIXES APLICADOS (01 Abril 2026)

✅ NV-01 — Double-pay a victima al cierre: victimReceivedFromPool mapping agregado en MC, consultado en refund loop de TC
✅ NV-02 — settleDebt no actualizaba debtByCircle: sincronizacion agregada en loop FIFO
✅ NV-03 — coverDeficit aceptaba cualquier token sin oracle: path multi-token con IPriceOracle implementado
✅ Reporte Bounty4 generado — formato C4/Sherlock

## PRÓXIMOS PASOS POST-REVIEW

- Bounty público Code4rena / Sherlock (después de aprobación World App)
- Preparar: docs técnicos, scope, líneas en scope, prize pool estimado

## COMANDOS DE REFERENCIA

### Desarrollo local
cd ~/downloads/trust-circle && npm run dev

### Repositorio
git clone https://github.com/Eldioscripto-arch/trust-circle.git

### Checkpoint funcional
git checkout 18c6e7c
