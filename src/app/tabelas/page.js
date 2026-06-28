'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import SponsorBanner from '../../components/SponsorBanner'

const traducoesPaises = {
  "Algeria": "Argélia", "Argentina": "Argentina", "Australia": "Austrália", "Austria": "Áustria",
  "Belgium": "Bélgica", "Bosnia & Herzegovina": "Bósnia e Herzegovina", "Brazil": "Brasil",
  "Canada": "Canadá", "Cape Verde Islands": "Cabo Verde", "Colombia": "Colômbia", "Congo DR": "RD Congo",
  "Croatia": "Croácia", "Curaçao": "Curaçao", "Czech Republic": "República Tcheca", "Ecuador": "Equador",
  "Egypt": "Egito", "England": "Inglaterra", "France": "França", "Germany": "Alemanha", "Ghana": "Gana",
  "Haiti": "Haiti", "Iran": "Irã", "Iraq": "Iraque", "Ivory Coast": "Costa do Marfim", "Japan": "Japão",
  "Jordan": "Jordânia", "Mexico": "México", "Morocco": "Marrocos", "Netherlands": "Holanda",
  "New Zealand": "Nova Zelândia", "Norway": "Noruega", "Panama": "Panamá", "Paraguay": "Paraguai",
  "Portugal": "Portugal", "Qatar": "Catar", "Saudi Arabia": "Arábia Saudita", "Scotland": "Escócia",
  "Senegal": "Senegal", "South Africa": "África do Sul", "South Korea": "Coreia do Sul", "Spain": "Espanha",
  "Sweden": "Suécia", "Switzerland": "Suíça", "Tunisia": "Tunísia", "Türkiye": "Turquia",
  "Uruguay": "Uruguai", "USA": "Estados Unidos", "Uzbekistan": "Uzbequistão"
};

// Ordem oficial das fases do mata-mata
const KNOCKOUT_ORDER = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place Final', 'Final']

const ROUND_LABELS = {
  'Round of 32': { pt: '16avos de Final', short: '16avos', icon: '⚔️' },
  'Round of 16': { pt: 'Oitavas de Final', short: 'Oitavas', icon: '⚽' },
  'Quarter-finals': { pt: 'Quartas de Final', short: 'Quartas', icon: '🔥' },
  'Semi-finals': { pt: 'Semifinais', short: 'Semi', icon: '⭐' },
  '3rd Place Final': { pt: 'Disputa do 3º Lugar', short: '3º Lugar', icon: '🥉' },
  'Final': { pt: 'Grande Final', short: 'Final', icon: '🏆' },
}

function traduzirRodada(roundName) {
  if (!roundName) return ''
  const label = ROUND_LABELS[roundName]
  if (label) return label.pt
  let nome = String(roundName)
  nome = nome.replace(/Group Stage - (\d+)/i, 'Rodada $1 - Fase de Grupos')
  nome = nome.replace(/Regular Season - (\d+)/i, 'Rodada $1 - Fase de Grupos')
  if (nome.trim().toLowerCase() === 'final') return 'Grande Final'
  return nome
}

function isKnockoutRound(roundName) {
  return KNOCKOUT_ORDER.includes(roundName) || roundName === 'Final'
}

function isGroupRound(roundName) {
  return !isKnockoutRound(roundName)
}

function getFlagUrl(countryCode) {
  if (!countryCode) return ''
  return `https://flagcdn.com/w80/${countryCode.toLowerCase()}.png`
}

const TeamBadge = ({ team, size = 'md' }) => {
  const sz = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'
  const [imgSrc, setImgSrc] = useState(team?.logo || team?.badge_url)
  useEffect(() => { setImgSrc(team?.logo || team?.badge_url) }, [team])
  if (!team) return null
  if (!imgSrc && team.flag_code) return (
    <img src={getFlagUrl(team.flag_code)} alt={team.name}
      className={`${sz} object-cover rounded-full`} />
  )
  return (
    <img src={imgSrc} alt={team.name}
      className={`${sz} object-contain rounded-full bg-gray-900 p-0.5`}
      onError={() => setImgSrc(null)} />
  )
}

