'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import SponsorBanner from '../../components/SponsorBanner'

const PT = {
  "Algeria":"Argélia","Argentina":"Argentina","Australia":"Austrália","Austria":"Áustria",
  "Belgium":"Bélgica","Bosnia & Herzegovina":"Bósnia e Herzegovina","Brazil":"Brasil",
  "Canada":"Canadá","Cape Verde Islands":"Cabo Verde","Colombia":"Colômbia","Congo DR":"RD Congo",
  "Croatia":"Croácia","Curaçao":"Curaçao","Czech Republic":"Rep. Tcheca","Ecuador":"Equador",
  "Egypt":"Egito","England":"Inglaterra","France":"França","Germany":"Alemanha","Ghana":"Gana",
  "Haiti":"Haiti","Iran":"Irã","Iraq":"Iraque","Ivory Coast":"Costa do Marfim","Japan":"Japão",
  "Jordan":"Jordânia","Mexico":"México","Morocco":"Marrocos","Netherlands":"Holanda",
  "New Zealand":"Nova Zelândia","Norway":"Noruega","Panama":"Panamá","Paraguay":"Paraguai",
  "Portugal":"Portugal","Qatar":"Catar","Saudi Arabia":"Arábia Saudita","Scotland":"Escócia",
  "Senegal":"Senegal","South Africa":"África do Sul","South Korea":"Coreia do Sul","Spain":"Espanha",
  "Sweden":"Suécia","Switzerland":"Suíça","Tunisia":"Tunísia","Türkiye":"Turquia",
  "Uruguay":"Uruguai","USA":"Estados Unidos","Uzbekistan":"Uzbequistão"
}

const ABBR = {
  "Algeria":"ALG","Argentina":"ARG","Australia":"AUS","Austria":"AUT",
  "Belgium":"BEL","Bosnia & Herzegovina":"BIH","Brazil":"BRA",
  "Canada":"CAN","Cape Verde Islands":"CBV","Colombia":"COL","Congo DR":"RDC",
  "Croatia":"CRO","Curaçao":"CUR","Czech Republic":"TCH","Ecuador":"EQU",
  "Egypt":"EGI","England":"ING","France":"FRA","Germany":"ALE","Ghana":"GHA",
  "Haiti":"HAI","Iran":"IRÃ","Iraq":"IRA","Ivory Coast":"CIV","Japan":"JAP",
  "Jordan":"JOR","Mexico":"MEX","Morocco":"MAR","Netherlands":"HOL",
  "New Zealand":"NZL","Norway":"NOR","Panama":"PAN","Paraguay":"PAR",
  "Portugal":"POR","Qatar":"QAT","Saudi Arabia":"SAU","Scotland":"ESC",
  "Senegal":"SEN","South Africa":"RSA","South Korea":"COR","Spain":"ESP",
  "Sweden":"SUE","Switzerland":"SUI","Tunisia":"TUN","Türkiye":"TUR",
  "Uruguay":"URU","USA":"EUA","Uzbekistan":"UZB"
}

const sigla = n => ABBR[n] || (PT[n]?.slice(0,3).toUpperCase()) || n?.slice(0,3).toUpperCase() || '?'
const nome  = n => PT[n] || n || 'A definir'

function isKnockout(r) {
  return ['Round of 32','Round of 16','Quarter-finals','Semi-finals','3rd Place Final','Final'].includes(r)
}

function isMatchFinished(m) {
  if (!m) return false
  const s = m?.status_short || m?.fixture?.status?.short || ''
  return !!(m?.is_finished || ['FT','AET','PEN'].includes(s))
}

function matchWinner(m) {
  if (!isMatchFinished(m)) return null
  const gH = m?.goals?.home ?? null
  const gA = m?.goals?.away ?? null
  if (gH === null || gA === null) return null
  const pH = m?.score?.penalty?.home ?? null
  const pA = m?.score?.penalty?.away ?? null
  if (pH !== null && pA !== null) return pH > pA ? m.teams?.home : m.teams?.away
  if (gH > gA) return m.teams?.home
  if (gA > gH) return m.teams?.away
  return null
}

