'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'
import GameCard from '../components/GameCard'
import toast from 'react-hot-toast'

// Títulos traduzidos para os tipos de regra
const RULE_TITLES = {
  champion: '🏆 Campeão',
  vice: '🥈 Vice-Campeão',
  third: '🥉 Terceiro Lugar',
  fourth: '🏅 Quarto Lugar',
  top_scorer: '⚽ Artilheiro'
}

// Componente simples para selecionar Time (Campeão, Vice, etc)
const TeamSelect = ({ teams, value, onChange, placeholder, disabled }) => (
  <select 
    className={`w-full p-3 rounded border outline-none transition
      ${disabled 
        ? 'bg-gray-900 border-gray-700 text-gray-500 cursor-not-allowed' 
        : 'bg-gray-700 border-gray-600 text-white focus:border-yellow-400'}
    `}
    value={value || ''}
    onChange={e => onChange(e.target.value)}
    disabled={disabled}
  >
    <option value="">{placeholder}</option>
    {teams.map(t => (
      <option key={t.id} value={t.id}>{t.name}</option>
    ))}
  </select>
)

// Componente Inteligente para Palpites Especiais (Com Trava de Prazo)
const SpecialBetCard = ({ rule, bet, teams, onUpdate }) => {
  // Estado para Artilheiro (Filtro de Time)
  const [filterTeamId, setFilterTeamId] = useState('')
  const [players, setPlayers] = useState([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  
  // VERIFICA SE O PRAZO JÁ PASSOU
  const deadlineDate = rule.deadline ? new Date(rule.deadline) : null
  const isExpired = deadlineDate && new Date() > deadlineDate

  const hasBet = !!(bet?.value || bet?.teamId)
  
  // Se expirou, força modo leitura (isEditing = false)
  // Se não expirou e não tem aposta, começa aberto. Se tem aposta, começa fechado.
  const [isEditing, setIsEditing] = useState(!hasBet && !isExpired)

  // Garante que feche se o tempo passar com a tela aberta
  useEffect(() => {
    if (isExpired) setIsEditing(false)
  }, [isExpired])

  // Carrega jogadores quando seleciona um time no filtro do artilheiro
  useEffect(() => {
    if (rule.type === 'top_scorer' && filterTeamId) {
      async function fetchPlayers() {
        setLoadingPlayers(true)
        const { data } = await supabase.from('players').select('*').eq('team_id', filterTeamId).order('name')
        setPlayers(data || [])
        setLoadingPlayers(false)
      }
      fetchPlayers()
    } else {
      setPlayers([])
    }
  }, [filterTeamId, rule.type])

  const title = RULE_TITLES[rule.type] || rule.label || rule.type
  
  // Formata data para exibir (ajuste de fuso horário simples para exibição)
  const deadlineText = deadlineDate 
    ? deadlineDate.toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) 
    : ''

  return (
    <div className={`p-5 rounded-xl border shadow-lg transition-all relative
      ${isExpired ? 'bg-gray-900/80 border-red-900/30 opacity-75' : (!isEditing ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-800 border-gray-600')}
    `}>
      <div className="flex justify-between items-center mb-3">
          <div>
              <h3 className="font-bold text-lg text-white">{title}</h3>
              {deadlineText && (
                  <p className={`text-[10px] uppercase font-bold mt-1 ${isExpired ? 'text-red-500' : 'text-green-400'}`}>
                      {isExpired ? `Encerrado em ${deadlineText}` : `Fecha em ${deadlineText}`}
                  </p>
              )}
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded border border-yellow-500/30">
                {rule.points} pts
            </span>
            
            {/* BOTÃO: Só permite editar se NÃO EXPIRADO */}
            {!isEditing && !isExpired && (
              <button 
                onClick={() => setIsEditing(true)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full text-white transition shadow"
                title="Editar Palpite"
              >
                ✏️
              </button>
            )}
            
            {/* Ícone de Cadeado se Expirado */}
            {isExpired && (
                <span className="text-xl" title="Apostas Encerradas">🔒</span>
            )}
          </div>
      </div>
      
      {/* SELETOR DE ARTILHEIRO */}
      {rule.type === 'top_scorer' ? (
        <div className="space-y-3">
           {/* 1. Filtra Time */}
           <select 
             className={`w-full p-3 rounded border outline-none text-sm transition
               ${!isEditing 
                 ? 'bg-gray-900 border-gray-700 text-gray-500 cursor-not-allowed' 
                 : 'bg-gray-900 border-gray-600 text-gray-300 focus:border-blue-400'}
             `}
             value={filterTeamId}
             onChange={e => setFilterTeamId(e.target.value)}
             disabled={!isEditing}
           >
             <option value="">1º Selecione o Time...</option>
             {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
           </select>

           {/* 2. Seleciona Jogador */}
           <select 
             className={`w-full p-3 rounded border outline-none transition
               ${!isEditing 
                 ? 'bg-gray-900 border-gray-700 text-gray-400 cursor-not-allowed font-bold' 
                 : 'bg-gray-700 border-gray-600 text-white focus:border-yellow-400'}
             `}
             value={bet?.value || ''}
             onChange={e => onUpdate(rule.id, 'value', e.target.value)}
             disabled={!isEditing || (!filterTeamId && !bet?.value)} 
           >
             <option value="">{loadingPlayers ? 'Carregando...' : '2º Selecione o Jogador...'}</option>
             {/* Mostra valor salvo mesmo sem lista carregada */}
             {bet?.value && !players.find(p => p.name === bet.value) && <option value={bet.value}>{bet.value}</option>}
             {players.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
           </select>
        </div>
      ) : (
        // SELETOR PADRÃO
        <TeamSelect 
            teams={teams} 
            placeholder="Selecione o Time..." 
            value={bet?.teamId} 
            onChange={val => onUpdate(rule.id, 'teamId', val)}
            disabled={!isEditing}
        />
      )}
    </div>
  )
}

export default function Home() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // NAVEGAÇÃO
  const [competitions, setCompetitions] = useState([])
  const [selectedCompId, setSelectedCompId] = useState(null)
  const [activeTab, setActiveTab] = useState('games') 
  
  // DADOS DE JOGOS
  const [rounds, setRounds] = useState([])
  const [selectedRound, setSelectedRound] = useState('')
  const [games, setGames] = useState([])
  const [gamePredictions, setGamePredictions] = useState({}) 

  // DADOS DE EXTRAS
  const [teams, setTeams] = useState([])
  const [competitionTeams, setCompetitionTeams] = useState([]) 
  const [specialRules, setSpecialRules] = useState([])
  const [specialBets, setSpecialBets] = useState({}) 

  const [isPaid, setIsPaid] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // 1. INICIALIZAÇÃO
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)

      // Busca competições ativas
      const { data: comps } = await supabase.from('competitions').select('*').eq('is_active', true).order('id')
      
      // Busca todos os times (para o select de campeão)
      const { data: allTeams } = await supabase.from('teams').select('*').order('name')
      setTeams(allTeams || [])

      if (comps && comps.length > 0) {
        setCompetitions(comps)
        setSelectedCompId(comps[0].id)
      } else {
        setLoading(false)
      }
    }
    init()
  }, [])

  // 2. CARREGA DADOS DA COMPETIÇÃO
  useEffect(() => {
    if (!selectedCompId) return
    loadCompetitionData()
  }, [selectedCompId, session, teams])

  async function loadCompetitionData() {
    setLoading(true)
    
    // A. Verifica Pagamento
    if (session) {
      const { data: enroll } = await supabase.from('enrollments').select('is_paid').eq('user_id', session.user.id).eq('competition_id', selectedCompId).single()
      setIsPaid(enroll?.is_paid || false)
    }

    // B. Filtra Times da Competição
    const { data: compGames } = await supabase
        .from('games')
        .select('team_a_id, team_b_id')
        .eq('competition_id', selectedCompId)
    
    if (compGames && teams.length > 0) {
        const teamIds = new Set()
        compGames.forEach(g => {
            teamIds.add(g.team_a_id)
            teamIds.add(g.team_b_id)
        })
        const filtered = teams.filter(t => teamIds.has(t.id))
        setCompetitionTeams(filtered)
    } else {
        setCompetitionTeams(teams)
    }

    const agora = new Date().toISOString()

    // C. Busca Jogos Futuros
    const { data: allGames } = await supabase
      .from('games')
      .select(`*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)`)
      .eq('competition_id', selectedCompId)
      .eq('is_finished', false)
      .gt('start_time', agora)
      .order('start_time', { ascending: true })

    if (allGames) {
      // Organiza Rodadas
      const uniqueRounds = [...new Set(allGames.map(g => g.round))].filter(Boolean)
      setRounds(uniqueRounds)
      
      // Define rodada inicial (a primeira disponível)
      const currentRound = uniqueRounds.length > 0 ? uniqueRounds[0] : ''
      setSelectedRound(currentRound)
      
      // Filtra jogos e carrega palpites
      filterAndLoadGames(allGames, currentRound)
    }

    // D. Busca Regras Especiais (Extras)
    const { data: rules } = await supabase
      .from('special_rules')
      .select('*')
      .eq('competition_id', selectedCompId)
      .eq('is_active', true)
    
    setSpecialRules(rules || [])
    
    if (session && rules?.length > 0) {
      const { data: sBets } = await supabase.from('special_bets').select('*').eq('user_id', session.user.id).in('special_rule_id', rules.map(r => r.id))
      const sBetsMap = {}
      sBets?.forEach(b => sBetsMap[b.special_rule_id] = { teamId: b.picked_team_id, value: b.picked_value })
      setSpecialBets(sBetsMap)
    }

    setLoading(false)
  }

  // 3. FILTRA JOGOS POR RODADA
  const filterAndLoadGames = async (allGamesSource, round) => {
    const filtered = round 
      ? allGamesSource.filter(g => g.round === round)
      : allGamesSource

    setGames(filtered)

    if (session && filtered.length > 0) {
      const { data: bets } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', session.user.id)
        .in('game_id', filtered.map(g => g.id))

      const preds = {}
      filtered.forEach(g => {
        const bet = bets?.find(b => b.game_id === g.id)
        preds[g.id] = {
          scoreA: bet ? bet.guess_score_a : '',
          scoreB: bet ? bet.guess_score_b : '',
          isEditing: !bet
        }
      })
      setGamePredictions(preds)
    }
  }

  // Efeito ao trocar rodada manual
  useEffect(() => {
    if (!selectedCompId || !selectedRound) return
    const fetchAgain = async () => {
       const agora = new Date().toISOString()
       const { data } = await supabase.from('games').select(`*, team_a:teams!team_a_id(*), team_b:teams!team_b_id(*)`).eq('competition_id', selectedCompId).eq('is_finished', false).gt('start_time', agora).order('start_time', { ascending: true })
       filterAndLoadGames(data || [], selectedRound)
    }
    fetchAgain()
  }, [selectedRound])


  // --- HANDLERS JOGOS ---
  const handleGameChange = (gameId, field, value) => {
    setGamePredictions(prev => ({ ...prev, [gameId]: { ...prev[gameId], [field]: value } }))
    setHasChanges(true)
  }
  const toggleEdit = (gameId) => {
    setGamePredictions(prev => ({ ...prev, [gameId]: { ...prev[gameId], isEditing: !prev[gameId].isEditing } }))
  }

  // --- HANDLERS EXTRAS ---
  const handleSpecialChange = (ruleId, field, value) => {
    setSpecialBets(prev => ({ ...prev, [ruleId]: { ...prev[ruleId], [field]: value } }))
    setHasChanges(true)
  }

  // --- SALVAR TUDO ---
  const handleSave = async () => {
    if (!session) return toast.error('Faça login!')
    setSaving(true)

    try {
      // 1. Salva Jogos
      if (activeTab === 'games') {
        const updates = []
        games.forEach(g => {
          const p = gamePredictions[g.id]
          if (p && p.scoreA !== '' && p.scoreB !== '') {
            updates.push({ user_id: session.user.id, game_id: g.id, guess_score_a: p.scoreA, guess_score_b: p.scoreB })
          }
        })
        if (updates.length > 0) {
          await supabase.from('bets').upsert(updates, { onConflict: 'user_id, game_id' })
          toast.success('Jogos salvos com sucesso!')
          setGamePredictions(prev => {
            const next = {...prev}
            updates.forEach(u => next[u.game_id].isEditing = false)
            return next
          })
        }
      }

      // 2. Salva Extras
      if (activeTab === 'specials') {
        const specialUpdates = []
        const agora = new Date()
        
        specialRules.forEach(r => {
          // Bloqueia salvamento se prazo expirou (Segurança Extra no Front)
          if (r.deadline && new Date(r.deadline) < agora) return

          const sb = specialBets[r.id]
          if (sb && (sb.teamId || sb.value)) {
            specialUpdates.push({
              user_id: session.user.id,
              special_rule_id: r.id,
              picked_team_id: sb.teamId || null,
              picked_value: sb.value || null
            })
          }
        })
        
        if (specialUpdates.length > 0) {
          await supabase.from('special_bets').upsert(specialUpdates, { onConflict: 'user_id, special_rule_id' })
          toast.success('Palpites extras salvos!')
          loadCompetitionData() 
        } else if (Object.keys(specialBets).length > 0) {
           toast.error('O prazo para alguns palpites já encerrou.')
        }
      }
      setHasChanges(false)
    } catch (e) {
      toast.error('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-white text-center p-10">Carregando...</div>

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-900 text-white p-4 pb-32">
      
      {/* 1. SELETOR DE COMPETIÇÃO (ABAS) */}
      <div className="w-full max-w-md mb-4 overflow-x-auto no-scrollbar">
        <div className="flex space-x-2 pb-2">
          {competitions.map(comp => (
            <button
              key={comp.id}
              onClick={() => setSelectedCompId(comp.id)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all border
                ${selectedCompId === comp.id 
                  ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg scale-105' 
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'}
              `}
            >
              {comp.name}
            </button>
          ))}
        </div>
      </div>

      {session && (
        <div className="w-full max-w-md mb-6">
           {/* Status */}
           {!isPaid ? (
            <div className="bg-red-900/30 border border-red-500/50 p-3 rounded-lg mb-4 flex justify-between items-center animate-pulse">
              <span className="text-red-200 text-xs font-bold">⚠️ Inscrição Pendente</span>
              <Link href="/perfil" className="bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-3 rounded text-xs">Resolver</Link>
            </div>
          ) : (
            <div className="bg-green-900/20 border border-green-500/30 p-2 rounded-lg text-center mb-4">
              <p className="text-green-400 text-xs font-bold">✅ Você está participando!</p>
            </div>
          )}

          {/* Seletor de Modo */}
          <div className="flex bg-gray-800 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('games')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'games' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
            >
              ⚽ Jogos
            </button>
            <button 
              onClick={() => setActiveTab('specials')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'specials' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
            >
              🏆 Extras
            </button>
          </div>
        </div>
      )}

      {/* --- CONTEÚDO: JOGOS --- */}
      {activeTab === 'games' && (
        <>
            {rounds.length > 0 && (
                <div className="w-full max-w-md mb-6 flex items-center gap-2 overflow-x-auto pb-2 border-b border-gray-800 no-scrollbar">
                {rounds.map(round => (
                    <button key={round} onClick={() => setSelectedRound(round)} className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap transition ${selectedRound === round ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-white'}`}>
                        {round}
                    </button>
                ))}
                </div>
            )}

            <div className="w-full max-w-md flex flex-col gap-4">
                {games.length > 0 ? (
                games.map(game => (
                    <GameCard 
                    key={game.id} 
                    game={game} 
                    values={gamePredictions[game.id]}
                    isEditing={gamePredictions[game.id]?.isEditing}
                    onChange={handleGameChange}
                    onToggleEdit={toggleEdit}
                    />
                ))
                ) : (
                <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed text-gray-500">
                    <div className="text-4xl mb-2">⚽</div>
                    Nenhum jogo aberto nesta fase.
                </div>
                )}
            </div>
        </>
      )}

      {/* --- CONTEÚDO: EXTRAS --- */}
      {activeTab === 'specials' && (
        <div className="w-full max-w-md space-y-4">
            {specialRules.length > 0 ? (
                specialRules.map(rule => (
                    <SpecialBetCard 
                      key={rule.id}
                      rule={rule}
                      bet={specialBets[rule.id]}
                      teams={competitionTeams} 
                      onUpdate={handleSpecialChange}
                    />
                ))
            ) : (
                <div className="text-center py-12 text-gray-500">Nenhum palpite extra configurado.</div>
            )}
        </div>
      )}

      {/* BOTÃO FLUTUANTE */}
      {session && hasChanges && (
        <div className="fixed bottom-6 left-0 w-full flex justify-center px-4 z-40">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full max-w-md bg-green-600 hover:bg-green-500 text-white shadow-2xl shadow-green-900/50 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] animate-bounce-subtle"
          >
            {saving ? 'Salvando...' : '💾 SALVAR PALPITES'}
          </button>
        </div>
      )}
    </main>
  )
}