// ─── Cartão de partida do mata-mata ─────────────────────────────────────────
const BracketMatchCard = ({ match, isCompact = false }) => {
  if (!match) return (
    <div className={`rounded-xl border border-dashed border-gray-700 bg-gray-800/30
      flex items-center justify-center text-gray-600 text-xs
      ${isCompact ? 'h-16' : 'h-20'}`}>
      — Aguardando —
    </div>
  )

  const home = match.teams?.home
  const away = match.teams?.away
  const gH = match.goals?.home ?? null
  const gA = match.goals?.away ?? null
  const penH = match.score?.penalty?.home ?? null
  const penA = match.score?.penalty?.away ?? null
  const hasPen = penH !== null && penA !== null
  const finished = match.goals != null && gH !== null && gA !== null
  const homeWins = finished && (hasPen ? penH > penA : gH > gA)
  const awayWins = finished && (hasPen ? penA > penH : gA > gH)

  const teamRow = (team, goals, isWinner, isLoser) => (
    <div className={`flex items-center gap-2 px-3 py-2 transition-all
      ${isWinner ? 'bg-green-900/30' : isLoser ? 'opacity-50' : ''}`}>
      <TeamBadge team={team} size={isCompact ? 'sm' : 'md'} />
      <span className={`flex-1 text-xs font-bold truncate ${isWinner ? 'text-white' : 'text-gray-300'}`}>
        {traducoesPaises[team?.name] || team?.name || '?'}
      </span>
      {finished && (
        <span className={`text-sm font-black w-5 text-center ${isWinner ? 'text-green-400' : 'text-gray-500'}`}>
          {goals ?? '–'}
        </span>
      )}
    </div>
  )

  return (
    <div className={`rounded-xl border overflow-hidden shadow-md
      ${finished ? (homeWins || awayWins) ? 'border-gray-600' : 'border-gray-700' : 'border-gray-700'}
      bg-gray-800`}>
      {teamRow(home, gH, homeWins, awayWins)}
      <div className="h-px bg-gray-700" />
      {teamRow(away, gA, awayWins, homeWins)}
      {hasPen && (
        <div className="text-center text-[10px] text-yellow-400 font-bold bg-yellow-900/20 py-1 border-t border-yellow-900/40">
          Pênaltis: {penH} – {penA}
        </div>
      )}
    </div>
  )
}

// ─── Coluna de uma fase do chaveamento ───────────────────────────────────────
const BracketRoundColumn = ({ roundKey, matches, isLast }) => {
  const label = ROUND_LABELS[roundKey]
  const isFinal = roundKey === 'Final'
  const is3rd = roundKey === '3rd Place Final'

  return (
    <div className={`flex flex-col ${isFinal ? 'min-w-[160px]' : 'min-w-[200px]'}`}>
      {/* Cabeçalho da fase */}
      <div className={`text-center mb-3 py-2 px-3 rounded-lg font-bold text-xs uppercase tracking-wider
        ${isFinal ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400'
          : is3rd ? 'bg-orange-900/20 border border-orange-700/40 text-orange-400'
          : 'bg-gray-700/50 border border-gray-600/40 text-gray-300'}`}>
        <span className="mr-1">{label?.icon}</span>
        {label?.short || traduzirRodada(roundKey)}
      </div>

      {/* Partidas da fase */}
      <div className={`flex flex-col gap-3 flex-1
        ${isFinal ? 'justify-center' : is3rd ? 'justify-end' : 'justify-around'}`}>
        {matches.map((m, i) => (
          <BracketMatchCard key={m?.fixture?.id || i} match={m} isCompact={matches.length > 4} />
        ))}
      </div>
    </div>
  )
}

