# ESTADO DEL PROYECTO — AIONICA Trust Circle

## LEYENDA
- ✅ COMPLETO — funciona ahora mismo
- ⚠️  PENDIENTE — necesita acción antes de funcionar
- 🔌 LISTO — código armado, solo falta la dirección del contrato
- 📝 MANUAL — vos tenés que pegar el contenido

---

## PÁGINAS

| Página               | Archivo                              | Estado   |
|----------------------|--------------------------------------|----------|
| Home                 | src/app/page.tsx                     | ✅       |
| Crear círculo        | src/app/circles/new/page.tsx         | ✅       |
| Detalle del círculo  | src/app/circles/[id]/page.tsx        | ✅ / 🔌  |
| Explorar             | src/app/explore/page.tsx             | ✅       |
| Historial            | src/app/history/page.tsx             | ✅       |
| Perfil + Membresía   | src/app/profile/page.tsx             | ✅ / ⚠️  |
| Guía para usuarios   | src/app/guia/page.tsx                | 📝       |
| Términos             | src/app/tyc/page.tsx                 | 📝       |

---

## APIS

| Endpoint                              | Estado | Notas                    |
|---------------------------------------|--------|--------------------------|
| GET  /api/circles                     | ✅     |                          |
| POST /api/circles                     | ✅     |                          |
| GET  /api/circles/[id]                | ✅     |                          |
| POST /api/circles/[id]/join           | ✅     |                          |
| POST /api/circles/[id]/contribute     | ⚠️     | FALTA CREAR              |
| GET  /api/circles/[id]/payment-status | ⚠️     | FALTA CREAR              |
| GET  /api/explore                     | ✅     |                          |
| GET  /api/history                     | ✅     |                          |
| GET  /api/profile/stats               | ✅     |                          |

---

## CONTRATOS — PENDIENTE DE DEPLOY

| Contrato            | Estado                        |
|---------------------|-------------------------------|
| AionicaVRF          | ⚠️ Deploy pendiente (paso 1)  |
| AionicoToken        | ⚠️ Deploy pendiente (paso 2)  |
| MembershipInsurance | ⚠️ Deploy pendiente (paso 3)  |
| MembershipContract  | ⚠️ Deploy pendiente (paso 4)  |
| TrustCircle         | ⚠️ Deploy pendiente (paso 5)  |

Cuando tengas las addresses:
  nano src/app/circles/[id]/page.tsx
  Buscar: TRUST_CIRCLE_ADDRESS = ''
  Pegar la address

---

## CONTENIDO PENDIENTE DE PEGAR

  nano src/app/guia/page.tsx   <- pegar texto de guía
  nano src/app/tyc/page.tsx    <- pegar texto de TyC

---

## PRÓXIMOS PASOS

1. npm run dev  <- probar que compila
2. Pegar textos de TyC y Guía con nano
3. Conseguir 0.002 ETH -> bridge a World Chain
4. Deploy de los 5 contratos
5. Pegar TRUST_CIRCLE_ADDRESS en circles/[id]/page.tsx
6. Activar botones de membresía en profile/page.tsx
