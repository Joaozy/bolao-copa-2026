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

// Siglas de 3 letras estilo Sul-americano
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

// ─── LÓGICA DO CHAVEAMENTO OFICIAL DA FIFA ────────────────────────────────────
// Agrupa os jogos cronológicos para formar os lados esquerdo e direito da árvore perfeitamente
function arrangeOfficialBracket(matches, roundType) {
  if (!matches || matches.length === 0) return [];
  
  // 1. Ordena pela data de início (Ordem Cronológica do Torneio)
  const sorted = [...matches].sort((a, b) => {
      const timeA = a.start_time ? new Date(a.start_time).getTime() : a.id;
      const timeB = b.start_time ? new Date(b.start_time).getTime() : b.id;
      return timeA - timeB;
  });
  
  let arranged = [...sorted];

  // 2. Aplica o cruzamento Padrão FIFA
  try {
      if (roundType === 'r32' && sorted.length >= 16) {
        // 16 avos (16 Jogos): Alterna os blocos de dias para os lados da chave
        arranged = [
            sorted[0], sorted[1], sorted[2], sorted[3], sorted[8], sorted[9], sorted[10], sorted[11], // Esquerda
            sorted[4], sorted[5], sorted[6], sorted[7], sorted[12], sorted[13], sorted[14], sorted[15], // Direita
            ...sorted.slice(16)
        ];
      } else if (roundType === 'r16' && sorted.length >= 8) {
        // Oitavas (8 Jogos): O mesmo padrão, dividindo os dias
        arranged = [
            sorted[0], sorted[1], sorted[4], sorted[5], // Esquerda
            sorted[2], sorted[3], sorted[6], sorted[7], // Direita
            ...sorted.slice(8)
        ];
      }
      // Quartas (QF) e Semis (SF) e Finais caem naturalmente na ordem cronológica de 0,1 (Esq) e 2,3 (Dir)
  } catch (e) {
      console.warn("Erro ao ordenar chaveamento", e);
      return sorted;
  }

  return arranged;
}

// ─── Dimensões globais do bracket ─────────────────────────────────────────────
const B_COL  = 88   // largura do card
const B_GAP  = 14   // gap entre colunas (Aumentei um pouco para as linhas respirarem)
const B_STEP = B_COL + B_GAP
const B_CARD = 42   // altura do card
const B_SLOT = 50   // altura do slot (card + espaço)

// ─── Card compacto com estética Copa ──────────────────────────────────────────
function BracketCard({ match }) {
  const GOLD    = '#c9941f'
  const NAVY    = '#07152a'
  const NAVY2   = '#0c1f3a'
  const DIV_CLR = '#0e2040'

  if (!match) return (
    <div style={{
      height: B_CARD, width: B_COL,
      border: `1.5px solid ${GOLD}30`,
      background: NAVY,
      borderRadius: 5,
      display: 'flex', flexDirection: 'column',
    }}>
      {[0, 1].map(i => (
        <div key={i} style={{
          flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 6,
          borderBottom: i === 0 ? `1px solid ${DIV_CLR}` : 'none',
        }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: '#0d2140', marginRight: 6, flexShrink: 0 }} />
          <span style={{ color: '#1e3a5f', fontSize: 9, fontWeight: 700, letterSpacing: '.05em' }}>TBD</span>
        </div>
      ))}
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
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center',
      paddingLeft: 4, paddingRight: 3,
      background: wins ? 'rgba(6,78,40,0.55)' : loses ? 'rgba(0,0,0,0.08)' : 'transparent',
    }}>
      {team?.logo
        ? <img src={team.logo} alt=""
            style={{ width: 14, height: 14, objectFit: 'contain', flexShrink: 0, marginRight: 4 }}
            onError={e => { e.target.style.display = 'none' }} />
        : <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#102236', flexShrink: 0, marginRight: 4 }} />}
      <span style={{
        flex: 1, fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: wins ? '#86efac' : loses ? '#2e4d6a' : '#7ea5c8',
      }}>
        {team?.name ? sigla(team.name) : '?'}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 900, minWidth: 13, textAlign: 'right', flexShrink: 0,
        color: wins ? '#4ade80' : finished ? '#2e4a68' : '#0e2a44',
      }}>
        {finished ? goals : '–'}
      </span>
    </div>
  )

  return (
    <div style={{
      height: B_CARD, width: B_COL,
      border: `1.5px solid ${finished ? GOLD : GOLD + '55'}`,
      background: NAVY2,
      borderRadius: 5, overflow: 'hidden', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      boxShadow: finished ? `0 0 8px ${GOLD}25` : 'none',
    }}>
      <Row team={home} goals={gH} wins={homeWins} loses={awayWins} />
      <div style={{ height: 1, background: DIV_CLR, flexShrink: 0 }} />
      <Row team={away} goals={gA} wins={awayWins} loses={homeWins} />
      {hasPen && (
        <div style={{
          background: '#78350f', color: '#fcd34d',
          fontSize: 7, fontWeight: 900, textAlign: 'center',
          lineHeight: '10px', flexShrink: 0,
        }}>
          PEN {pH}–{pA}
        </div>
      )}
    </div>
  )
}