// ─── Conector visual entre fases ─────────────────────────────────────────────
const RoundConnector = ({ fromCount, toCount }) => {
  const lines = []
  for (let i = 0; i < toCount; i++) {
    lines.push(
      <div key={i} className="flex-1 flex items-center">
        <div className="w-full h-px bg-gray-600/50" />
      </div>
    )
  }
  return (
    <div className="flex flex-col justify-around w-4 flex-shrink-0">
      {lines}
    </div>
  )
}

// ─── Componente principal do chaveamento ─────────────────────────────────────
const BracketView = ({ bracketData }) => {
  // Ordena e filtra apenas as fases existentes
  const rounds = KNOCKOUT_ORDER
    .filter(r => bracketData[r] && bracketData[r].length > 0 && r !== '3rd Place Final')
  const thirdPlace = bracketData['3rd Place Final']

  if (rounds.length === 0) return (
    <div className="text-center py-16 text-gray-500">
      <div className="text-4xl mb-3">📡</div>
      Dados do mata-mata ainda não disponíveis.
    </div>
  )

  // ── Versão MOBILE: rounds verticais ───────────────────────────────────────
  const MobileView = () => (
    <div className="flex flex-col gap-6 md:hidden">
      {rounds.map(roundKey => {
        const matches = bracketData[roundKey] || []
        const label = ROUND_LABELS[roundKey]
        const isFinal = roundKey === 'Final'
        return (
          <div key={roundKey}>
            <div className={`flex items-center gap-2 mb-3 py-2 px-4 rounded-lg font-bold text-sm
              ${isFinal ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400'
                : 'bg-gray-700/50 text-gray-200'}`}>
              <span>{label?.icon}</span>
              {label?.pt || traduzirRodada(roundKey)}
              <span className="ml-auto bg-gray-600/50 px-2 py-0.5 rounded text-xs font-normal text-gray-400">
                {matches.length} jogos
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {matches.map((m, i) => (
                <BracketMatchCard key={m?.fixture?.id || i} match={m} />
              ))}
            </div>
          </div>
        )
      })}

      {/* 3º Lugar */}
      {thirdPlace && thirdPlace.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 py-2 px-4 rounded-lg font-bold text-sm bg-orange-900/20 border border-orange-700/40 text-orange-400">
            🥉 Disputa do 3º Lugar
          </div>
          {thirdPlace.map((m, i) => (
            <BracketMatchCard key={m?.fixture?.id || i} match={m} />
          ))}
        </div>
      )}
    </div>
  )

  // ── Versão DESKTOP: fluxo horizontal ─────────────────────────────────────
  const DesktopView = () => (
    <div className="hidden md:block overflow-x-auto pb-4">
      <div className="flex gap-0 items-stretch min-w-max px-2" style={{ minHeight: 600 }}>
        {rounds.map((roundKey, idx) => {
          const matches = bracketData[roundKey] || []
          const nextRoundKey = rounds[idx + 1]
          const nextCount = nextRoundKey ? (bracketData[nextRoundKey] || []).length : 0
          const isLast = idx === rounds.length - 1

          return (
            <div key={roundKey} className="flex items-stretch">
              <BracketRoundColumn
                roundKey={roundKey}
                matches={matches}
                isLast={isLast}
              />
              {!isLast && (
                <RoundConnector fromCount={matches.length} toCount={nextCount} />
              )}
            </div>
          )
        })}
      </div>

      {/* 3º Lugar separado abaixo */}
      {thirdPlace && thirdPlace.length > 0 && (
        <div className="mt-6 max-w-sm mx-auto">
          <div className="text-center mb-3 py-2 px-4 rounded-lg font-bold text-xs uppercase tracking-wider bg-orange-900/20 border border-orange-700/40 text-orange-400">
            🥉 Disputa do 3º Lugar
          </div>
          {thirdPlace.map((m, i) => (
            <BracketMatchCard key={m?.fixture?.id || i} match={m} />
          ))}
        </div>
      )}
    </div>
  )

  // ── Campeão no topo (se final finalizada) ─────────────────────────────────
  const finalMatch = bracketData['Final']?.[0] ?? null
  // FIX: checar finalMatch != null ANTES de acessar .goals (evita TypeError)
  const finalFinished = finalMatch != null
    && finalMatch.goals != null
    && finalMatch.goals.home !== null
    && finalMatch.goals.away !== null
  let champion = null
  if (finalFinished) {
    const penH = finalMatch.score?.penalty?.home ?? null
    const penA = finalMatch.score?.penalty?.away ?? null
    const hasPen = penH !== null && penA !== null
    const homeWins = hasPen
      ? (penH ?? 0) > (penA ?? 0)
      : (finalMatch.goals.home ?? 0) > (finalMatch.goals.away ?? 0)
    champion = homeWins ? finalMatch.teams?.home : finalMatch.teams?.away
  }

  return (
    <div>
      {/* Banner do campeão */}
      {champion && (
        <div className="mb-8 p-5 rounded-2xl bg-gradient-to-r from-yellow-900/40 to-yellow-700/20
          border border-yellow-500/40 flex flex-col items-center gap-3 shadow-xl">
          <div className="text-3xl">🏆</div>
          <div className="text-yellow-400 font-bold text-xs uppercase tracking-widest">Campeão Mundial</div>
          <div className="flex items-center gap-3">
            <TeamBadge team={{ name: champion.name, logo: champion.logo }} size="lg" />
            <span className="text-2xl font-black text-white">
              {traducoesPaises[champion.name] || champion.name}
            </span>
          </div>
        </div>
      )}

      <MobileView />
      <DesktopView />
    </div>
  )
}

