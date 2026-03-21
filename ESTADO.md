# ESTADO DEL PROYECTO — AIONICA Trust Circle
Actualizado: 21 Marzo 2026

## CONTRATOS DESPLEGADOS — World Chain Mainnet (480)

AionicaVRF:          0x1b82bFcE5f96c15086A77e0f98340edE0A287E4B
TrustCircle:         0xc32Bdc20014B8aE63FCA57597b29DAC856BCE2Cf
MembershipInsurance: 0xB953016dF10c80496E86E8779697972cC9780094
MembershipContract:  0x9adCCF3df7170ae5bED7dD17FDb977F866b0f8B3
AionicoToken:        0x89C2A3fC33bc7cc1140e6408e050De230D5cC0Dc

## SETTERS VERIFICADOS ON-CHAIN

✅ MC.insuranceFund     → 0xB953 (MembershipInsurance)
✅ MC.trustCircle       → 0xc32B (TrustCircle)
✅ TC.membershipContract → 0x9adC (MembershipContract)
✅ TC.membershipInsurance → 0xB953 (MembershipInsurance)
✅ TC.aionicoToken      → 0x89C2 (AionicoToken)

## ESTADO GENERAL

✅ 5 contratos desplegados
✅ 9 setters ejecutados y verificados on-chain
✅ Frontend conectado a contratos reales
✅ Membresía L1-L5 activa (subscribe en profile)
✅ Botón contribuir activo (Permit2)
✅ Build limpio (21/21 páginas)
✅ Submit for review — Developer Portal (In Review)
✅ PR #1293 abierto — AIONICO en token list ethereum-optimism
✅ TyC v3 + Guía v1.0 pegados en frontend
✅ Callchain verificado frontend ↔ contratos

## CHECKPOINT — VOLVER A ESTADO FUNCIONAL
git checkout b03b437

## GAP IDENTIFICADO — PENDIENTE IMPLEMENTAR

⏳ settleDebt() — usuario moroso no puede rehabilitarse desde la UI

Pasos para cerrar el gap:
1. Crear src/abi/MembershipContract.json (totalDebt + settleDebt)
2. Agregar lectura totalDebt(wallet, USDC/WLD/AIONICO) en api/profile/stats/route.ts
3. Agregar card deuda + botón Saldar en profile/page.tsx (visible si isEligible=false)
4. Flujo: approve(MembershipContract, amount) → settleDebt(token, amount)
5. Build + push

## PRÓXIMOS PASOS POST-REVIEW

- Bounty público Code4rena / Sherlock (después de aprobación World App)
- Preparar: docs técnicos, scope, líneas en scope, prize pool estimado
