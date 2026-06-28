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

const nome = s => PT[s] || s || 'A definir'

const ROUND_META = {
  'Round of 32':    { pt:'16avos de Final',    short:'16avos',  icon:'⚔️',  color:'#6B7280' },
  'Round of 16':    { pt:'Oitavas de Final',   short:'Oitavas', icon:'⚽',  color:'#3B82F6' },
  'Quarter-finals': { pt:'Quartas de Final',   short:'Quartas', icon:'🔥',  color:'#F59E0B' },
  'Semi-finals':    { pt:'Semifinais',          short:'Semi',    icon:'⭐',  color:'#8B5CF6' },
  '3rd Place Final':{ pt:'Disputa 3º Lugar',   short:'3º Lugar',icon:'🥉',  color:'#D97706' },
  'Final':          { pt:'Grande Final',        short:'Final',   icon:'🏆',  color:'#EAB308' },
}
const BRACKET_ORDER = ['Round of 32','Round of 16','Quarter-finals','Semi-finals','Final']

function isKnockout(r) { return Object.keys(ROUND_META).includes(r) }
function isGroup(r) { return !isKnockout(r) }

function matchWinner(m) {
  if (!m?.goals || m.goals.home === null || m.goals.away === null) return null
  const pH = m.score?.penalty?.home ?? null
  const pA = m.score?.penalty?.away ?? null
  if (pH !== null && pA !== null) return pH > pA ? m.teams?.home : m.teams?.away
  if (m.goals.home > m.goals.away) return m.teams?.home
  if (m.goals.away > m.goals.home) return m.teams?.away
  return null
}

// ─── Cartão compacto para o chaveamento ──────────────────────────────────────
function BracketCard({ match }) {
  const CARD_H = 52 // altura do card

  if (!match) return (
    <div style={{ height: CARD_H }}
      className="rounded-lg border border-dashed border-gray-700 bg-gray-800/30
        flex items-center justify-center text-[10px] text-gray-600 font-bold tracking-wider">
      A DEFINIR
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
    <div className={`flex items-center gap-1.5 px-2 flex-1
      ${wins ? 'bg-green-950/60' : loses ? 'opacity-40' : ''}`}>
      {team?.logo
        ? <img src={team.logo} alt="" className="w-[18px] h-[18px] object-contain flex-shrink-0"
            onError={e => { e.target.style.display = 'none' }} />
        : <div className="w-[18px] h-[18px] rounded-full bg-gray-700 flex-shrink-0" />}
      <span className={`flex-1 text-[11px] font-bold truncate
        ${wins ? 'text-white' : 'text-gray-300'}`} style={{ maxWidth: 88 }}>
        {nome(team?.name)}
      </span>
      {finished && (
        <span className={`text-[12px] font-black w-4 text-right
          ${wins ? 'text-green-400' : 'text-gray-500'}`}>
          {goals}
        </span>
      )}
    </div>
  )

  return (
    <div style={{ height: CARD_H }}
      className={`rounded-lg overflow-hidden flex flex-col shadow
        ${finished ? 'border border-gray-600 bg-gray-800'
                   : 'border border-gray-700 bg-gray-800/70'}`}>
      <Row team={home} goals={gH} wins={homeWins} loses={awayWins} />
      <div className="h-px bg-gray-700 flex-shrink-0" />
      <Row team={away} goals={gA} wins={awayWins} loses={homeWins} />
      {hasPen && (
        <div className="text-center bg-yellow-900/40 text-yellow-400 text-[9px] font-bold
          flex-shrink-0 leading-4">
          Pênaltis {pH}–{pA}
        </div>
      )}
    </div>
  )
}

