'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import GameCard from '../../components/GameCard'
import SponsorBanner from '../../components/SponsorBanner'

export default function Calendario() {
  const [games, setGames] = useState([])
  const [userBetsMap, setUserBetsMap] = useState({}) 
  const [loading, setLoading] = useState(true)

  // NAVEGAÇÃO
  const [competitions, setCompetitions] = useState([])
  const [selectedCompId, setSelectedCompId] = useState(null)
  
  // FILTROS
  const [rounds, setRounds] = useState([])
  const [selectedRound, setSelectedRound] = useState('Todas')

  // DADOS FILTRADOS
  const [filteredGames, setFilteredGames] = useState([])

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

  useEffect(() => {
    if (!selectedCompId) return

    async function loadData() {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const { data: bets } = await supabase.from('bets').select('*').eq('user_id', session.user.id)
        const betsMap = {}
        bets?.forEach(b => betsMap[b.game_id] = { scoreA: b.guess_score_a, scoreB: b.guess_score_b, points_awarded: b.points_awarded })
        setUserBetsMap(betsMap)
      }

      const { data: gamesData } = await supabase
        .from('games')
        .select(`
          *,
          team_a:teams!team_a_id(name, flag_code, badge_url),
          team_b:teams!team_b_id(name, flag_code, badge_url)
        `)
        .eq('competition_id', selectedCompId)
        .order('start_time', { ascending: false })

      if (gamesData) {
        setGames(gamesData)
        setFilteredGames(gamesData)
        const uniqueRounds = [...new Set(gamesData.map(g => g.round))].filter(Boolean).sort()
        setRounds(uniqueRounds)
        setSelectedRound('Todas')
      }
      setLoading(false)
    }
    loadData()

    const channel = supabase
      .channel('realtime_games_calendar')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, (payload) => {
        setGames(currentGames => {
            const updated = currentGames.map(g => {
                if (g.id === payload.new.id) {
                    return { ...g, ...payload.new }
                }
                return g
            })
            return updated
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }

  }, [selectedCompId])

  useEffect(() => {
    if (selectedRound === 'Todas') setFilteredGames(games)
    else setFilteredGames(games.filter(g => g.round === selectedRound))
  }, [selectedRound, games])

  const calcularPontosAoVivo = (palpiteA, palpiteB, realA, realB) => {
    if (palpiteA === '' || palpiteB === '' || realA === null || realB === null || palpiteA === undefined || palpiteB === undefined) return null
    const pA = Number(palpiteA); const pB = Number(palpiteB); const rA = Number(realA); const rB = Number(realB)
    if (pA === rA && pB === rB) return 10
    const signP = Math.sign(pA - pB); const signR = Math.sign(rA - rB)
    if (signP === signR) {
      if (pA === rA || pB === rB || (pA - pB) === (rA - rB)) return 7
      return 5
    }
    if (pA === rA || pB === rB) return 2
    return 0
  }

  // --- HELPER: FORMATA O TEMPO DE JOGO ---
  const formatGameTime = (status, elapsed) => {
      if (status === 'HT') return 'INTERVALO'
      if (status === 'FT' || status === 'AET' || status === 'PEN') return 'FIM'
      if ((status === '1H' || status === '2H' || status === 'ET') && elapsed) return `${elapsed}'`
      return ''
  }

  if (loading && competitions.length === 0) return <div className="text-white text-center p-10">Carregando...</div>

  return (
    <div className="p-4 pb-24 flex flex-col items-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold text-yellow-400 mb-6 mt-4 text-center">📅 Calendário de Jogos</h1>

      <div className="w-full max-w-4xl mb-4 overflow-x-auto no-scrollbar">
        <div className="flex justify-center space-x-2 pb-2 min-w-max">
          {competitions.map(comp => (
            <button key={comp.id} onClick={() => setSelectedCompId(comp.id)} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all border ${selectedCompId === comp.id ? 'bg-yellow-500 text-black shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{comp.name}</button>
          ))}
        </div>
      </div>
      
      {/* BANNER AQUI */}
      <SponsorBanner />

      <div className="w-full max-w-md flex justify-between items-end mb-4 px-1">
          <h2 className="text-xl font-bold text-gray-300">Jogos</h2>
          <select className="bg-gray-800 border border-gray-600 text-white text-xs p-2 rounded outline-none focus:border-yellow-500 max-w-[150px]" value={selectedRound} onChange={(e) => setSelectedRound(e.target.value)}><option value="Todas">Todas as Rodadas</option>{rounds.map(r => <option key={r} value={r}>{r}</option>)}</select>
      </div>
      
      <div className="w-full max-w-md flex flex-col gap-6">
        {filteredGames.map((game) => {
          const palpiteValues = userBetsMap[game.id] || { scoreA: '', scoreB: '' }
          
          // --- CORREÇÃO DE LÓGICA (FUTURO vs AO VIVO) ---
          
          // Status que confirmam que o jogo NÃO começou
          const notStartedStatuses = ['NS', 'TBD', 'PST'] // Not Started, To Be Defined, Postponed
          const isNotStarted = notStartedStatuses.includes(game.status_short)

          // Só consideramos que tem dados se NÃO for NS/TBD e tiver status válido OU placar manual
          const hasMatchData = !isNotStarted && (
             (game.status_short && game.status_short !== 'NS') || 
             (game.score_a !== null && game.score_b !== null)
          )
          
          // Ao Vivo = Começou E Não acabou
          const isLive = !game.is_finished && hasMatchData
          
          const displayScoreA = game.score_a ?? 0
          const displayScoreB = game.score_b ?? 0
          
          let livePoints = null
          // Só calcula pontos se tiver começado de verdade
          if (hasMatchData) {
             livePoints = game.is_finished 
                ? (palpiteValues.points_awarded ?? calcularPontosAoVivo(palpiteValues.scoreA, palpiteValues.scoreB, displayScoreA, displayScoreB))
                : calcularPontosAoVivo(palpiteValues.scoreA, palpiteValues.scoreB, displayScoreA, displayScoreB)
          }

          const timeText = isLive ? formatGameTime(game.status_short, game.elapsed) : 'FIM'

          return (
            <div key={game.id} className="relative flex flex-col items-center"> 
              <div className="pointer-events-none opacity-90 w-full z-10">
                <GameCard 
                  game={{
                    ...game, 
                    score_a: hasMatchData ? displayScoreA : null, // Se for futuro, anula o placar
                    score_b: hasMatchData ? displayScoreB : null,
                    // Passamos o tempo para o card desenhar DENTRO da caixa
                    custom_status: isLive ? timeText : null
                  }} 
                  values={palpiteValues} 
                  isEditing={false} onChange={() => {}} onToggleEdit={() => {}}
                />
              </div>

              {/* BARRA DE PONTUAÇÃO (SÓ SE TIVER DADOS) */}
              {hasMatchData && livePoints !== null && (
                <div className={`
                  mt-[-12px] pt-4 pb-1 px-6 rounded-b-xl text-[10px] font-bold uppercase tracking-wider shadow-lg z-0 border-x border-b transform transition-all animate-fade-in
                  ${livePoints === 10 ? 'bg-yellow-600 border-yellow-400 text-white' : 
                    livePoints >= 5 ? 'bg-green-600 border-green-400 text-white' :
                    'bg-red-900 border-red-500 text-red-200'}
                `}>
                   Sua Pontuação: +{livePoints} pts
                </div>
              )}
            </div>
          )
        })}
        {filteredGames.length === 0 && <p className="text-gray-500 mt-4 text-center">Nenhum jogo encontrado.</p>}
      </div>
    </div>
  )
}