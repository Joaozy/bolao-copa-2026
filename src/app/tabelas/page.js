'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import SponsorBanner from '../../components/SponsorBanner'

// ─── Traduções ────────────────────────────────────────────────────────────────
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

// Siglas de 3 letras estilo Sul-americano (igual à imagem)
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

const sigla  = n => ABBR[n] || (PT[n]?.slice(0,3).toUpperCase()) || n?.slice(0,3).toUpperCase() || '?'
const nome   = n => PT[n] || n || 'A definir'

function isKnockout(r) {
  return ['Round of 32','Round of 16','Quarter-finals','Semi-finals','3rd Place Final','Final'].includes(r)
}

function matchWinner(m) {
  if (!m?.goals || m.goals.home === null || m.goals.away === null) return null
  const pH = m.score?.penalty?.home ?? null
  const pA = m.score?.penalty?.away ?? null
  if (pH !== null && pA !== null) return pH > pA ? m.teams?.home : m.teams?.away
  if (m.goals.home > m.goals.away) return m.teams?.home
  if (m.goals.away > m.goals.home) return m.teams?.away
  return null
}

// ─── Card compacto do chaveamento ─────────────────────────────────────────────
const CARD_H = 50

function BracketCard({ match }) {
  if (!match) return (
    <div style={{ height: CARD_H }}
      className="rounded border border-dashed border-gray-700 bg-gray-800/20
        flex items-center justify-center text-[9px] text-gray-600 font-bold tracking-widest">
      TBD
    </div>
  )

  const home = match.teams?.home
  const away = match.teams?.away
  const gH   = match.goals?.home ?? null
  const gA   = match.goals?.away ?? null
  const pH   = match.score?.penalty?.home ?? null
  const pA   = match.score?.penalty?.away ?? null
  const hasPen   = pH !== null && pA !== null
  const finished = gH !== null && gA !== null
  const homeWins = finished && (hasPen ? pH > pA : gH > gA)
  const awayWins = finished && (hasPen ? pA > pH : gA > gH)

  const Row = ({ team, goals, wins, loses }) => (
    <div className={`flex items-center gap-1 px-1.5 flex-1
      ${wins ? 'bg-emerald-900/50' : loses ? 'opacity-30' : ''}`}>
      {team?.logo
        ? <img src={team.logo} alt="" className="w-4 h-4 object-contain flex-shrink-0"
            onError={e => { e.target.style.display='none' }} />
        : <div className="w-4 h-4 rounded-full bg-gray-700 flex-shrink-0 text-[7px] flex items-center justify-center text-gray-500">
            {sigla(team?.name)?.[0]}
          </div>}
      <span className={`flex-1 text-[10px] font-black truncate
        ${wins ? 'text-emerald-300' : 'text-gray-300'}`}>
        {team?.name ? sigla(team.name) : 'TBD'}
      </span>
      <span className={`text-[11px] font-black w-3.5 text-right flex-shrink-0
        ${wins ? 'text-emerald-400' : finished ? 'text-gray-500' : 'text-gray-700'}`}>
        {finished ? goals : '–'}
      </span>
    </div>
  )

  return (
    <div style={{ height: CARD_H }}
      className={`flex flex-col overflow-hidden rounded shadow-md
        ${finished
          ? 'border border-gray-600 bg-gray-800'
          : 'border border-gray-700/70 bg-gray-800/60'}`}>
      <Row team={home} goals={gH} wins={homeWins} loses={awayWins} />
      <div className="h-px bg-gray-700 flex-shrink-0" />
      <Row team={away} goals={gA} wins={awayWins} loses={homeWins} />
      {hasPen && (
        <div className="text-center bg-yellow-900/30 text-yellow-400 text-[8px] font-black
          flex-shrink-0 leading-3 py-px">
          PEN {pH}–{pA}
        </div>
      )}
    </div>
  )
}

