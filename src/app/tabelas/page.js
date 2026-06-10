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

function traduzirRodada(roundName) {
  if (!roundName) return '';
  let nome = String(roundName);
  nome = nome.replace(/Group Stage - (\d+)/i, 'Rodada $1 - Fase de Grupos');
  nome = nome.replace(/Regular Season - (\d+)/i, 'Rodada $1 - Fase de Grupos');
  nome = nome.replace(/Round of 16/i, 'Oitavas de Final');
  nome = nome.replace(/Quarter-finals/i, 'Quartas de Final');
  nome = nome.replace(/Semi-finals/i, 'Semifinais');
  nome = nome.replace(/3rd Place Final/i, 'Disputa de 3º Lugar');
  if (nome.trim().toLowerCase() === 'final') return 'Grande Final';
  return nome;
}

function getFlagUrl(countryCode) {
  if (!countryCode) return '';
  return `https://flagcdn.com/w160/${countryCode.toLowerCase()}.png`;
}

const TeamBadge = ({ team }) => {
  const [imgSrc, setImgSrc] = useState(team?.logo || team?.badge_url)
  useEffect(() => { setImgSrc(team?.logo || team?.badge_url) }, [team])

  if (!team) return null
  
  if (!imgSrc && team.flag_code) {
      return <img src={getFlagUrl(team.flag_code)} alt={team.name} className="w-full h-full object-cover scale-110" />
  }
  return <img src={imgSrc} alt={team.name} className="w-full h-full object-contain p-1" />
}