// ─── Organiza chaveamento oficial Copa 2026 (ordem cronológica = seeding) ────
function buildPerfectBracket(matches) {
  const sortCrono = arr => [...(arr || [])].sort((a, b) =>
    new Date(a.start_time || a.fixture?.date || 0) - new Date(b.start_time || b.fixture?.date || 0)
  )
  const r32 = sortCrono(matches['Round of 32'])
  const r16 = sortCrono(matches['Round of 16'])
  const qf  = sortCrono(matches['Quarter-finals'])
  const sf  = sortCrono(matches['Semi-finals'])
  const fin = sortCrono(matches['Final'])
  const g   = (arr, i) => arr[i] || null

  const tree = {
    L: {
      r32: [g(r32,2),g(r32,5),g(r32,0),g(r32,3),g(r32,11),g(r32,10),g(r32,9),g(r32,8)],
      r16: [g(r16,1),g(r16,0),g(r16,4),g(r16,5)],
      qf:  [g(qf,0), g(qf,1)],
      sf:  [g(sf,0)],
    },
    R: {
      r32: [g(r32,1),g(r32,4),g(r32,6),g(r32,7),g(r32,14),g(r32,13),g(r32,12),g(r32,15)],
      r16: [g(r16,2),g(r16,3),g(r16,6),g(r16,7)],
      qf:  [g(qf,2), g(qf,3)],
      sf:  [g(sf,1)],
    },
    final: [g(fin,0)],
  }

  // Propaga vencedores para o próximo quadrado mesmo sem jogo agendado ainda
  propagateWinners(tree)
  return tree
}

// ─── Propagação de vencedores ─────────────────────────────────────────────────
// Quando um jogo termina, coloca o time vencedor no slot do próximo round,
// mesmo que o adversário ainda não tenha jogado.
function propagateWinners(tree) {
  const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf']

  ;['L', 'R'].forEach(side => {
    for (let ri = 0; ri < ROUND_ORDER.length - 1; ri++) {
      const curKey  = ROUND_ORDER[ri]
      const nextKey = ROUND_ORDER[ri + 1]
      const src = tree[side][curKey] || []
      const tgt = tree[side][nextKey] || []

      for (let i = 0; i < src.length; i++) {
        const winner = matchWinner(src[i])
        if (!winner) continue

        const nextIdx = Math.floor(i / 2)
        const isHome  = i % 2 === 0

        // Garante que o slot existe
        if (!tgt[nextIdx]) {
          tgt[nextIdx] = { _projected: true, teams: { home: null, away: null },
                           goals: { home: null, away: null }, score: {} }
        }

        const nm = tgt[nextIdx]
        // Só injeta se a API ainda não preencheu aquele time
        if (isHome && !nm.teams?.home?.id) {
          nm.teams = { ...nm.teams, home: winner }
        } else if (!isHome && !nm.teams?.away?.id) {
          nm.teams = { ...nm.teams, away: winner }
        }
      }

      tree[side][nextKey] = tgt
    }
  })

  // SF → Final
  const lWin = matchWinner(tree.L.sf[0])
  const rWin = matchWinner(tree.R.sf[0])
  if (lWin || rWin) {
    if (!tree.final[0]) {
      tree.final[0] = { _projected: true, teams: { home: null, away: null },
                        goals: { home: null, away: null }, score: {} }
    }
    const f = tree.final[0]
    if (lWin && !f.teams?.home?.id) f.teams = { ...f.teams, home: lWin }
    if (rWin && !f.teams?.away?.id) f.teams = { ...f.teams, away: rWin }
  }
}

// ─── Constantes visuais ───────────────────────────────────────────────────────
const B_COL  = 90
const B_GAP  = 16
const B_STEP = B_COL + B_GAP
const B_CARD = 42
const B_SLOT = 52
const GOLD   = '#c9941f'
const NAVY2  = '#0c1f3a'
const DIVCLR = '#0e2040'