// ─── CHAVEAMENTO EM PIRÂMIDE ESPELHADA ────────────────────────────────────────
//
//  [R32][R16][QF][SF]──[FINAL]──[SF][QF][R16][R32]
//  LEFT half (teams enter left, converge right)
//  RIGHT half (teams enter right, converge left)
//
function MirroredBracket({ bracketData }) {
  const COL_W  = 116   // largura de cada coluna
  const GAP_W  = 14    // gap entre colunas (espaço dos conectores)
  const STEP   = COL_W + GAP_W
  const SLOT_H = 58    // altura de cada slot no R32

  // Divide os dados em metade esquerda e direita
  const r32All = bracketData['Round of 32']    || []
  const r16All = bracketData['Round of 16']    || []
  const qfAll  = bracketData['Quarter-finals'] || []
  const sfAll  = bracketData['Semi-finals']    || []
  const finAll = bracketData['Final']          || []

  const mid = arr => Math.ceil(arr.length / 2)

  const L = {
    r32: r32All.slice(0, mid(r32All.length)),   // 8 matches
    r16: r16All.slice(0, mid(r16All.length)),   // 4 matches
    qf:  qfAll.slice(0, mid(qfAll.length)),     // 2 matches
    sf:  sfAll.slice(0, 1),                     // 1 match
  }
  const R = {
    r32: r32All.slice(mid(r32All.length)),      // 8 matches
    r16: r16All.slice(mid(r16All.length)),      // 4 matches
    qf:  qfAll.slice(mid(qfAll.length)),        // 2 matches
    sf:  sfAll.slice(1, 2),                     // 1 match
  }

  // Total height baseado no maior round
  const baseCount = Math.max(L.r32.length, R.r32.length, r16All.length / 2, 4)
  const TOTAL_H   = Math.max(baseCount, 1) * SLOT_H

  // 9 colunas: L.r32(0) L.r16(1) L.qf(2) L.sf(3) | Final(4) | R.sf(5) R.qf(6) R.r16(7) R.r32(8)
  const cx = i => i * STEP  // x posição da coluna i

  // Posição vertical central de match mi em coluna com count partidas
  const yC = (count, mi) => {
    const slotH = TOTAL_H / Math.max(count, 1)
    return mi * slotH + slotH / 2
  }

  // ── Renderiza os cards das partidas ─────────────────────────────────────────
  const allCols = [
    { matches: L.r32, col: 0 }, { matches: L.r16, col: 1 },
    { matches: L.qf,  col: 2 }, { matches: L.sf,  col: 3 },
    { matches: finAll, col: 4 },
    { matches: R.sf,  col: 5 }, { matches: R.qf,  col: 6 },
    { matches: R.r16, col: 7 }, { matches: R.r32, col: 8 },
  ]

  const cards = allCols.flatMap(({ matches, col }) => {
    const count = Math.max(matches.length, 1)
    const slotH = TOTAL_H / count
    return matches.map((m, mi) => {
      const top  = mi * slotH + (slotH - CARD_H) / 2
      const left = cx(col)
      return (
        <div key={`c${col}-${mi}`}
          style={{ position: 'absolute', left, top, width: COL_W }}>
          <BracketCard match={m} />
        </div>
      )
    })
  })

  // ── Renderiza os conectores SVG ──────────────────────────────────────────────
  // makeConn: conecta pares de partidas em srcCol para partidas em tgtCol
  const makeConn = (srcMatches, srcCol, tgtMatches, tgtCol) => {
    if (!srcMatches.length || !tgtMatches.length) return []
    const goingRight = srcCol < tgtCol
    const xSrc  = goingRight ? cx(srcCol) + COL_W : cx(srcCol)         // borda do lado de saída
    const xTgt  = goingRight ? cx(tgtCol)         : cx(tgtCol) + COL_W // borda de chegada
    const xMid  = (xSrc + xTgt) / 2

    return Array.from({ length: Math.ceil(srcMatches.length / 2) }, (_, p) => {
      const y1  = yC(srcMatches.length, p * 2)
      const y2  = yC(srcMatches.length, p * 2 + 1)
      const yM  = yC(tgtMatches.length, p)
      return (
        <g key={`k${srcCol}-${tgtCol}-${p}`} stroke="#374151" strokeWidth="1.5"
          fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* ┤ forma: horizontal de cima + vertical + horizontal de baixo */}
          <path d={`M ${xSrc} ${y1} H ${xMid} V ${y2} M ${xSrc} ${y2} H ${xMid}`} />
          {/* Horizontal central para próximo round */}
          <line x1={xMid} y1={yM} x2={xTgt} y2={yM} />
        </g>
      )
    })
  }

  const connectors = [
    // Metade esquerda (da esquerda para o Final)
    ...makeConn(L.r32, 0, L.r16, 1),
    ...makeConn(L.r16, 1, L.qf,  2),
    ...makeConn(L.qf,  2, L.sf,  3),
    ...makeConn(L.sf,  3, finAll, 4),
    // Metade direita (da direita para o Final)
    ...makeConn(R.r32, 8, R.r16, 7),
    ...makeConn(R.r16, 7, R.qf,  6),
    ...makeConn(R.qf,  6, R.sf,  5),
    ...makeConn(R.sf,  5, finAll, 4),
  ]

  // ── Cabeçalhos das fases ──────────────────────────────────────────────────────
  const HEADERS_L = [
    { col:0, label:'16avos', icon:'⚔️' },
    { col:1, label:'Oitavas', icon:'⚽' },
    { col:2, label:'Quartas', icon:'🔥' },
    { col:3, label:'Semi', icon:'⭐' },
  ]
  const HEADERS_R = [
    { col:5, label:'Semi', icon:'⭐' },
    { col:6, label:'Quartas', icon:'🔥' },
    { col:7, label:'Oitavas', icon:'⚽' },
    { col:8, label:'16avos', icon:'⚔️' },
  ]

  const TOTAL_W = 9 * STEP - GAP_W
  const finalMatch = finAll[0] ?? null
  const champion = matchWinner(finalMatch)
  const third = bracketData['3rd Place Final'] || []

  return (
    <div>
      {/* Banner campeão */}
      {champion && (
        <div className="mb-6 p-4 rounded-2xl flex items-center justify-center gap-4
          bg-gradient-to-r from-yellow-900/30 to-amber-900/20
          border border-yellow-600/30 shadow-lg">
          <div className="text-4xl">🏆</div>
          {champion.logo && (
            <img src={champion.logo} alt="" className="w-10 h-10 object-contain" />
          )}
          <div>
            <div className="text-[10px] text-yellow-500 font-black uppercase tracking-widest mb-0.5">
              Campeão Copa 2026
            </div>
            <div className="text-xl font-black text-white">{nome(champion.name)}</div>
          </div>
        </div>
      )}

      {/* Chaveamento com scroll horizontal */}
      <div className="overflow-x-auto -mx-3 px-3 pb-4">

        {/* Linha de cabeçalhos */}
        <div className="relative mb-1.5" style={{ width: TOTAL_W, height: 24 }}>
          {/* Final (centro) */}
          <div style={{ position:'absolute', left: cx(4), width: COL_W,
            background:'#78350f30', color:'#FCD34D', border:'1px solid #78350f50',
            textAlign:'center', fontSize:10, fontWeight:900, padding:'3px 0', borderRadius:6,
            textTransform:'uppercase', letterSpacing:'0.05em' }}>
            🏆 Final
          </div>
          {[...HEADERS_L, ...HEADERS_R].map(({ col, label, icon }) => (
            <div key={col} style={{ position:'absolute', left: cx(col), width: COL_W,
              background:'#1f293750', color:'#9CA3AF', border:'1px solid #37415140',
              textAlign:'center', fontSize:9, fontWeight:900, padding:'3px 0', borderRadius:5,
              textTransform:'uppercase', letterSpacing:'0.05em' }}>
              {icon} {label}
            </div>
          ))}
        </div>

        {/* Área do bracket */}
        <div className="relative" style={{ width: TOTAL_W, height: TOTAL_H }}>
          {/* SVG dos conectores (atrás) */}
          <svg className="absolute inset-0 pointer-events-none"
            style={{ width: TOTAL_W, height: TOTAL_H }}
            viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}>
            {connectors}
          </svg>
          {/* Cards (frente) */}
          {cards}
        </div>
      </div>

      {/* Disputa 3º lugar */}
      {third.length > 0 && (
        <div className="mt-4 max-w-[220px] mx-auto">
          <div className="text-center text-[10px] font-black uppercase tracking-wider py-1.5 rounded-lg mb-2"
            style={{ background:'#92400e18', color:'#FCD34D', border:'1px solid #92400e40' }}>
            🥉 3° Lugar
          </div>
          {third.map((m, i) => <BracketCard key={i} match={m} />)}
        </div>
      )}
    </div>
  )
}