export default function Tabelas() {
  const [loading, setLoading] = useState(true)
  const [competitions, setCompetitions] = useState([])
  const [selectedCompId, setSelectedCompId] = useState(null)
  
  const [standingsData, setStandingsData] = useState([]) 
  const [bracketData, setBracketData] = useState(null)   
  const [viewMode, setViewMode] = useState('standings')  

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

  const buildVirtualStandings = (groupedMatches) => {
    const consolidatedGroups = {}

    Object.keys(groupedMatches).forEach(roundName => {
      const groupMatch = roundName.match(/(?:Group|Grupo)\s+([A-Z0-9]+)/i)
      const isRegularSeason = roundName.includes('Regular Season') || roundName.includes('Serie A')
      let groupKey = null

      if (groupMatch) groupKey = `Grupo ${groupMatch[1].toUpperCase()}`
      else if (isRegularSeason) groupKey = 'Classificação Geral'

      if (groupKey) {
        if (!consolidatedGroups[groupKey]) consolidatedGroups[groupKey] = new Map()
        const matches = groupedMatches[roundName]
        const teamsMap = consolidatedGroups[groupKey]

        matches.forEach(m => {
          const updateTeam = (team, goalsFor, goalsAgainst) => {
            if (!teamsMap.has(team.id)) {
              teamsMap.set(team.id, {
                rank: 0, team: team, points: 0,
                all: { played: 0, win: 0, draw: 0, lose: 0, goals: { for: 0, against: 0 } },
                goalsDiff: 0, group: groupKey
              })
            }
            if (goalsFor !== null && goalsAgainst !== null) {
              const stats = teamsMap.get(team.id)
              stats.all.played += 1
              stats.all.goals.for += goalsFor
              stats.all.goals.against += goalsAgainst
              stats.goalsDiff = stats.all.goals.for - stats.all.goals.against

              if (goalsFor > goalsAgainst) { stats.points += 3; stats.all.win += 1 } 
              else if (goalsFor === goalsAgainst) { stats.points += 1; stats.all.draw += 1 } 
              else { stats.all.lose += 1 }
            }
          }
          updateTeam(m.teams.home, m.goals.home, m.goals.away)
          updateTeam(m.teams.away, m.goals.away, m.goals.home)
        })
      }
    })

    const finalStandings = Object.keys(consolidatedGroups).sort().map(groupKey => {
      const teamsMap = consolidatedGroups[groupKey]
      const teamsArray = Array.from(teamsMap.values())
      teamsArray.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.all.win !== a.all.win) return b.all.win - a.all.win
        if (b.goalsDiff !== a.goalsDiff) return b.goalsDiff - a.goalsDiff
        return a.team.name.localeCompare(b.team.name)
      })
      teamsArray.forEach((t, i) => t.rank = i + 1)
      return teamsArray
    })
    return finalStandings
  }

  useEffect(() => {
    if (!selectedCompId) return

    async function fetchData() {
      setLoading(true)
      setStandingsData([])
      setBracketData(null)
      setViewMode('standings')
      
      try {
        const res = await fetch(`/api/standings?competitionId=${selectedCompId}`)
        const apiResult = await res.json()
        
        if (apiResult.standings && apiResult.standings.length > 0) {
            setStandingsData(apiResult.standings)
        } else {
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
                        points: row.points,
                        all: { played: row.played, win: row.won, draw: row.drawn, lose: row.lost },
                        goalsDiff: row.goals_diff,
                        group: row.group_name
                    })
                })
                setStandingsData(Object.values(grouped))
            } else {
                const resMatches = await fetch(`/api/matches-official?competitionId=${selectedCompId}`)
                const dataMatches = await resMatches.json()
                
                if (dataMatches.matches && Object.keys(dataMatches.matches).length > 0) {
                    const virtualStandings = buildVirtualStandings(dataMatches.matches)
                    if (virtualStandings.length > 0) {
                        setStandingsData(virtualStandings)
                        setViewMode('standings')
                    } else {
                        setBracketData(dataMatches.matches)
                        setViewMode('bracket')
                    }
                } else {
                    setStandingsData([])
                }
            }
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [selectedCompId])

  const renderTable = (groupData, groupIndex) => (
    <div key={groupIndex} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg h-fit mb-6">
      <div className="bg-gray-700 p-3 text-center font-bold text-yellow-400 text-sm uppercase tracking-wider">
         {groupData[0]?.group || 'Classificação'}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left whitespace-nowrap">
            <thead>
            <tr className="bg-gray-900 text-gray-500">
                <th className="p-3 text-center w-10">#</th>
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
                <td className={`p-3 text-center font-bold ${team.rank <= 2 ? 'text-green-400' : 'text-gray-500'}`}>{team.rank}</td>
                <td className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-600 flex items-center justify-center bg-gray-900 flex-shrink-0 shadow-sm">
                        <TeamBadge team={team.team} />
                    </div>
                    <span className="font-bold text-gray-200 text-sm whitespace-normal max-w-[120px]">
                        {traducoesPaises[team.team.name] || team.team.name}
                    </span>
                </td>
                <td className="p-3 text-center font-bold text-yellow-400 text-base">{team.points}</td>
                <td className="p-3 text-center text-gray-300">{team.all.played}</td>
                <td className="p-3 text-center text-green-400">{team.all.win}</td>
                <td className="p-3 text-center text-gray-400">{team.all.draw}</td>
                <td className="p-3 text-center text-red-400">{team.all.lose}</td>
                <td className="p-3 text-center text-gray-300 font-bold">{team.goalsDiff}</td>
                </tr>
            ))}
            </tbody>
        </table>
      </div>
    </div>
  )

  const renderBracketRound = (roundName, matches) => (
    <div key={roundName} className="mb-8 w-full animate-fade-in">
        <h3 className="text-lg font-bold text-blue-400 mb-3 border-b border-gray-700 pb-1 px-2">
            {traduzirRodada(roundName)}
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
            {matches.map(m => (
                <div key={m.fixture.id} className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center shadow-md hover:border-gray-500 transition">
                    <div className="flex items-center gap-3 flex-1 overflow-hidden">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-600 flex items-center justify-center bg-gray-900 flex-shrink-0">
                            <TeamBadge team={{ name: m.teams.home.name, logo: m.teams.home.logo }} />
                        </div>
                        <span className={`text-sm font-bold truncate ${m.goals.home > m.goals.away ? 'text-white' : 'text-gray-400'}`}>
                            {traducoesPaises[m.teams.home.name] || m.teams.home.name}
                        </span>
                    </div>
                    
                    <div className="px-3 py-1 bg-gray-900 rounded font-mono text-white text-sm font-bold whitespace-nowrap border border-gray-600 mx-2 shadow-inner">
                        {m.goals.home ?? ''} <span className="text-gray-600 mx-1">x</span> {m.goals.away ?? ''}
                        {m.score.penalty.home !== null && (
                            <div className="text-[10px] text-center text-yellow-500 mt-1">
                                ({m.score.penalty.home} - {m.score.penalty.away})
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 flex-1 justify-end overflow-hidden">
                        <span className={`text-sm font-bold text-right truncate ${m.goals.away > m.goals.home ? 'text-white' : 'text-gray-400'}`}>
                            {traducoesPaises[m.teams.away.name] || m.teams.away.name}
                        </span>
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-600 flex items-center justify-center bg-gray-900 flex-shrink-0">
                            <TeamBadge team={{ name: m.teams.away.name, logo: m.teams.away.logo }} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center pb-24">
      <h1 className="text-3xl font-bold text-yellow-400 mb-6 mt-4 text-center">📊 Dados Oficiais</h1>

      <div className="w-full max-w-4xl mb-4 overflow-x-auto no-scrollbar">
        <div className="flex justify-center space-x-2 pb-2 min-w-max">
          {competitions.map(comp => (
            <button key={comp.id} onClick={() => setSelectedCompId(comp.id)} className={`px-6 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all border ${selectedCompId === comp.id ? 'bg-yellow-500 text-black shadow-lg scale-105' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {comp.name}
            </button>
          ))}
        </div>
      </div>
      
      <SponsorBanner />

      {loading ? (
        <div className="text-white text-center p-10 animate-pulse">Carregando dados...</div>
      ) : (
        <div className="w-full max-w-5xl">
            {viewMode === 'standings' && standingsData.length > 0 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    {standingsData.map((group, index) => renderTable(group, index))}
                </div>
            )}
            {viewMode === 'bracket' && bracketData && (
                <div className="w-full max-w-3xl mx-auto animate-fade-in">
                    {Object.entries(bracketData).reverse().map(([round, matches]) => renderBracketRound(round, matches))}
                </div>
            )}
            {standingsData.length === 0 && !bracketData && (
                <div className="text-center p-10 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed text-gray-400 max-w-md mx-auto">
                    <div className="text-4xl mb-3">📡</div>
                    <p>Nenhum dado encontrado para esta competição.</p>
                </div>
            )}
        </div>
      )}
    </div>
  )
}