// ─── Card do chaveamento ──────────────────────────────────────────────────────
function BracketCard({ match }) {
  // Slot vazio (sem match e sem projeção)
  if (!match) return (
    <div style={{
      height:B_CARD, width:B_COL,
      border:`1px solid ${GOLD}18`, background:'rgba(7,21,42,0.4)',
      borderRadius:5, display:'flex', flexDirection:'column',
    }}>
      {[0,1].map(i => (
        <div key={i} style={{
          flex:1, display:'flex', alignItems:'center', paddingLeft:6,
          borderBottom: i===0 ? `1px solid ${DIVCLR}80` : 'none',
        }}>
          <div style={{ width:14, height:14, borderRadius:3, background:'rgba(255,255,255,0.04)', marginRight:6 }} />
          <span style={{ color:'rgba(255,255,255,0.15)', fontSize:9, fontWeight:700 }}>A definir</span>
        </div>
      ))}
    </div>
  )

  const finished   = isMatchFinished(match)
  const projected  = !!match._projected && !finished  // projetado mas não jogado ainda
  const home = match.teams?.home
  const away = match.teams?.away
  const gH   = match.goals?.home ?? null
  const gA   = match.goals?.away ?? null
  const pH   = match.score?.penalty?.home ?? null
  const pA   = match.score?.penalty?.away ?? null
  const hasPen   = pH !== null && pA !== null
  const homeWins = finished && (hasPen ? pH > pA : (gH??0) > (gA??0))
  const awayWins = finished && (hasPen ? pA > pH : (gA??0) > (gH??0))

  // Borda: dourado=encerrado, azul tracejado=projeção, translúcido=futuro
  const borderStyle = finished
    ? `1.5px solid ${GOLD}`
    : projected
      ? `1px dashed ${GOLD}50`
      : `1px solid ${GOLD}30`

  const Row = ({ team, goals, wins, loses }) => (
    <div style={{
      flex:1, display:'flex', alignItems:'center', paddingLeft:4, paddingRight:3,
      background: wins ? 'rgba(6,78,40,0.55)' : loses ? 'rgba(0,0,0,0.2)' : 'transparent',
    }}>
      {team?.logo
        ? <img src={team.logo} alt="" style={{ width:14, height:14, objectFit:'contain', marginRight:4 }}
            onError={e => { e.target.style.display='none' }} />
        : <div style={{ width:14, height:14, borderRadius:'50%', background:'rgba(255,255,255,0.08)', marginRight:4 }} />
      }
      <span style={{
        flex:1, fontSize:10, fontWeight:800, letterSpacing:'0.02em',
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        color: wins ? '#86efac'
             : loses ? '#64748b'
             : projected ? `${GOLD}cc`   // projeção: dourado suave
             : team?.name ? '#cbd5e1'    // time confirmado
             : 'rgba(255,255,255,0.2)',  // a definir
        fontStyle: projected && !finished ? 'italic' : 'normal',
      }}>
        {team?.name ? sigla(team.name) : 'A definir'}
      </span>
      {/* Placar: só mostra quando o jogo terminou */}
      <span style={{
        fontSize:11, fontWeight:900, minWidth:13, textAlign:'right',
        color: wins ? '#4ade80' : finished ? '#64748b' : '#1e3a5f',
      }}>
        {finished ? goals : '–'}
      </span>
    </div>
  )

  return (
    <div style={{
      height:B_CARD, width:B_COL, position:'relative',
      border: borderStyle,
      background: NAVY2, borderRadius:5, overflow:'hidden',
      display:'flex', flexDirection:'column',
      boxShadow: finished ? `0 0 8px ${GOLD}20` : 'none',
    }}>
      <Row team={home} goals={gH} wins={homeWins} loses={awayWins} />
      <div style={{ height:1, background:DIVCLR }} />
      <Row team={away} goals={gA} wins={awayWins} loses={homeWins} />
      {hasPen && finished && (
        <div style={{ background:'#78350f', color:'#fcd34d', fontSize:7, fontWeight:900, textAlign:'center', lineHeight:'10px' }}>
          PEN {pH}–{pA}
        </div>
      )}
    </div>
  )
}