// ─── Tabela de classificação ──────────────────────────────────────────────────
function StandingsTable({ groupData }) {
  if (!groupData?.length) return null

  // Detecta se é a tabela de 3°s colocados:
  // — nome não é "Grupo X" / "Group X"
  // — OU tem mais de 4 times (nos grupos normais da Copa são 3-4 times)
  const rawGroup  = groupData[0]?.group || ''
  const isNormalGroup = /^(Grupo|Group)\s+[A-Z0-9]/i.test(rawGroup)
  const is3rdTable = !isNormalGroup || groupData.length > 4

  // Título
  let title = rawGroup
  if (is3rdTable) {
    title = `${rawGroup ? rawGroup + ' — ' : ''}3° Colocados`
  }

  // Threshold de classificação
  const qualThreshold = is3rdTable ? 8 : 2

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg h-fit mb-6">
      <div className="bg-gray-700 p-2.5 text-center font-bold text-yellow-400 text-xs uppercase tracking-wider">
        {title || 'Classificação'}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead>
            <tr className="bg-gray-900 text-gray-500 text-[10px]">
              <th className="p-2 text-center w-7">#</th>
              <th className="p-2">Seleção</th>
              <th className="p-2 text-center" title="Pontos">P</th>
              <th className="p-2 text-center" title="Jogos">J</th>
              <th className="p-2 text-center" title="Vitórias">V</th>
              <th className="p-2 text-center" title="Empates">E</th>
              <th className="p-2 text-center" title="Derrotas">D</th>
              <th className="p-2 text-center" title="Saldo">SG</th>
            </tr>
          </thead>
          <tbody>
            {groupData.map((t, i) => {
              const qualifies = t.rank <= qualThreshold
              return (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/30">
                  <td className={`p-2 text-center font-black text-xs
                    ${qualifies ? 'text-green-400' : 'text-gray-600'}`}>
                    {t.rank}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {t.team?.logo && (
                        <img src={t.team.logo} alt="" className="w-5 h-5 object-contain flex-shrink-0"
                          onError={e => e.target.style.display='none'} />
                      )}
                      <span className="font-bold text-gray-200 text-xs">
                        {nome(t.team?.name)}
                      </span>
                    </div>
                  </td>
                  <td className="p-2 text-center font-black text-yellow-400">{t.points}</td>
                  <td className="p-2 text-center text-gray-300">{t.all?.played}</td>
                  <td className="p-2 text-center text-green-400">{t.all?.win}</td>
                  <td className="p-2 text-center text-gray-400">{t.all?.draw}</td>
                  <td className="p-2 text-center text-red-400">{t.all?.lose}</td>
                  <td className="p-2 text-center text-gray-300 font-bold">
                    {((t.goalsDiff ?? 0) > 0 ? '+' : '') + (t.goalsDiff ?? 0)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {is3rdTable && (
        <div className="px-3 py-1.5 bg-gray-900/50 text-[9px] text-gray-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" />
          Top {qualThreshold} se classificam para os {qualThreshold === 8 ? '16avos' : 'mata-mata'}
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
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
          if (!map.has(team.id)) map.set(team.id, {
            rank:0, team, points:0, group:key,
            all:{ played:0, win:0, draw:0, lose:0 }, goalsDiff:0
          })
          if (gf === null || ga === null) return
          const s = map.get(team.id)
          s.all.played++; s.goalsDiff += gf - ga
          if (gf > ga) { s.points += 3; s.all.win++ }
          else if (gf === ga) { s.points += 1; s.all.draw++ }
          else s.all.lose++
        }
        upd(m.teams?.home, m.goals?.home, m.goals?.away)
        upd(m.teams?.away, m.goals?.away, m.goals?.home)
      })
    })
    return Object.keys(groups).sort().map(key => {
      const arr = Array.from(groups[key].values())
      arr.sort((a,b) => b.points-a.points || b.all.win-a.all.win || b.goalsDiff-a.goalsDiff)
      arr.forEach((t,i) => t.rank = i+1)
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

      // 1) API standings
      try {
        const r = await fetch(`/api/standings?competitionId=${compId}`)
        const d = await r.json()
        if (d.standings?.length) { setStandings(d.standings); found = true }
      } catch {}

      // 2) Supabase standings (só se API não retornou)
      if (!found) {
        const { data: rows } = await supabase.from('standings').select('*, teams(*)')
          .eq('competition_id', compId).order('group_name').order('position')
        if (rows?.length) {
          const grouped = {}
          rows.forEach(row => {
            if (!grouped[row.group_name]) grouped[row.group_name] = []
            grouped[row.group_name].push({
              rank: row.position, group: row.group_name,
              team: { id:row.teams?.id, name:row.teams?.name, logo:row.teams?.badge_url },
              points: row.points ?? 0,
              all: { played:row.played??0, win:row.won??0, draw:row.drawn??0, lose:row.lost??0 },
              goalsDiff: row.goals_diff ?? 0
            })
          })
          const arr = Object.values(grouped)
          if (arr.some(g => g.some(t => t.points > 0 || t.all.played > 0))) {
            setStandings(arr); found = true
          }
        }
      }

      // 3) matches-official: bracket + virtual standings
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
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center pb-24">
      <h1 className="text-3xl font-bold text-yellow-400 mb-4 mt-4 text-center">
        📊 Dados Oficiais
      </h1>

      {/* Seletor de competição */}
      <div className="w-full max-w-4xl mb-4 overflow-x-auto no-scrollbar">
        <div className="flex justify-center gap-2 pb-2 min-w-max">
          {competitions.map(c => (
            <button key={c.id} onClick={() => setCompId(c.id)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all border
                ${compId===c.id
                  ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg scale-105'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <SponsorBanner />

      {loading ? (
        <div className="text-center p-16 animate-pulse">
          <div className="text-4xl mb-4">📡</div>Carregando...
        </div>
      ) : (
        <div className="w-full max-w-5xl">

          {/* Toggle Grupos / Mata-mata */}
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

          {/* Fase de grupos */}
          {tab==='standings' && hasStandings && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {standings.map((g,i) => <StandingsTable key={i} groupData={g} />)}
            </div>
          )}

          {/* Chaveamento em pirâmide */}
          {tab==='bracket' && hasBracket && (
            <MirroredBracket bracketData={bracket} />
          )}

          {!hasStandings && !hasBracket && (
            <div className="text-center p-12 bg-gray-800/50 rounded-xl border border-gray-700
              border-dashed text-gray-400 max-w-md mx-auto">
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