// ─── Chaveamento principal ────────────────────────────────────────────────────
function TournamentBracket({ bracketData }) {
  const rounds = BRACKET_ORDER.filter(r => bracketData[r]?.length > 0)
  const third  = bracketData['3rd Place Final'] || []

  if (!rounds.length) return (
    <div className="text-center py-12 text-gray-500 text-sm">
      Dados do mata-mata não disponíveis ainda.
    </div>
  )

  const CARD_H  = 52    // altura do card em px
  const SLOT_H  = 58    // altura do slot (card + espaço mínimo) em px
  const COL_W   = 188   // largura da coluna
  const GAP_W   = 32    // gap entre colunas (onde ficam os conectores)
  const STEP    = COL_W + GAP_W

  // total height baseado no round com mais partidas (sempre o primeiro)
  const baseCount = (bracketData[rounds[0]] || []).length
  const TOTAL_H   = baseCount * SLOT_H

  // Posição Y central de uma partida em dado round
  const yCenter = (roundKey, matchIdx) => {
    const count   = (bracketData[roundKey] || []).length
    const slotH   = TOTAL_H / count
    return matchIdx * slotH + slotH / 2
  }

  // Posição left de uma coluna
  const colLeft = idx => idx * STEP

  // Calcula total width
  const TOTAL_W = rounds.length * STEP - GAP_W

  // Campeão
  const finalMatch = bracketData['Final']?.[0] ?? null
  const champion   = matchWinner(finalMatch)

  // ── Renderizar cartões de uma fase ─────────────────────────────────────────
  const renderCards = () => {
    const els = []
    rounds.forEach((roundKey, ri) => {
      const matches = bracketData[roundKey] || []
      const count   = matches.length
      const slotH   = TOTAL_H / count
      const left    = colLeft(ri)

      matches.forEach((m, mi) => {
        const top = mi * slotH + (slotH - CARD_H) / 2
        els.push(
          <div key={`${roundKey}-${mi}`}
            style={{ position:'absolute', left, top, width: COL_W }}>
            <BracketCard match={m} />
          </div>
        )
      })
    })
    return els
  }

  // ── Gerar caminhos SVG dos conectores ────────────────────────────────────────
  const renderConnectors = () => {
    const paths = []
    rounds.forEach((roundKey, ri) => {
      if (ri >= rounds.length - 1) return
      const nextKey  = rounds[ri + 1]
      const matches  = bracketData[roundKey] || []
      const xRight   = colLeft(ri) + COL_W          // borda direita da coluna atual
      const xLeft    = colLeft(ri + 1)              // borda esquerda da próxima coluna
      const xMid     = (xRight + xLeft) / 2         // ponto médio no gap

      // Para cada par de partidas que alimenta a próxima fase
      for (let p = 0; p < Math.ceil(matches.length / 2); p++) {
        const y1   = yCenter(roundKey, p * 2)          // centro da partida de cima
        const y2   = yCenter(roundKey, p * 2 + 1)      // centro da partida de baixo
        const yMid = yCenter(nextKey, p)               // centro da partida na próxima fase

        // Linha em ┐ conectando os dois → e horizontal para próxima fase
        paths.push(
          <g key={`conn-${ri}-${p}`} stroke="#374151" strokeWidth="1.5"
            fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Horizontal da partida de cima + vertical + horizontal da partida de baixo */}
            <path d={`M ${xRight} ${y1} H ${xMid} V ${y2} M ${xRight} ${y2} H ${xMid}`} />
            {/* Horizontal do ponto médio para a próxima fase */}
            <line x1={xMid} y1={yMid} x2={xLeft} y2={yMid} />
          </g>
        )
      }
    })
    return paths
  }

  // ── Cabeçalhos das fases ──────────────────────────────────────────────────
  const renderHeaders = () => rounds.map((r, i) => {
    const meta = ROUND_META[r]
    const isFinal = r === 'Final'
    return (
      <div key={r} style={{ width: COL_W, marginRight: i < rounds.length-1 ? GAP_W : 0 }}>
        <div className="text-center text-[11px] font-black uppercase tracking-wider py-1.5 rounded-lg"
          style={{ background: isFinal ? '#78350f40' : '#1f293780',
                   color: isFinal ? '#FDE68A' : meta?.color || '#9CA3AF',
                   border: `1px solid ${isFinal ? '#92400e60' : '#374151'}` }}>
          {meta?.icon} {meta?.short}
        </div>
      </div>
    )
  })

  return (
    <div>
      {/* Banner do campeão */}
      {champion && (
        <div className="mb-6 p-4 rounded-2xl flex items-center justify-center gap-4
          bg-gradient-to-r from-yellow-900/30 to-yellow-800/20
          border border-yellow-600/30 shadow-lg shadow-yellow-900/20">
          <div className="text-4xl">🏆</div>
          {champion.logo && (
            <img src={champion.logo} alt="" className="w-10 h-10 object-contain" />
          )}
          <div>
            <div className="text-[10px] text-yellow-500 font-black uppercase tracking-widest mb-0.5">
              Campeão Copa 2026
            </div>
            <div className="text-xl font-black text-white">
              {nome(champion.name)}
            </div>
          </div>
        </div>
      )}

      {/* Chaveamento — scroll horizontal */}
      <div className="overflow-x-auto pb-4 -mx-2 px-2">
        {/* Cabeçalhos */}
        <div className="flex mb-3" style={{ width: TOTAL_W }}>
          {renderHeaders()}
        </div>

        {/* Bracket com SVG + cards absolutos */}
        <div className="relative" style={{ width: TOTAL_W, height: TOTAL_H }}>
          {/* Cards das partidas */}
          {renderCards()}

          {/* Linhas de conexão */}
          <svg className="absolute inset-0 pointer-events-none overflow-visible"
            style={{ width: TOTAL_W, height: TOTAL_H }}
            viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}>
            {renderConnectors()}
          </svg>
        </div>
      </div>

      {/* Disputa de 3º lugar — separada */}
      {third.length > 0 && (
        <div className="mt-6 max-w-[220px] mx-auto">
          <div className="text-center text-[11px] font-black uppercase tracking-wider py-1.5 rounded-lg mb-2"
            style={{ background:'#92400e20', color:'#FCD34D', border:'1px solid #92400e50' }}>
            🥉 Disputa do 3º Lugar
          </div>
          {third.map((m, i) => <BracketCard key={i} match={m} />)}
        </div>
      )}
    </div>
  )
}