// ─── Chaveamento ──────────────────────────────────────────────────────────────
function TournamentBracket({ bracketData }) {
  const [mobileTab, setMobileTab] = useState('center')
  const containerRef = useRef(null)

  const tree    = buildPerfectBracket(bracketData)
  const TOTAL_H = 8 * B_SLOT
  const TOTAL_W = 9 * B_STEP - B_GAP
  const cx = i => i * B_STEP
  const yC = (count, mi) => { const sh = TOTAL_H / Math.max(count,1); return mi*sh + sh/2 }

  const allCols = [
    { m:tree.L.r32,c:0 }, { m:tree.L.r16,c:1 }, { m:tree.L.qf,c:2 }, { m:tree.L.sf,c:3 },
    { m:tree.final,c:4 },
    { m:tree.R.sf,c:5 }, { m:tree.R.qf,c:6 }, { m:tree.R.r16,c:7 }, { m:tree.R.r32,c:8 },
  ]

  const cards = allCols.flatMap(({ m, c }) => {
    const sh = TOTAL_H / Math.max(m.length, 1)
    return m.map((match, mi) => (
      <div key={`c${c}-${mi}`} style={{ position:'absolute', left:cx(c), top:mi*sh+(sh-B_CARD)/2 }}>
        <BracketCard match={match} />
      </div>
    ))
  })

  const makeConn = (src, sc, tgt, tc) => {
    if (!src?.length || !tgt?.length) return null
    const goRight = sc < tc
    const xS   = goRight ? cx(sc)+B_COL+2 : cx(sc)-2
    const xT   = goRight ? cx(tc)-2 : cx(tc)+B_COL+2
    const xMid = (xS+xT)/2
    const r    = 6

    return Array.from({ length: Math.ceil(src.length/2) }, (_,p) => {
      const y1 = yC(src.length, p*2)
      const y2 = yC(src.length, p*2+1)
      const yM = yC(tgt.length, p)
      const dir = goRight ? -r : r
      return (
        <path key={`k${sc}-${tc}-${p}`} stroke={GOLD} strokeWidth="1.5" fill="none"
          opacity="0.5" strokeLinecap="round" strokeLinejoin="round"
          d={`M${xS} ${y1} H${xMid+dir} Q${xMid} ${y1} ${xMid} ${y1+r} V${y2-r} Q${xMid} ${y2} ${xMid+dir} ${y2} H${xS} M${xMid} ${yM} H${xT}`}
        />
      )
    })
  }

  const connSVG = [
    makeConn(tree.L.r32,0,tree.L.r16,1), makeConn(tree.L.r16,1,tree.L.qf,2),
    makeConn(tree.L.qf,2,tree.L.sf,3),   makeConn(tree.L.sf,3,tree.final,4),
    makeConn(tree.R.r32,8,tree.R.r16,7), makeConn(tree.R.r16,7,tree.R.qf,6),
    makeConn(tree.R.qf,6,tree.R.sf,5),   makeConn(tree.R.sf,5,tree.final,4),
  ]

  const LABELS = [
    {c:0,t:'16 AVOS'},{c:1,t:'OITAVAS'},{c:2,t:'QUARTAS'},{c:3,t:'SEMI'},
    {c:4,t:'FINAL',gold:true},
    {c:5,t:'SEMI'},{c:6,t:'QUARTAS'},{c:7,t:'OITAVAS'},{c:8,t:'16 AVOS'},
  ]

  const finalMatch = tree.final[0] ?? null
  const champion   = matchWinner(finalMatch)
  const third      = [...(bracketData['3rd Place Final']||[])].sort((a,b) =>
    new Date(a.start_time||0) - new Date(b.start_time||0)
  )

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    if (mobileTab==='left')   el.scrollTo({left:0,behavior:'smooth'})
    if (mobileTab==='center') el.scrollTo({left:(TOTAL_W/2)-(el.clientWidth/2),behavior:'smooth'})
    if (mobileTab==='right')  el.scrollTo({left:TOTAL_W,behavior:'smooth'})
  }, [mobileTab, TOTAL_W])

  return (
    <div style={{
      background:'linear-gradient(160deg,#040d1c 0%,#091729 45%,#040d1c 100%)',
      borderRadius:18, padding:'16px 0 14px',
      border:'1px solid rgba(201,148,31,0.18)',
      width:'100%', overflow:'hidden',
    }}>
      {/* Título */}
      <div style={{ textAlign:'center', marginBottom:14, padding:'0 12px' }}>
        <div style={{ fontSize:9, fontWeight:900, letterSpacing:'.35em', color:GOLD, marginBottom:2 }}>
          COPA DO MUNDO 2026
        </div>
        <div style={{ fontSize:18, fontWeight:900, letterSpacing:'.12em', color:'#f2c14e' }}>
          Caminho Até a Final
        </div>
      </div>

      {/* Banner campeão */}
      {champion && (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:12,
          padding:'8px 20px', margin:'0 auto 14px', borderRadius:10, maxWidth:300,
          background:'linear-gradient(90deg,rgba(201,148,31,.08),rgba(201,148,31,.18),rgba(201,148,31,.08))',
          border:'1px solid rgba(201,148,31,.3)',
        }}>
          <span style={{ fontSize:28 }}>🏆</span>
          {champion.logo && <img src={champion.logo} alt="" style={{ width:32,height:32,objectFit:'contain' }} />}
          <div>
            <div style={{ fontSize:8, color:GOLD, fontWeight:900, letterSpacing:'.3em', textTransform:'uppercase' }}>Campeão</div>
            <div style={{ fontSize:16, color:'#fff', fontWeight:900 }}>{nome(champion.name)}</div>
          </div>
        </div>
      )}

      {/* Controles mobile */}
      <div className="md:hidden flex justify-center gap-2 mb-4 px-2">
        {['left','center','right'].map(t => (
          <button key={t} onClick={() => setMobileTab(t)}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition
              ${mobileTab===t ? 'bg-yellow-600 text-white border-yellow-500' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
            {t==='left' ? 'ESQUERDA' : t==='center' ? 'CENTRO' : 'DIREITA'}
          </button>
        ))}
      </div>

      {/* Bracket */}
      <div ref={containerRef} className="no-scrollbar"
        style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', padding:'0 10px' }}>
        <div style={{ width:TOTAL_W, minWidth:TOTAL_W, position:'relative' }}>

          {/* Labels das fases */}
          <div style={{ position:'relative', height:20, marginBottom:6 }}>
            {LABELS.map(({ c, t, gold }) => (
              <div key={c} style={{
                position:'absolute', left:cx(c), width:B_COL,
                textAlign:'center', fontSize:8, fontWeight:900,
                color: gold ? '#f2c14e' : '#3a5a7a',
                borderBottom: gold ? `1.5px solid ${GOLD}` : 'none',
                paddingBottom:2,
              }}>
                {t}
              </div>
            ))}
          </div>

          {/* Área principal */}
          <div style={{ position:'relative', height:TOTAL_H }}>
            <svg style={{ position:'absolute', inset:0, overflow:'visible' }}
              width={TOTAL_W} height={TOTAL_H} viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}>
              {connSVG}
            </svg>
            {cards}
          </div>
        </div>
      </div>

      {/* 3° Lugar */}
      {third.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginTop:10, gap:4 }}>
          <div style={{ fontSize:8, fontWeight:900, letterSpacing:'.2em', color:'#9a6c2a' }}>🥉 3° Lugar</div>
          <BracketCard match={third[0]} />
        </div>
      )}
    </div>
  )
}

