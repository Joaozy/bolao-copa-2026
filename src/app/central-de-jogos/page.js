'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import GameCard from '../../components/GameCard'
import SponsorBanner from '../../components/SponsorBanner'

// --- DICIONÁRIO DE TRADUÇÃO EXATO DO BANCO DE DADOS ---
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

// --- FUNÇÃO PARA TRADUZIR O NOME DAS FASES NO DROPDOWN ---
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

// --- LÓGICA DE ORDENAÇÃO INTELIGENTE (AO VIVO > TERMINADOS > FUTUROS) ---
const notStartedStatuses = ['NS', 'TBD', 'PST'];

const categorizeGame = (g) => {
  if (g.is_finished) return 2; // 2º Prioridade: Terminados
  const isNotStarted = notStartedStatuses.includes(g.status_short) || (!g.status_short && new Date(g.start_time) > new Date());
  if (!isNotStarted && !g.is_finished) return 1; // 1º Prioridade: Ao Vivo
  return 3; // 3º Prioridade: Futuros
};

const sortGames = (gamesArray) => {
  return [...gamesArray].sort((a, b) => {
    const catA = categorizeGame(a);
    const catB = categorizeGame(b);
    if (catA !== catB) return catA - catB; 
    const timeA = new Date(a.start_time).getTime();
    const timeB = new Date(b.start_time).getTime();
    if (catA === 3) return timeA - timeB;
    return timeB - timeA; 
  });
};