// ─── Tabela de classificação dos grupos ──────────────────────────────────────
function StandingsTable({ groupData, groupIndex }) {
  return (
    <div key={groupIndex} className="bg-gray-800 rounded-xl border border-gray-700
      overflow-hidden shadow-lg h-fit mb-6">
      <div className="bg-gray-700 p-3 text-center font-bold text-yellow-400
        text-sm uppercase tracking-wider">
        {groupData[0]?.group || 'Classificação'}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead>
            <tr className="bg-gray-900 text-gray-500">
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
            {groupData.map((t, i) => (
              <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/40">
                <td className={`p-2 text-center font-black
                  ${t.rank <= 2 ? 'text-green-400' : 'text-gray-600'}`}>
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
                <td className="p-2 text-center text-gray-300">{t.all.played}</td>
                <td className="p-2 text-center text-green-400">{t.all.win}</td>
                <td className="p-2 text-center text-gray-400">{t.all.draw}</td>
                <td className="p-2 text-center text-red-400">{t.all.lose}</td>
                <td className="p-2 text-center text-gray-300 font-bold">
                  {(t.goalsDiff > 0 ? '+' : '') + t.goalsDiff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function Tabelas() {
  const [loading, setLoading]       = useState(true)
  const [competitions, setComps]    = useState([])
  const [selectedCompId, setCompId] = useState(null)
  const [standingsData, setStandings] = useState([])
  const [bracketData, setBracket]   = useState(null)
  const [activeView, setView]       = useState('standings')

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from('competitions').select('*').eq('is_active',true).order('id')
      if (data?.length) { setComps(data); setCompId(data[0].id) }
      else setLoading(false)
    }
    init()
  }, [])

  // ── Constrói standings virtuais a partir dos jogos ────────────────────────
  const buildVirtual = (matches) => {
    const groups = {}
    Object.keys(matches).forEach(round => {
      if (isKnockout(round)) return
      const gMatch = round.match(/(?:Group|Grupo)\s+([A-Z0-9]+)/i)
      const isSeries = round.includes('Regular Season') || round.includes('Serie')
      const key = gMatch ? `Grupo ${gMatch[1].toUpperCase()}` : isSeries ? 'Classificação Geral' : null
      if (!key) return
      if (!groups[key]) groups[key] = new Map()
      const map = groups[key]
      matches[round].forEach(m => {
        const upd = (team, gf, ga) => {
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
        upd(m.teams.home, m.goals.home, m.goals.away)
        upd(m.teams.away, m.goals.away, m.goals.home)
      })
    })
    return Object.keys(groups).sort().map(key => {
      const arr = Array.from(groups[key].values())
      arr.sort((a,b) => b.points-a.points || b.all.win-a.all.win || b.goalsDiff-a.goalsDiff)
      arr.forEach((t,i) => t.rank = i+1)
      return arr
    })
  }

  // ── Extrai bracket (só rounds de mata-mata) ───────────────────────────────
  const extractBracket = (matches) => {
    const b = {}
    // Inclui 3rd place
    const order = [...BRACKET_ORDER, '3rd Place Final']
    order.forEach(r => { if (matches[r]?.length > 0) b[r] = matches[r] })
    return Object.keys(b).length ? b : null
  }

  useEffect(() => {
    if (!selectedCompId) return
    async function load() {
      setLoading(true); setStandings([]); setBracket(null)
      let standingsFound = false

      // 1) API standings (dados ao vivo — mais atualizados)
      try {
        const r = await fetch(`/api/standings?competitionId=${selectedCompId}`)
        const d = await r.json()
        if (d.standings?.length > 0) { setStandings(d.standings); standingsFound = true }
      } catch (e) { console.warn('standings API:', e) }

      // 2) Supabase standings (só se API não retornou nada)
      if (!standingsFound) {
        const { data: rows } = await supabase
          .from('standings').select('*, teams(*)')
          .eq('competition_id', selectedCompId)
          .order('group_name').order('position')
        if (rows?.length > 0) {
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
          // Só usa Supabase se tiver pontuação (evita mostrar tudo zerado)
          if (arr.some(g => g.some(t => t.points > 0 || t.all.played > 0))) {
            setStandings(arr); standingsFound = true
          }
        }
      }

      // 3) matches-official: bracket E virtual standings como fallback
      try {
        const r = await fetch(`/api/matches-official?competitionId=${selectedCompId}`)
        const d = await r.json()
        if (d.matches && Object.keys(d.matches).length > 0) {
          const b = extractBracket(d.matches)
          if (b) setBracket(b)
          if (!standingsFound) {
            const v = buildVirtual(d.matches)
            if (v.length > 0) setStandings(v)
          }
        }
      } catch (e) { console.warn('matches-official:', e) }

      setLoading(false)
    }
    load()
  }, [selectedCompId])

  const hasStandings = standingsData.length > 0
  const hasBracket   = !!bracketData && Object.keys(bracketData).length > 0

  // Quando bracket aparece pela primeira vez, muda para ele automaticamente
  useEffect(() => {
    if (hasBracket && !hasStandings) setView('bracket')
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
                ${selectedCompId === c.id
                  ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg scale-105'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <SponsorBanner />

      {loading ? (
        <div className="text-white text-center p-16 animate-pulse">
          <div className="text-4xl mb-4">📡</div>Carregando...
        </div>
      ) : (
        <div className="w-full max-w-5xl">

          {/* Toggle Grupos / Mata-mata */}
          {(hasStandings || hasBracket) && (
            <div className="flex bg-gray-800 p-1 rounded-xl mb-6
              max-w-xs mx-auto border border-gray-700">
              {hasStandings && (
                <button onClick={() => setView('standings')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all
                    ${activeView==='standings' ? 'bg-gray-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                  🗂️ Grupos
                </button>
              )}
              {hasBracket && (
                <button onClick={() => setView('bracket')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all
                    ${activeView==='bracket' ? 'bg-yellow-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                  🏆 Mata-mata
                </button>
              )}
            </div>
          )}

          {/* Fase de grupos */}
          {activeView==='standings' && hasStandings && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {standingsData.map((g,i) => <StandingsTable key={i} groupData={g} groupIndex={i} />)}
            </div>
          )}

          {/* Mata-mata / Chaveamento */}
          {activeView==='bracket' && hasBracket && (
            <TournamentBracket bracketData={bracketData} />
          )}

          {/* Estado vazio */}
          {!hasStandings && !hasBracket && (
            <div className="text-center p-12 bg-gray-800/50 rounded-xl
              border border-gray-700 border-dashed text-gray-400 max-w-md mx-auto">
              <div className="text-5xl mb-3">📡</div>
              <p className="font-bold mb-1">Nenhum dado encontrado</p>
              <p className="text-sm text-gray-500">
                Importe os dados pelo painel admin.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