// ─── Tabela de Grupos ─────────────────────────────────────────────────────────
function StandingsTable({ groupData }) {
  if (!groupData?.length) return null
  const rawGroup      = groupData[0]?.group || ''
  const isNormalGroup = /^(Grupo|Group)\s+[A-Z0-9]/i.test(rawGroup)
  const is3rdTable    = !isNormalGroup || groupData.length > 4
  const title         = is3rdTable ? `${rawGroup ? rawGroup+' — ' : ''}3° Colocados` : rawGroup
  const qualThreshold = is3rdTable ? 8 : 2

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg h-fit mb-6 w-full">
      <div className="bg-gray-700 p-2.5 text-center font-bold text-yellow-400 text-xs uppercase tracking-wider">
        {title || 'Classificação'}
      </div>
      <div className="overflow-x-auto no-scrollbar w-full">
        <table className="w-full text-xs text-left whitespace-nowrap min-w-full">
          <thead>
            <tr className="bg-gray-900 text-gray-500 text-[10px]">
              <th className="p-2 text-center w-7">#</th><th className="p-2">Seleção</th>
              <th className="p-2 text-center">P</th><th className="p-2 text-center">J</th>
              <th className="p-2 text-center">V</th><th className="p-2 text-center">E</th>
              <th className="p-2 text-center">D</th><th className="p-2 text-center">SG</th>
            </tr>
          </thead>
          <tbody>
            {groupData.map((t, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/30">
                <td className={`p-2 text-center font-black text-xs ${t.rank<=qualThreshold ? 'text-green-400' : 'text-gray-600'}`}>{t.rank}</td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {t.team?.logo && <img src={t.team.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0" onError={e=>e.target.style.display='none'} />}
                    <span className="font-bold text-gray-200 text-xs">{nome(t.team?.name)}</span>
                  </div>
                </td>
                <td className="p-2 text-center font-black text-yellow-400">{t.points}</td>
                <td className="p-2 text-center text-gray-300">{t.all?.played}</td>
                <td className="p-2 text-center text-green-400">{t.all?.win}</td>
                <td className="p-2 text-center text-gray-400">{t.all?.draw}</td>
                <td className="p-2 text-center text-red-400">{t.all?.lose}</td>
                <td className="p-2 text-center text-gray-300 font-bold">{((t.goalsDiff??0)>0?'+':'')+(t.goalsDiff??0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {is3rdTable && (
        <div className="px-3 py-1.5 bg-gray-900/50 text-[9px] text-gray-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          Top {qualThreshold} avançam para o mata-mata
        </div>
      )}
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function Tabelas() {
  const [loading, setLoading]     = useState(true)
  const [competitions, setComps]  = useState([])
  const [compId, setCompId]       = useState(null)
  const [standings, setStandings] = useState([])
  const [bracket, setBracket]     = useState(null)
  const [tab, setTab]             = useState('standings')

  useEffect(() => {
    supabase.from('competitions').select('*').eq('is_active',true).order('id')
      .then(({ data }) => {
        if (data?.length) { setComps(data); setCompId(data[0].id) }
        else setLoading(false)
      })
  }, [])

  const buildVirtual = (matches) => {
    const groups = {}
    Object.keys(matches).forEach(round => {
      if (isKnockout(round)) return
      const gM = round.match(/(?:Group|Grupo)\s+([A-Z0-9]+)/i)
      const isSeries = round.includes('Regular Season') || round.includes('Serie')
      const key = gM ? `Grupo ${gM[1].toUpperCase()}` : isSeries ? 'Classificação' : null
      if (!key) return
      if (!groups[key]) groups[key] = new Map()
      const map = groups[key]
      matches[round].forEach(m => {
        const upd = (team, gf, ga) => {
          if (!team?.id) return
          if (!map.has(team.id)) map.set(team.id, { rank:0, team, points:0, group:key, all:{played:0,win:0,draw:0,lose:0}, goalsDiff:0 })
          if (gf===null||ga===null) return
          const s = map.get(team.id)
          s.all.played++; s.goalsDiff += gf-ga
          if (gf>ga){s.points+=3;s.all.win++} else if(gf===ga){s.points+=1;s.all.draw++} else s.all.lose++
        }
        upd(m.teams?.home, m.goals?.home, m.goals?.away)
        upd(m.teams?.away, m.goals?.away, m.goals?.home)
      })
    })
    return Object.keys(groups).sort().map(key => {
      const arr = Array.from(groups[key].values())
      arr.sort((a,b) => b.points-a.points||b.all.win-a.all.win||b.goalsDiff-a.goalsDiff)
      arr.forEach((t,i) => t.rank=i+1)
      return arr
    })
  }

  const extractBracket = (matches) => {
    const ko = ['Round of 32','Round of 16','Quarter-finals','Semi-finals','3rd Place Final','Final']
    const b = {}
    ko.forEach(r => { if (matches[r]?.length) b[r] = matches[r] })
    return Object.keys(b).length ? b : null
  }

  useEffect(() => {
    if (!compId) return
    async function load() {
      setLoading(true); setStandings([]); setBracket(null)
      let found = false

      try {
        const r = await fetch(`/api/standings?competitionId=${compId}`)
        const d = await r.json()
        if (d.standings?.length) { setStandings(d.standings); found=true }
      } catch {}

      if (!found) {
        const { data: rows } = await supabase.from('standings').select('*, teams(*)')
          .eq('competition_id', compId).order('group_name').order('position')
        if (rows?.length) {
          const grouped = {}
          rows.forEach(row => {
            if (!grouped[row.group_name]) grouped[row.group_name]=[]
            grouped[row.group_name].push({
              rank:row.position, group:row.group_name,
              team:{id:row.teams?.id,name:row.teams?.name,logo:row.teams?.badge_url},
              points:row.points??0,
              all:{played:row.played??0,win:row.won??0,draw:row.drawn??0,lose:row.lost??0},
              goalsDiff:row.goals_diff??0,
            })
          })
          const arr = Object.values(grouped)
          if (arr.some(g=>g.some(t=>t.points>0||t.all.played>0))) { setStandings(arr); found=true }
        }
      }

      try {
        const r = await fetch(`/api/matches-official?competitionId=${compId}`)
        const d = await r.json()
        if (d.matches && Object.keys(d.matches).length) {
          const b = extractBracket(d.matches)
          if (b) setBracket(b)
          if (!found) {
            const v = buildVirtual(d.matches)
            if (v.length) setStandings(v)
          }
        }
      } catch {}

      setLoading(false)
    }
    load()
  }, [compId])

  const hasStandings = standings.length > 0
  const hasBracket   = !!bracket && Object.keys(bracket).length > 0

  useEffect(() => {
    if (hasBracket && !hasStandings) setTab('bracket')
  }, [hasBracket, hasStandings])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center pb-24 w-full">
      <h1 className="text-3xl font-bold text-yellow-400 mb-4 mt-4 text-center">📊 Dados Oficiais</h1>

      <div className="w-full max-w-4xl mb-4 overflow-x-auto no-scrollbar">
        <div className="flex justify-center gap-2 pb-2 min-w-max">
          {competitions.map(c => (
            <button key={c.id} onClick={() => setCompId(c.id)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all border
                ${compId===c.id ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg scale-105'
                                : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <SponsorBanner />

      {loading ? (
        <div className="text-center p-16 animate-pulse w-full">
          <div className="text-4xl mb-4">📡</div>Carregando...
        </div>
      ) : (
        <div className="w-full max-w-5xl">
          {(hasStandings || hasBracket) && (
            <div className="flex bg-gray-800 p-1 rounded-xl mb-6 max-w-xs mx-auto border border-gray-700">
              {hasStandings && (
                <button onClick={() => setTab('standings')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all
                    ${tab==='standings' ? 'bg-gray-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                  🗂️ Grupos
                </button>
              )}
              {hasBracket && (
                <button onClick={() => setTab('bracket')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all
                    ${tab==='bracket' ? 'bg-yellow-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                  🏆 Mata-mata
                </button>
              )}
            </div>
          )}

          {tab==='standings' && hasStandings && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 w-full">
              {standings.map((g,i) => <StandingsTable key={i} groupData={g} />)}
            </div>
          )}

          {tab==='bracket' && hasBracket && (
            <TournamentBracket bracketData={bracket} />
          )}

          {!hasStandings && !hasBracket && (
            <div className="text-center p-12 bg-gray-800/50 rounded-xl border border-gray-700
              border-dashed text-gray-400 max-w-md mx-auto w-full">
              <div className="text-5xl mb-3">📡</div>
              <p className="font-bold mb-1">Nenhum dado encontrado</p>
              <p className="text-sm text-gray-500">Importe os dados pelo painel admin.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