// ─── Tabela de classificação ─────────────────────────────────────────────────
const StandingsTable = ({ groupData, groupIndex }) => (
  <div key={groupIndex} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg h-fit mb-6">
    <div className="bg-gray-700 p-3 text-center font-bold text-yellow-400 text-sm uppercase tracking-wider">
      {groupData[0]?.group || 'Classificação'}
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left whitespace-nowrap">
        <thead>
          <tr className="bg-gray-900 text-gray-500">
            <th className="p-3 text-center w-8">#</th>
            <th className="p-3">Seleção</th>
            <th className="p-3 text-center" title="Pontos">P</th>
            <th className="p-3 text-center" title="Jogos">J</th>
            <th className="p-3 text-center" title="Vitórias">V</th>
            <th className="p-3 text-center" title="Empates">E</th>
            <th className="p-3 text-center" title="Derrotas">D</th>
            <th className="p-3 text-center" title="Saldo">SG</th>
          </tr>
        </thead>
        <tbody>
          {groupData.map((team, idx) => (
            <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/50 transition">
              <td className={`p-3 text-center font-bold ${team.rank <= 2 ? 'text-green-400' : 'text-gray-500'}`}>
                {team.rank}
              </td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-gray-600 bg-gray-900 flex-shrink-0">
                    <TeamBadge team={team.team} size="sm" />
                  </div>
                  <span className="font-bold text-gray-200 text-xs">
                    {traducoesPaises[team.team.name] || team.team.name}
                  </span>
                </div>
              </td>
              <td className="p-3 text-center font-bold text-yellow-400">{team.points}</td>
              <td className="p-3 text-center text-gray-300">{team.all.played}</td>
              <td className="p-3 text-center text-green-400">{team.all.win}</td>
              <td className="p-3 text-center text-gray-400">{team.all.draw}</td>
              <td className="p-3 text-center text-red-400">{team.all.lose}</td>
              <td className="p-3 text-center text-gray-300 font-bold">{team.goalsDiff > 0 ? `+${team.goalsDiff}` : team.goalsDiff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Tabelas() {
  const [loading, setLoading] = useState(true)
  const [competitions, setCompetitions] = useState([])
  const [selectedCompId, setSelectedCompId] = useState(null)
  const [standingsData, setStandingsData] = useState([])
  const [bracketData, setBracketData] = useState(null)
  const [activeView, setActiveView] = useState('standings') // 'standings' | 'bracket'

  useEffect(() => {
    async function init() {
      const { data: comps } = await supabase.from('competitions').select('*').eq('is_active', true).order('id')
      if (comps && comps.length > 0) {
        setCompetitions(comps)
        setSelectedCompId(comps[0].id)
      } else { setLoading(false) }
    }
    init()
  }, [])

  // ── Constrói tabelas virtuais a partir dos jogos ──────────────────────────
  const buildVirtualStandings = (groupedMatches) => {
    const consolidatedGroups = {}
    Object.keys(groupedMatches).forEach(roundName => {
      if (isKnockoutRound(roundName)) return // ignora mata-mata
      const groupMatch = roundName.match(/(?:Group|Grupo)\s+([A-Z0-9]+)/i)
      const isRegularSeason = roundName.includes('Regular Season') || roundName.includes('Serie A')
      let groupKey = null
      if (groupMatch) groupKey = `Grupo ${groupMatch[1].toUpperCase()}`
      else if (isRegularSeason) groupKey = 'Classificação Geral'
      if (!groupKey) return

      if (!consolidatedGroups[groupKey]) consolidatedGroups[groupKey] = new Map()
      const teamsMap = consolidatedGroups[groupKey]
      groupedMatches[roundName].forEach(m => {
        const updateTeam = (team, goalsFor, goalsAgainst) => {
          if (!teamsMap.has(team.id)) {
            teamsMap.set(team.id, {
              rank: 0, team, points: 0,
              all: { played: 0, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } },
              goalsDiff: 0, group: groupKey
            })
          }
          if (goalsFor !== null && goalsAgainst !== null) {
            const s = teamsMap.get(team.id)
            s.all.played++; s.all.goals.for += goalsFor; s.all.goals.against += goalsAgainst
            s.goalsDiff = s.all.goals.for - s.all.goals.against
            if (goalsFor > goalsAgainst) { s.points += 3; s.all.win++ }
            else if (goalsFor === goalsAgainst) { s.points += 1; s.all.draw++ }
            else s.all.lose++
          }
        }
        updateTeam(m.teams.home, m.goals.home, m.goals.away)
        updateTeam(m.teams.away, m.goals.away, m.goals.home)
      })
    })

    return Object.keys(consolidatedGroups).sort().map(groupKey => {
      const arr = Array.from(consolidatedGroups[groupKey].values())
      arr.sort((a, b) => b.points - a.points || b.all.win - a.all.win || b.goalsDiff - a.goalsDiff)
      arr.forEach((t, i) => t.rank = i + 1)
      return arr
    })
  }

  // ── Extrai dados do mata-mata ──────────────────────────────────────────────
  const extractBracket = (groupedMatches) => {
    const bracket = {}
    KNOCKOUT_ORDER.forEach(roundKey => {
      if (groupedMatches[roundKey] && groupedMatches[roundKey].length > 0) {
        bracket[roundKey] = groupedMatches[roundKey]
      }
    })
    return Object.keys(bracket).length > 0 ? bracket : null
  }

  useEffect(() => {
    if (!selectedCompId) return
    async function fetchData() {
      setLoading(true)
      setStandingsData([])
      setBracketData(null)

      try {
        // FIX: Prioridade clara — API > Supabase > Virtual (nunca sobrescreve com zeros)
        let standingsFound = false

        // 1) Tenta API de standings (dados ao vivo — mais atualizados)
        try {
          const res = await fetch(`/api/standings?competitionId=${selectedCompId}`)
          const apiResult = await res.json()
          if (apiResult.standings && apiResult.standings.length > 0) {
            setStandingsData(apiResult.standings)
            standingsFound = true
          }
        } catch (e) { console.warn('API standings falhou:', e) }

        // 2) Só usa Supabase se API não retornou nada
        if (!standingsFound) {
          const { data: manualStandings } = await supabase
            .from('standings')
            .select('*, teams(*)')
            .eq('competition_id', selectedCompId)
            .order('group_name', { ascending: true })
            .order('position', { ascending: true })

          if (manualStandings && manualStandings.length > 0) {
            const grouped = {}
            manualStandings.forEach(row => {
              if (!grouped[row.group_name]) grouped[row.group_name] = []
              grouped[row.group_name].push({
                rank: row.position,
                team: { id: row.teams?.id, name: row.teams?.name, logo: row.teams?.badge_url, flag_code: row.teams?.flag_code },
                points: row.points ?? 0,
                all: { played: row.played ?? 0, win: row.won ?? 0, draw: row.drawn ?? 0, lose: row.lost ?? 0 },
                goalsDiff: row.goals_diff ?? 0,
                group: row.group_name
              })
            })
            const grouped_arr = Object.values(grouped)
            // Só usa Supabase se tiver pontuação (evita mostrar tudo zerado)
            const hasPoints = grouped_arr.some(g => g.some(t => t.points > 0 || t.all.played > 0))
            if (hasPoints) {
              setStandingsData(grouped_arr)
              standingsFound = true
            }
          }
        }

        // 3) Busca jogos — mata-mata E virtual standings (fallback)
        try {
          const resMatches = await fetch(`/api/matches-official?competitionId=${selectedCompId}`)
          const dataMatches = await resMatches.json()

          if (dataMatches.matches && Object.keys(dataMatches.matches).length > 0) {
            // Extrai e seta mata-mata
            const bracket = extractBracket(dataMatches.matches)
            if (bracket) setBracketData(bracket)

            // Virtual standings só se nenhuma outra fonte funcionou
            if (!standingsFound) {
              const virtual = buildVirtualStandings(dataMatches.matches)
              if (virtual.length > 0) setStandingsData(virtual)
            }
          }
        } catch (e) { console.warn('matches-official falhou:', e) }

      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedCompId])

  const hasStandings = standingsData.length > 0
  const hasBracket = !!bracketData && Object.keys(bracketData).length > 0

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center pb-24">
      <h1 className="text-3xl font-bold text-yellow-400 mb-4 mt-4 text-center">📊 Dados Oficiais</h1>

      {/* Seletor de competição */}
      <div className="w-full max-w-4xl mb-4 overflow-x-auto no-scrollbar">
        <div className="flex justify-center space-x-2 pb-2 min-w-max">
          {competitions.map(comp => (
            <button key={comp.id} onClick={() => setSelectedCompId(comp.id)}
              className={`px-6 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all border
                ${selectedCompId === comp.id
                  ? 'bg-yellow-500 text-black shadow-lg scale-105 border-yellow-500'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}`}>
              {comp.name}
            </button>
          ))}
        </div>
      </div>

      <SponsorBanner />

      {loading ? (
        <div className="text-white text-center p-16 animate-pulse">
          <div className="text-4xl mb-4">📡</div>
          Carregando dados...
        </div>
      ) : (
        <div className="w-full max-w-5xl">

          {/* Toggle Grupos / Mata-mata */}
          {(hasStandings || hasBracket) && (
            <div className="flex bg-gray-800 p-1 rounded-xl mb-6 max-w-sm mx-auto border border-gray-700">
              {hasStandings && (
                <button onClick={() => setActiveView('standings')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all
                    ${activeView === 'standings' ? 'bg-gray-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                  🗂️ Grupos
                </button>
              )}
              {hasBracket && (
                <button onClick={() => setActiveView('bracket')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all
                    ${activeView === 'bracket' ? 'bg-yellow-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                  🏆 Mata-mata
                </button>
              )}
            </div>
          )}

          {/* ── Fase de Grupos ── */}
          {activeView === 'standings' && hasStandings && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
              {standingsData.map((group, index) => (
                <StandingsTable key={index} groupData={group} groupIndex={index} />
              ))}
            </div>
          )}

          {/* ── Mata-mata / Chaveamento ── */}
          {activeView === 'bracket' && hasBracket && (
            <div className="animate-fade-in">
              <BracketView bracketData={bracketData} />
            </div>
          )}

          {/* Estado vazio */}
          {!hasStandings && !hasBracket && (
            <div className="text-center p-12 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed text-gray-400 max-w-md mx-auto">
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