// ─── CHAVEAMENTO EM PIRÂMIDE ESPELHADA ────────────────────────────────────────
function MirroredBracket({ bracketData }) {
  const mid = n => Math.ceil(n / 2)
  const cx  = i => i * B_STEP

  // Ordena a matriz de jogos usando o Mapeamento Oficial Padrão da FIFA
  const r32All = arrangeOfficialBracket(bracketData['Round of 32'], 'r32')
  const r16All = arrangeOfficialBracket(bracketData['Round of 16'], 'r16')
  const qfAll  = arrangeOfficialBracket(bracketData['Quarter-finals'], 'qf')
  const sfAll  = arrangeOfficialBracket(bracketData['Semi-finals'], 'sf')
  const finAll = arrangeOfficialBracket(bracketData['Final'], 'fin')

  // Divide em metade esquerda e direita com os cruzamentos perfeitamente mapeados
  const L = {
    r32: r32All.slice(0, mid(r32All.length)),
    r16: r16All.slice(0, mid(r16All.length)),
    qf:  qfAll.slice(0,  mid(qfAll.length)),
    sf:  sfAll.slice(0, 1),
  }
  const R = {
    r32: r32All.slice(mid(r32All.length)),
    r16: r16All.slice(mid(r16All.length)),
    qf:  qfAll.slice(mid(qfAll.length)),
    sf:  sfAll.slice(1, 2),
  }

  const baseCount = Math.max(L.r32.length, R.r32.length, L.r16.length * 2, L.qf.length * 4, 4)
  const TOTAL_H   = baseCount * B_SLOT
  const TOTAL_W   = 9 * B_STEP - B_GAP

  const yC = (count, mi) => {
    const sh = TOTAL_H / Math.max(count, 1)
    return mi * sh + sh / 2
  }

  // ── Cards ─────────────────────────────────────────────────────────────────
  const allCols = [
    { m: L.r32, c: 0 }, { m: L.r16, c: 1 }, { m: L.qf, c: 2 }, { m: L.sf, c: 3 },
    { m: finAll, c: 4 },
    { m: R.sf, c: 5 }, { m: R.qf, c: 6 }, { m: R.r16, c: 7 }, { m: R.r32, c: 8 },
  ]

  const cards = allCols.flatMap(({ m, c }) => {
    const sh = TOTAL_H / Math.max(m.length, 1)
    return m.map((match, mi) => (
      <div key={`c${c}-${mi}`}
        style={{ position: 'absolute', left: cx(c), top: mi * sh + (sh - B_CARD) / 2 }}>
        <BracketCard match={match} />
      </div>
    ))
  })

  // ── Conectores SVG Aprimorados (Estilo Copa do Mundo Visual) ─────────────
  const GOLD_CONN = '#c9941f'
  
  const makeConn = (src, sc, tgt, tc) => {
    if (!src.length || !tgt.length) return null
    const goRight = sc < tc
    
    // Alinha o ínicio/fim da linha exatamente nas bordas do card
    const xS   = goRight ? cx(sc) + B_COL + 2 : cx(sc) - 2
    const xT   = goRight ? cx(tc) - 2 : cx(tc) + B_COL + 2
    const xMid = (xS + xT) / 2

    return Array.from({ length: Math.ceil(src.length / 2) }, (_, p) => {
      const y1 = yC(src.length, p * 2)
      const y2 = yC(src.length, p * 2 + 1)
      const yM = yC(tgt.length, p)

      // Se houver um card sobrando/ímpar (ex: chaveamento quebrado), apenas traça a reta
      if (p * 2 + 1 >= src.length) {
          return (
            <path key={`k${sc}-${tc}-${p}`} d={`M ${xS} ${y1} L ${xT} ${yM}`} 
                  stroke={GOLD_CONN} strokeWidth="1.5" fill="none" opacity="0.4" />
          )
      }

      return (
        <path key={`k${sc}-${tc}-${p}`} 
          d={`M ${xS} ${y1} H ${xMid} V ${y2} H ${xS} M ${xMid} ${yM} H ${xT}`}
          stroke={GOLD_CONN} strokeWidth="1.5" fill="none" opacity="0.6"
          strokeLinecap="round" strokeLinejoin="round" 
        />
      )
    })
  }

  const connSVG = [
    makeConn(L.r32, 0, L.r16, 1), makeConn(L.r16, 1, L.qf, 2),
    makeConn(L.qf, 2, L.sf, 3),   makeConn(L.sf, 3, finAll, 4),
    makeConn(R.r32, 8, R.r16, 7), makeConn(R.r16, 7, R.qf, 6),
    makeConn(R.qf, 6, R.sf, 5),   makeConn(R.sf, 5, finAll, 4),
  ]

  // ── Labels das fases ─────────────────────────────────────────────────────
  const LABELS = [
    { c:0, t:'16 AVOS' }, { c:1, t:'OITAVAS' }, { c:2, t:'QUARTAS' }, { c:3, t:'SEMI' },
    { c:4, t:'FINAL',   gold: true },
    { c:5, t:'SEMI' }, { c:6, t:'QUARTAS' }, { c:7, t:'OITAVAS' }, { c:8, t:'16 AVOS' },
  ]

  const finalMatch = finAll[0] ?? null
  const champion   = matchWinner(finalMatch)
  // O jogo de terceiro lugar usa apenas o sort cronológico basico, não entra na arvore principal
  const third      = [...(bracketData['3rd Place Final'] || [])].sort((a,b)=> new Date(a.start_time)-new Date(b.start_time))

  return (
    <div style={{
      background: 'linear-gradient(160deg, #040d1c 0%, #091729 45%, #040d1c 100%)',
      borderRadius: 18, padding: '16px 10px 14px',
      border: '1px solid rgba(201,148,31,0.18)',
      maxWidth: '100%',
    }}>
      {/* Título */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{
          fontSize: 9, fontWeight: 900, letterSpacing: '.35em', textTransform: 'uppercase',
          color: '#c9941f', marginBottom: 2,
        }}>
          Copa do Mundo 2026
        </div>
        <div style={{
          fontSize: 18, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase',
          color: '#f2c14e',
        }}>
          Caminho Até a Final
        </div>
      </div>

      {/* Banner campeão */}
      {champion && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: '8px 20px', marginBottom: 14, borderRadius: 10,
          background: 'linear-gradient(90deg,rgba(201,148,31,.08),rgba(201,148,31,.18),rgba(201,148,31,.08))',
          border: '1px solid rgba(201,148,31,.3)',
        }}>
          <span style={{ fontSize: 28 }}>🏆</span>
          {champion.logo && <img src={champion.logo} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />}
          <div>
            <div style={{ fontSize: 8, color: '#c9941f', fontWeight: 900, letterSpacing: '.3em', textTransform: 'uppercase' }}>Campeão</div>
            <div style={{ fontSize: 16, color: '#fff', fontWeight: 900 }}>{nome(champion.name)}</div>
          </div>
        </div>
      )}

      {/* Bracket (scroll só se necessário) */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ width: TOTAL_W, minWidth: TOTAL_W }}>

          {/* Labels das fases */}
          <div style={{ position: 'relative', height: 20, marginBottom: 6 }}>
            {LABELS.map(({ c, t, gold }) => (
              <div key={c} style={{
                position: 'absolute', left: cx(c), width: B_COL,
                textAlign: 'center', fontSize: 8, fontWeight: 900,
                letterSpacing: '.12em', textTransform: 'uppercase',
                color: gold ? '#f2c14e' : '#3a5a7a',
                borderBottom: gold ? '1.5px solid #c9941f' : 'none',
                paddingBottom: 2,
              }}>
                {t}
              </div>
            ))}
          </div>

          {/* Área principal do bracket */}
          <div style={{ position: 'relative', height: TOTAL_H }}>
            <svg style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
              width={TOTAL_W} height={TOTAL_H} viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}>
              {connSVG}
            </svg>
            {cards}
          </div>
        </div>
      </div>

      {/* 3° Lugar */}
      {third.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 10, gap: 4 }}>
          <div style={{
            fontSize: 8, fontWeight: 900, letterSpacing: '.2em', textTransform: 'uppercase',
            color: '#9a6c2a',
          }}>
            🥉 3° Lugar
          </div>
          <BracketCard match={third[0]} />
        </div>
      )}
    </div>
  )
}

// ─── Tabela de classificação ──────────────────────────────────────────────────
function StandingsTable({ groupData }) {
  if (!groupData?.length) return null

  // Detecta se é a tabela de 3°s colocados
  const rawGroup  = groupData[0]?.group || ''
  const isNormalGroup = /^(Grupo|Group)\s+[A-Z0-9]/i.test(rawGroup)
  const is3rdTable = !isNormalGroup || groupData.length > 4

  let title = rawGroup
  if (is3rdTable) {
    title = `${rawGroup ? rawGroup + ' — ' : ''}3° Colocados`
  }

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