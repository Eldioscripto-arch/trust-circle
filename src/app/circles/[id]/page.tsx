'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js'
import { useSession } from 'next-auth/react'

type Circle = {
  id: string
  name: string
  creator_wallet: string
  contribution_amount: number
  cycle_duration_seconds: number
  max_members: number
  member_count: number
  status: string
  is_public: boolean
  invite_code: string | null
  created_at: string
}

type Member = {
  wallet: string
  position: number
  joined_at: string
}

function formatDuration(seconds: number): string {
  if (seconds >= 2592000) return `${Math.round(seconds / 2592000)} mes(es)`
  if (seconds >= 604800) return `${Math.round(seconds / 604800)} semana(s)`
  if (seconds >= 86400) return `${Math.round(seconds / 86400)} día(s)`
  return `${seconds}s`
}

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
}

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = useSession()

  const [circle, setCircle] = useState<Circle | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const wallet = session?.user?.id?.toLowerCase()

  useEffect(() => {
    fetch(`/api/circles/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.circle) { setCircle(d.circle); setMembers(d.members) }
        else setError('Círculo no encontrado')
      })
      .catch(() => setError('Error cargando el círculo'))
      .finally(() => setLoading(false))
  }, [id])

  const isMember = wallet && members.some(m => m.wallet.toLowerCase() === wallet)
  const isFull = circle ? circle.member_count >= circle.max_members : false
  const canJoin = !isMember && !isFull && circle?.status === 'open'

  async function handleJoin() {
    if (!MiniKit.isInstalled()) { setError('Abre la app desde World App'); return }
    if (!wallet) { setError('Debes iniciar sesión primero'); return }
    setJoining(true); setError('')
    try {
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: 'join-circle-v1',
        signal: wallet,
        verification_level: VerificationLevel.Orb,
      })
      if (finalPayload.status === 'error') {
        setError('Verificación cancelada'); setJoining(false); return
      }
      const res = await fetch(`/api/circles/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: finalPayload.proof,
          merkle_root: finalPayload.merkle_root,
          nullifier_hash: finalPayload.nullifier_hash,
          verification_level: finalPayload.verification_level,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al unirse') }
      else {
        setSuccess(`¡Te uniste! Posición #${data.position + 1}`)
        const updated = await fetch(`/api/circles/${id}`).then(r => r.json())
        if (updated.circle) { setCircle(updated.circle); setMembers(updated.members) }
      }
    } catch { setError('Error inesperado') }
    finally { setJoining(false) }
  }

  if (loading) return (
    <div style={{background:'#0d1117',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:'#f0b429',fontFamily:'sans-serif',fontSize:18}}>Cargando...</div>
    </div>
  )

  if (!circle) return (
    <div style={{background:'#0d1117',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{color:'#e53e3e',fontFamily:'sans-serif',fontSize:18}}>Círculo no encontrado</div>
      <button onClick={() => router.push('/')} style={{background:'#161b22',color:'#f0b429',border:'1px solid #2a3441',padding:'12px 24px',borderRadius:12,cursor:'pointer'}}>← Volver</button>
    </div>
  )

  const slotsLeft = circle.max_members - circle.member_count
  const progressPct = Math.round((circle.member_count / circle.max_members) * 100)
  const potentialPool = circle.contribution_amount * circle.max_members
  const fee = potentialPool * 0.01
  const net = potentialPool - fee

  return (
    <div style={{background:'#0d1117',minHeight:'100vh',maxWidth:430,margin:'0 auto',color:'#e2e8f0',fontFamily:"'DM Sans',sans-serif",overflowX:'hidden'}}>
      {/* Header */}
      <div style={{padding:'20px 20px 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <button onClick={() => router.push('/')} style={{background:'none',border:'none',color:'#f0b429',fontSize:22,cursor:'pointer',padding:'4px 8px'}}>←</button>
        <span style={{fontFamily:'Syne,sans-serif',fontWeight:700,fontSize:16}}>Detalle del círculo</span>
        <div style={{width:32}} />
      </div>

      {/* Main card */}
      <div style={{margin:'16px 20px 0',background:'#161b22',border:'1px solid #2a3441',borderRadius:20,padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontFamily:'Syne,sans-serif',fontSize:20,fontWeight:800,letterSpacing:-0.5}}>{circle.name}</div>
            <div style={{fontSize:12,color:'#718096',marginTop:4}}>por {shortWallet(circle.creator_wallet)}</div>
          </div>
          <div style={{padding:'4px 12px',borderRadius:20,fontSize:12,fontWeight:600,background:circle.status==='open'?'rgba(240,180,41,0.15)':circle.status==='active'?'rgba(56,161,105,0.15)':'rgba(99,179,237,0.15)',color:circle.status==='open'?'#f0b429':circle.status==='active'?'#68d391':'#63b3ed'}}>
            {circle.status==='open'?'Abierto':circle.status==='active'?'Activo':'Completado'}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16}}>
          {[
            ['Contribución', `$${circle.contribution_amount} USDC`, '#e2e8f0'],
            ['Duración ciclo', formatDuration(circle.cycle_duration_seconds), '#e2e8f0'],
            ['Pozo neto', `$${net.toFixed(2)}`, '#f0b429'],
            ['Fee protocolo', `$${fee.toFixed(2)} (1%)`, '#e2e8f0'],
          ].map(([label, value, color]) => (
            <div key={label} style={{background:'#1c2330',borderRadius:12,padding:'10px 12px'}}>
              <div style={{fontSize:10,color:'#718096',textTransform:'uppercase',letterSpacing:1}}>{label}</div>
              <div style={{fontSize:15,fontWeight:600,color:color as string,marginTop:4}}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{marginTop:16}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontSize:11,color:'#718096'}}>{circle.member_count}/{circle.max_members} miembros</span>
            <span style={{fontSize:11,color:slotsLeft>0?'#f0b429':'#68d391'}}>{slotsLeft>0?`${slotsLeft} slots libres`:'Círculo lleno'}</span>
          </div>
          <div style={{height:6,background:'#1c2330',borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:3,width:`${progressPct}%`,background:slotsLeft>0?'#f0b429':'#68d391',transition:'width 0.4s'}} />
          </div>
        </div>
      </div>

      {success && <div style={{margin:'12px 20px 0',background:'rgba(56,161,105,0.12)',border:'1px solid rgba(56,161,105,0.3)',borderRadius:12,padding:'12px 16px',fontSize:14,color:'#68d391'}}>🎉 {success}</div>}
      {error && <div style={{margin:'12px 20px 0',background:'rgba(229,62,62,0.1)',border:'1px solid rgba(229,62,62,0.3)',borderRadius:12,padding:'12px 16px',fontSize:14,color:'#fc8181'}}>⚠️ {error}</div>}

      {/* Join button */}
      <div style={{padding:'0 20px'}}>
        {!isMember && canJoin && (
          <button onClick={handleJoin} disabled={joining} style={{width:'100%',background:joining?'#a07820':'linear-gradient(135deg,#f0b429,#ed8936)',color:'#000',border:'none',padding:16,borderRadius:16,fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700,cursor:joining?'not-allowed':'pointer',marginTop:16}}>
            {joining?'Verificando con World ID...':'🌐 Unirse con World ID'}
          </button>
        )}
        {!isMember && !canJoin && circle.status==='open' && (
          <div style={{textAlign:'center',color:'#718096',fontSize:14,marginTop:16,padding:14,background:'#161b22',borderRadius:12,border:'1px solid #2a3441'}}>Este círculo está lleno</div>
        )}
        {isMember && (
          <div style={{background:'rgba(56,161,105,0.12)',border:'1px solid rgba(56,161,105,0.3)',borderRadius:12,padding:'14px 16px',fontSize:14,color:'#68d391',textAlign:'center',marginTop:16}}>✅ Eres miembro de este círculo</div>
        )}
      </div>

      {/* Members */}
      <div style={{margin:'24px 20px 12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontFamily:'Syne,sans-serif',fontSize:16,fontWeight:700}}>Miembros</span>
        <span style={{background:'rgba(240,180,41,0.15)',color:'#f0b429',fontSize:12,fontWeight:600,padding:'2px 10px',borderRadius:20}}>{circle.member_count}</span>
      </div>

      <div style={{padding:'0 20px',display:'flex',flexDirection:'column',gap:8,paddingBottom:40}}>
        {members.map((m, i) => {
          const colors=['#f0b429','#ed8936','#68d391','#63b3ed','#b794f4','#fc8181']
          return (
            <div key={m.wallet} style={{background:'#161b22',border:'1px solid #2a3441',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:colors[i%colors.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#000',flexShrink:0}}>#{i+1}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:500}}>{m.wallet.toLowerCase()===wallet?'👤 Tú':shortWallet(m.wallet)}</div>
                <div style={{fontSize:11,color:'#718096',marginTop:2}}>{new Date(m.joined_at).toLocaleDateString('es',{day:'numeric',month:'short'})}</div>
              </div>
              <div style={{fontSize:12,color:'#718096'}}>Turno {m.position+1}</div>
            </div>
          )
        })}
        {Array.from({length:slotsLeft}).map((_,i) => (
          <div key={`e${i}`} style={{background:'#161b22',border:'1px solid #2a3441',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,opacity:0.35}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:'#2a3441',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#718096',flexShrink:0}}>?</div>
            <div style={{flex:1}}><div style={{fontSize:14,color:'#718096'}}>Slot disponible</div></div>
            <div style={{fontSize:12,color:'#718096'}}>Turno {members.length+i+1}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