export default function CentralDeJogos() {
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

  // MODAL DE PALPITES
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedGameForModal, setSelectedGameForModal] = useState(null)
  const [gameBets, setGameBets] = useState([])
  const [loadingBets, setLoadingBets] = useState(false)

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

      if (gamesData) {
        const sortedData = sortGames(gamesData)
        setGames(sortedData)
        setFilteredGames(sortedData)
        
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
            // Se o jogo que sofreu update estiver aberto no modal, atualiza os dados dele no modal
            setSelectedGameForModal(currentSelected => {
                if (currentSelected && currentSelected.id === payload.new.id) {
                    return { ...currentSelected, ...payload.new }
                }
                return currentSelected;
            })
            return sortGames(updated)
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

  const formatGameTime = (status, elapsed) => {
      if (status === 'HT') return 'INTERVALO'
      if (status === 'FT' || status === 'AET' || status === 'PEN') return 'FIM'
      if ((status === '1H' || status === '2H' || status === 'ET') && elapsed) return `${elapsed}'`
      return ''
  }

  // --- NOVA FUNÇÃO: ABRIR MODAL DE PALPITES ---
  const abrirModalPalpites = async (game) => {
    setSelectedGameForModal(game);
    setIsModalOpen(true);
    setLoadingBets(true);

    const { data, error } = await supabase
      .from('bets')
      .select(`
        guess_score_a,
        guess_score_b,
        points_awarded,
        profiles (nickname, avatar_url)
      `)
      .eq('game_id', game.id);

    if (error) {
      console.error("ERRO AO BUSCAR PALPITES NO SUPABASE:", error);
    } 

    if (data && !error) {
        const sortedBets = data.sort((a, b) => {
            const hasMatchData = (game.status_short && game.status_short !== 'NS') || (game.score_a !== null && game.score_b !== null);
            let ptsA = a.points_awarded || 0;
            let ptsB = b.points_awarded || 0;
            
            if (hasMatchData && !game.is_finished) {
                ptsA = calcularPontosAoVivo(a.guess_score_a, a.guess_score_b, game.score_a, game.score_b) || 0;
                ptsB = calcularPontosAoVivo(b.guess_score_a, b.guess_score_b, game.score_a, game.score_b) || 0;
            }
            return ptsB - ptsA; 
        });
        setGameBets(sortedBets);
    }
    setLoadingBets(false);
  }

  if (loading && competitions.length === 0) return <div className="text-white text-center p-10">Carregando...</div>

  return (
    <div className="p-4 pb-24 flex flex-col items-center min-h-screen bg-gray-900 text-white relative">
      <h1 className="text-3xl font-bold text-yellow-400 mb-6 mt-4 text-center">📅 Central de Jogos</h1>

      <div className="w-full max-w-4xl mb-4 overflow-x-auto no-scrollbar">
        <div className="flex justify-center space-x-2 pb-2 min-w-max">
          {competitions.map(comp => (
            <button key={comp.id} onClick={() => setSelectedCompId(comp.id)} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all border ${selectedCompId === comp.id ? 'bg-yellow-500 text-black shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{comp.name}</button>
          ))}
        </div>
      </div>
      
      <SponsorBanner />

      <div className="w-full max-w-md flex justify-between items-end mb-4 px-1">
          <h2 className="text-xl font-bold text-gray-300">Jogos</h2>
          <select 
            className="bg-gray-800 border border-gray-600 text-white text-xs p-2 rounded outline-none focus:border-yellow-500 max-w-[180px] font-bold" 
            value={selectedRound} 
            onChange={(e) => setSelectedRound(e.target.value)}
          >
            <option value="Todas">🌍 Todas as Rodadas</option>
            {rounds.map(r => <option key={r} value={r}>📍 {traduzirRodada(r)}</option>)}
          </select>
      </div>
      
      <div className="w-full max-w-md flex flex-col gap-6">
        {filteredGames.map((game) => {
          const palpiteValues = userBetsMap[game.id] || { scoreA: '', scoreB: '' }
          
          const isNotStarted = notStartedStatuses.includes(game.status_short)

          const hasMatchData = !isNotStarted && (
             (game.status_short && game.status_short !== 'NS') || 
             (game.score_a !== null && game.score_b !== null)
          )
          
          const isLive = !game.is_finished && hasMatchData
          const displayScoreA = game.score_a ?? 0
          const displayScoreB = game.score_b ?? 0
          const hasExtraScores = game.score_a_ext !== null || game.score_a_pen !== null;
          
          let livePoints = null
          if (hasMatchData) {
             livePoints = game.is_finished 
                ? (palpiteValues.points_awarded ?? calcularPontosAoVivo(palpiteValues.scoreA, palpiteValues.scoreB, displayScoreA, displayScoreB))
                : calcularPontosAoVivo(palpiteValues.scoreA, palpiteValues.scoreB, displayScoreA, displayScoreB)
          }

          const timeText = isLive ? formatGameTime(game.status_short, game.elapsed) : 'FIM'
          const nomeTraduzidoA = traducoesPaises[game.team_a?.name] || game.team_a?.name || '---'
          const nomeTraduzidoB = traducoesPaises[game.team_b?.name] || game.team_b?.name || '---'

          return (
            <div 
              key={game.id} 
              className="relative flex flex-col items-center cursor-pointer transition-transform hover:scale-[1.02]"
              onClick={() => abrirModalPalpites(game)}
            > 
              <div className="w-full z-10 opacity-95">
                <GameCard 
                  game={{
                    ...game, 
                    team_a: game.team_a ? { ...game.team_a, name: nomeTraduzidoA } : null,
                    team_b: game.team_b ? { ...game.team_b, name: nomeTraduzidoB } : null,
                    score_a: hasMatchData ? displayScoreA : null, 
                    score_b: hasMatchData ? displayScoreB : null,
                    custom_status: isLive ? timeText : null
                  }} 
                  values={palpiteValues} 
                  isEditing={false} onChange={() => {}} onToggleEdit={() => {}}
                />
              </div>

              {/* BLOCO DE INFORMAÇÕES EXTRAS E PONTUAÇÃO */}
              <div className="flex flex-col items-center w-[90%] mx-auto mt-[-12px] z-0 relative">
                
                {/* Placares de Prorrogação e Pênaltis */}
                {hasExtraScores && (
                  <div className="w-full pt-4 pb-1.5 px-2 bg-gray-800/95 border-x border-b border-gray-700 rounded-b-xl flex flex-col items-center text-[10px] font-mono text-gray-400">
                    <span className="text-yellow-500/80 text-[8px] uppercase tracking-widest mb-0.5">Placar Final Real</span>
                    <div className="flex gap-3">
                      {game.score_a_ext !== null && (
                        <span>PRO: {game.score_a_ext} x {game.score_b_ext}</span>
                      )}
                      {game.score_a_pen !== null && (
                        <span className="text-blue-300">PÊN: {game.score_a_pen} x {game.score_b_pen}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Caixa de Pontuação do Usuário */}
                {hasMatchData && livePoints !== null && (
                  <div className={`
                    w-full text-center py-1 px-6 text-[10px] font-bold uppercase tracking-wider shadow-lg border-x border-b transform transition-all
                    ${hasExtraScores ? 'rounded-b-xl border-t-0' : 'pt-4 rounded-b-xl'}
                    ${livePoints === 10 ? 'bg-yellow-600 border-yellow-400 text-white' : 
                      livePoints >= 5 ? 'bg-green-600 border-green-400 text-white' :
                      'bg-red-900 border-red-500 text-red-200'}
                  `}>
                    Sua Pontuação: +{livePoints} pts
                  </div>
                )}
              </div>
              
              {/* Indicador de clique para ver palpites */}
              <div className="absolute top-2 right-2 z-20 bg-gray-800 text-gray-400 text-[10px] px-2 py-1 rounded border border-gray-600 opacity-80">
                  Ver palpites 👁️
              </div>
            </div>
          )
        })}
        {filteredGames.length === 0 && <p className="text-gray-500 mt-4 text-center">Nenhum jogo encontrado.</p>}
      </div>

      {/* --- MODAL DE PALPITES --- */}
      {isModalOpen && selectedGameForModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black bg-opacity-75 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className="bg-gray-800 w-full max-w-md rounded-t-2xl sm:rounded-2xl flex flex-col h-[85vh] sm:h-auto sm:max-h-[85vh] shadow-2xl border-t border-gray-600 sm:border animate-slide-up">
            
            {/* Cabecalho do Modal */}
            <div className="p-4 border-b border-gray-700 relative flex flex-col items-center">
              <div className="w-12 h-1 bg-gray-600 rounded-full mb-3 sm:hidden"></div>
              <button onClick={() => setIsModalOpen(false)} className="absolute right-4 top-4 text-gray-400 hover:text-white font-bold text-xl">&times;</button>
              
              <h3 className="text-gray-400 text-xs font-bold uppercase mb-2">Palpites da Partida</h3>
              
              {/* Placar Real no topo do Modal */}
              <div className="flex items-center gap-3 font-bold text-lg">
                <span className="text-gray-200">{traducoesPaises[selectedGameForModal.team_a?.name] || selectedGameForModal.team_a?.name}</span>
                <span className="bg-gray-900 px-3 py-1 rounded text-yellow-400 flex flex-col items-center border border-gray-700">
                  <span>{(selectedGameForModal.score_a !== null ? selectedGameForModal.score_a : '-')} x {(selectedGameForModal.score_b !== null ? selectedGameForModal.score_b : '-')}</span>
                  {(selectedGameForModal.score_a_ext !== null || selectedGameForModal.score_a_pen !== null) && (
                     <span className="text-[8px] text-gray-500 font-mono font-normal uppercase -mt-1 leading-none">90 Min</span>
                  )}
                </span>
                <span className="text-gray-200">{traducoesPaises[selectedGameForModal.team_b?.name] || selectedGameForModal.team_b?.name}</span>
              </div>
              
              {/* Exibe Prorrogação/Pênaltis no Modal caso tenha */}
              {(selectedGameForModal.score_a_ext !== null || selectedGameForModal.score_a_pen !== null) && (
                <div className="mt-3 flex gap-3 text-[10px] font-mono text-gray-400 bg-gray-900/50 px-3 py-1.5 rounded-full border border-gray-700">
                  {selectedGameForModal.score_a_ext !== null && <span>PRO: {selectedGameForModal.score_a_ext} x {selectedGameForModal.score_b_ext}</span>}
                  {selectedGameForModal.score_a_pen !== null && <span className="text-blue-300">PÊN: {selectedGameForModal.score_a_pen} x {selectedGameForModal.score_b_pen}</span>}
                </div>
              )}

              {(!selectedGameForModal.is_finished && selectedGameForModal.score_a !== null) && (
                <span className="mt-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">AO VIVO</span>
              )}
            </div>

            {/* Lista de Palpites */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
              {loadingBets ? (
                <div className="text-center text-gray-400 py-10">Buscando palpites da galera...</div>
              ) : gameBets.length === 0 ? (
                <div className="text-center text-gray-400 py-10">Ninguém palpitou neste jogo ainda.</div>
              ) : (
                gameBets.map((bet, idx) => {
                  const hasMatchData = (selectedGameForModal.status_short && selectedGameForModal.status_short !== 'NS') || (selectedGameForModal.score_a !== null && selectedGameForModal.score_b !== null);
                  
                  let displayPoints = bet.points_awarded || 0;
                  // Recalcula ao vivo se não acabou
                  if (hasMatchData && !selectedGameForModal.is_finished) {
                     displayPoints = calcularPontosAoVivo(bet.guess_score_a, bet.guess_score_b, selectedGameForModal.score_a, selectedGameForModal.score_b) || 0;
                  }

                  const pointsColor = displayPoints === 10 ? 'text-yellow-400' : displayPoints >= 5 ? 'text-green-400' : 'text-gray-500';

                  return (
                    <div key={idx} className="flex items-center justify-between bg-gray-900 p-3 rounded-lg border border-gray-700">
                      {/* Avatar e Nome */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {bet.profiles?.avatar_url ? (
                          <img src={bet.profiles.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                            {bet.profiles?.nickname?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="text-sm font-semibold text-gray-200 truncate">{bet.profiles?.nickname || 'Sem nome'}</span>
                      </div>

                      {/* Palpite do Usuário */}
                      <div className="flex items-center justify-center px-4">
                         <span className="text-md font-bold tracking-widest text-white">
                           {bet.guess_score_a} <span className="text-gray-500 mx-1">:</span> {bet.guess_score_b}
                         </span>
                      </div>

                      {/* Pontuação */}
                      <div className="w-12 text-right">
                         <div className={`bg-gray-800 rounded px-2 py-1 text-xs font-bold ${pointsColor}`}>
                           {hasMatchData ? displayPoints : '-'}
                         </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            
            {/* Fecha botão mobile */}
            <div className="p-4 border-t border-gray-700 sm:hidden">
                <button onClick={() => setIsModalOpen(false)} className="w-full py-3 bg-gray-700 rounded-lg text-white font-bold hover:bg-gray-600">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}