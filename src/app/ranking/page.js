'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

// Mapeamento de títulos para exibir bonito no modal
const RULE_LABELS = {
  champion: '🏆 Campeão',
  vice: '🥈 Vice-Campeão',
  third: '🥉 Terceiro Lugar',
  fourth: '🏅 Quarto Lugar',
  top_scorer: '⚽ Artilheiro'
}

export default function Ranking() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // NAVEGAÇÃO
  const [competitions, setCompetitions] = useState([])
  const [selectedCompId, setSelectedCompId] = useState(null)
  
  // FILTRO
  const [rounds, setRounds] = useState([])
  const [selectedRound, setSelectedRound] = useState('Geral')

  // MODAL DE DETALHES
  const [selectedUser, setSelectedUser] = useState(null)
  const [userBets, setUserBets] = useState([]) // Palpites de Jogos
  const [userSpecialBets, setUserSpecialBets] = useState([]) // Palpites Extras
  const [loadingBets, setLoadingBets] = useState(false)
  const [modalTab, setModalTab] = useState('games') // 'games' ou 'extras'

  // 1. INICIALIZAÇÃO
  useEffect(() => {
    async function init() {
      const { data: comps } = await supabase
        .from('competitions')
        .select('*')
        .eq('is_active', true)
        .order('id')

      if (comps && comps.length > 0) {
        setCompetitions(comps)
        setSelectedCompId(comps[0].id)
      } else {
        setLoading(false)
      }
    }
    init()
  }, [])

  // 2. MONITORAMENTO DE MUDANÇAS
  useEffect(() => {
    if (!selectedCompId) return
    fetchData()
  }, [selectedCompId, selectedRound])

  // 3. REALTIME
  useEffect(() => {
    const channel = supabase
      .channel('realtime_ranking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => {
        console.log('⚡ Atualização de pontos detectada!')
        fetchData()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedCompId, selectedRound])

  // --- FUNÇÃO PRINCIPAL DE BUSCA ---
  const fetchData = async () => {
    setLoading(true)
    
    // A. Busca Rodadas disponíveis (Se estiver no modo Geral, atualiza o dropdown)
    if (selectedRound === 'Geral') {
        const { data: games } = await supabase
            .from('games')
            .select('round')
            .eq('competition_id', selectedCompId)
            .neq('round', null)
        
        if (games) {
            const uniqueRounds = [...new Set(games.map(g => g.round))].sort()
            setRounds(uniqueRounds)
        }
    }

    if (selectedRound === 'Geral') {
        // --- MODO GERAL (Usa a View do Banco - Já soma Extras + Jogos) ---
        const { data, error } = await supabase
            .from('leaderboard')
            .select('*')
            .eq('competition_id', selectedCompId)
            .order('total_pontos', { ascending: false })
            .order('qtd_cv', { ascending: false })
            .order('qtd_vsg', { ascending: false })
        
        if (!error) setUsers(data || [])
        setLoading(false)

    } else {
        // --- MODO RODADA ESPECÍFICA (Cálculo Manual) ---
        
        // 1. Busca inscritos da competição
        const { data: enrolledUsers } = await supabase
            .from('enrollments')
            .select('user_id, profiles(nickname, full_name, email, avatar_url)')
            .eq('competition_id', selectedCompId)

        if (!enrolledUsers || enrolledUsers.length === 0) {
            setUsers([])
            setLoading(false)
            return
        }

        // 2. Busca apostas APENAS dessa rodada
        // Precisamos do placar do jogo também para calcular os critérios CV/VSG/AV
        const { data: bets } = await supabase
            .from('bets')
            .select(`
                points_awarded, 
                user_id, 
                guess_score_a, 
                guess_score_b,
                game:games!inner(competition_id, round, score_a, score_b)
            `)
            .eq('game.competition_id', selectedCompId)
            .eq('game.round', selectedRound)
            .not('points_awarded', 'is', null)

        // 3. Calcula os pontos na memória
        const stats = {}
        bets?.forEach(bet => {
            const uid = bet.user_id
            if (!stats[uid]) stats[uid] = { total: 0, cv: 0, vsg: 0, av: 0 }
            
            stats[uid].total += (bet.points_awarded || 0)
            
            // Lógica de Critérios baseada no PLACAR (igual ao SQL)
            const pA = bet.guess_score_a
            const pB = bet.guess_score_b
            const rA = bet.game.score_a
            const rB = bet.game.score_b

            if (pA !== null && rA !== null) {
                // Cravada (CV)
                if (pA === rA && pB === rB) {
                    stats[uid].cv++ 
                } 
                // Acertou Vencedor/Empate
                else if (Math.sign(pA - pB) === Math.sign(rA - rB)) {
                    // Vitória + Saldo (VSG)
                    if (pA === rA || pB === rB || (pA - pB) === (rA - rB)) {
                        stats[uid].vsg++
                    } else {
                        // Apenas Vitória (AV)
                        stats[uid].av++
                    }
                }
            }
        })

        // 4. Monta a lista final mesclando Inscritos + Pontos
        const rankingRodada = enrolledUsers.map(enroll => {
            const uid = enroll.user_id
            const p = enroll.profiles || {}
            return {
                user_id: uid,
                nome_exibicao: p.nickname || p.full_name || p.email || 'Anônimo',
                avatar_url: p.avatar_url,
                total_pontos: stats[uid]?.total || 0,
                qtd_cv: stats[uid]?.cv || 0,
                qtd_vsg: stats[uid]?.vsg || 0,
                qtd_av: stats[uid]?.av || 0,
                is_paid: true 
            }
        })

        // 5. Ordena (Pontos > CV > VSG)
        rankingRodada.sort((a, b) => 
            b.total_pontos - a.total_pontos || 
            b.qtd_cv - a.qtd_cv || 
            b.qtd_vsg - a.qtd_vsg
        )
        
        setUsers(rankingRodada)
        setLoading(false)
    }
  }

  // --- MODAL DE DETALHES ---
  const handleUserClick = async (user) => {
    setSelectedUser(user)
    setLoadingBets(true)
    setModalTab('games') 
    setUserBets([])
    setUserSpecialBets([])

    const agora = new Date()

    try {
        // 1. Busca Palpites de JOGOS (Passados)
        const { data: gamesData } = await supabase
          .from('bets')
          .select(`
            guess_score_a, guess_score_b, points_awarded,
            game:games!inner(
              competition_id, round, start_time, score_a, score_b,
              team_a:teams!team_a_id(name, badge_url, flag_code),
              team_b:teams!team_b_id(name, badge_url, flag_code)
            )
          `)
          .eq('user_id', user.user_id)
          .eq('game.competition_id', selectedCompId)
          .lt('game.start_time', agora.toISOString()) 
          .order('game(start_time)', { ascending: false })
        
        setUserBets(gamesData || [])

        // 2. Busca Palpites EXTRAS
        // Busca manual para evitar problemas de join
        const { data: rawSpecialBets } = await supabase
            .from('special_bets')
            .select(`
                picked_value,
                points_awarded,
                picked_team_id,
                special_rule_id
            `)
            .eq('user_id', user.user_id)

        if (rawSpecialBets && rawSpecialBets.length > 0) {
            // Busca as regras para filtrar
            const ruleIds = rawSpecialBets.map(b => b.special_rule_id)
            const { data: rules } = await supabase
                .from('special_rules')
                .select('*')
                .in('id', ruleIds)
                .eq('competition_id', selectedCompId)

            // Busca os times citados
            const teamIds = rawSpecialBets.map(b => b.picked_team_id).filter(Boolean)
            let teamsMap = {}
            if (teamIds.length > 0) {
                const { data: teamsData } = await supabase.from('teams').select('id, name, badge_url').in('id', teamIds)
                teamsData?.forEach(t => teamsMap[t.id] = t)
            }

            const rulesMap = {}
            rules?.forEach(r => rulesMap[r.id] = r)

            // Filtra e monta objeto final
            const visibleSpecials = rawSpecialBets.map(bet => {
                const rule = rulesMap[bet.special_rule_id]
                if (!rule) return null // Regra não é dessa competição

                // Regra de Ouro: Só mostra se prazo passou (evita cola)
                if (!rule.deadline) return null 
                const deadline = new Date(rule.deadline)
                if (agora <= deadline) return null 

                return {
                    picked_value: bet.picked_value,
                    points_awarded: bet.points_awarded,
                    picked_team: teamsMap[bet.picked_team_id],
                    rule: rule
                }
            }).filter(Boolean)

            setUserSpecialBets(visibleSpecials)
        }

    } catch (e) {
        console.error("Erro ao carregar detalhes:", e)
    } finally {
        setLoadingBets(false)
    }
  }

  const filteredUsers = users.filter(user => 
    (user.nome_exibicao || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <main className="min-h-screen bg-gray-900 text-white p-2 md:p-4 flex flex-col items-center">
      
      <div className="flex flex-col items-center mb-6 mt-4 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-yellow-400">🏆 Classificação</h1>
        <p className="text-xs text-green-400 animate-pulse mt-1">● Atualização em Tempo Real</p>
      </div>

      <div className="w-full max-w-3xl mb-4 overflow-x-auto no-scrollbar">
        <div className="flex justify-center space-x-2 pb-2 min-w-max">
          {competitions.map(comp => (
            <button
              key={comp.id}
              onClick={() => { setSelectedCompId(comp.id); setSelectedRound('Geral'); }}
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

      <div className="w-full max-w-3xl flex flex-col md:flex-row gap-3 mb-4">
        <select 
            className="p-3 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-yellow-500 font-bold"
            value={selectedRound}
            onChange={(e) => setSelectedRound(e.target.value)}
        >
            <option value="Geral">🌍 Classificação Geral</option>
            {rounds.map(r => <option key={r} value={r}>📍 {r}</option>)}
        </select>

        <input 
          type="text" 
          placeholder="🔍 Buscar participante..." 
          className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:border-yellow-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="w-full max-w-3xl bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-700 text-gray-300 text-xs uppercase tracking-wider">
              <th className="p-3 text-center">#</th>
              <th className="p-3">Participante</th>
              <th className="p-3 text-center text-yellow-400" title="Cravada (Placar Exato)">CV</th>
              <th className="p-3 text-center text-blue-400" title="Vitória+Saldo/Gols">VSG</th>
              <th className="p-3 text-center text-green-400" title="Apenas Vitória">AV</th>
              <th className="p-3 text-center font-bold text-white text-lg">Pts</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-8 text-center text-gray-400">Carregando classificação...</td></tr>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user, index) => (
                <tr 
                  key={user.user_id} 
                  onClick={() => handleUserClick(user)}
                  className={`border-b border-gray-700 cursor-pointer hover:bg-gray-700/80 transition active:bg-gray-600 ${index < 3 && !searchTerm && selectedRound === 'Geral' ? 'bg-gray-700/20' : ''}`}
                >
                  <td className="p-3 text-center font-bold text-lg text-gray-400">
                    {index + 1}º
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-600 overflow-hidden flex-shrink-0 border border-gray-500 relative">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover"/>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs">👤</div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-gray-200">{user.nome_exibicao || 'Anônimo'}</span>
                        <span className="text-[10px] text-gray-500 md:hidden">Toque para ver histórico</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center font-mono text-yellow-200/80">{user.qtd_cv}</td>
                  <td className="p-3 text-center font-mono text-blue-200/80">{user.qtd_vsg}</td>
                  <td className="p-3 text-center font-mono text-green-200/80">{user.qtd_av}</td>
                  <td className="p-3 text-center font-bold text-yellow-400 text-xl">{user.total_pontos}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-500">
                  {users.length === 0 ? "Nenhum participante inscrito nesta competição." : "Nenhum participante encontrado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* LEGENDA NO RODAPÉ */}
      <div className="w-full max-w-3xl mt-4 px-2 text-[10px] text-gray-500 flex flex-wrap gap-4 justify-center">
         <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-400 rounded-full"></span> <b>CV:</b> Cravada (Placar Exato)</span>
         <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded-full"></span> <b>VSG:</b> Vitória + Saldo/Gols</span>
         <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full"></span> <b>AV:</b> Apenas Vitória</span>
      </div>

      {/* --- MODAL DE DETALHES --- */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <div className="bg-gray-800 w-full max-w-md max-h-[85vh] rounded-2xl border border-gray-600 shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {/* CABEÇALHO MODAL */}
            <div className="p-4 bg-gray-700 flex justify-between items-center border-b border-gray-600">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-600 overflow-hidden border border-gray-400 relative">
                   {selectedUser.avatar_url && <img src={selectedUser.avatar_url} className="w-full h-full object-cover"/>}
                </div>
                <div>
                  <h3 className="font-bold text-white">{selectedUser.nome_exibicao || 'Anônimo'}</h3>
                  <p className="text-xs text-gray-400">
                    {selectedRound === 'Geral' ? 'Histórico Completo' : selectedRound}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>

            {/* ABAS DENTRO DO MODAL */}
            <div className="flex border-b border-gray-600 bg-gray-800">
                <button 
                    className={`flex-1 py-3 text-sm font-bold transition ${modalTab === 'games' ? 'text-yellow-400 border-b-2 border-yellow-400 bg-gray-700/50' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setModalTab('games')}
                >
                    ⚽ Jogos ({userBets.length})
                </button>
                <button 
                    className={`flex-1 py-3 text-sm font-bold transition ${modalTab === 'extras' ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-700/50' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setModalTab('extras')}
                >
                    🏆 Extras ({userSpecialBets.length})
                </button>
            </div>

            {/* CONTEÚDO SCROLLÁVEL */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-900/30">
              {loadingBets ? (
                <div className="text-center py-8 text-gray-500">Carregando palpites...</div>
              ) : (
                <>
                  {/* LISTA DE JOGOS */}
                  {modalTab === 'games' && (
                    userBets.length > 0 ? userBets.map((bet, idx) => (
                      <div key={idx} className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-bold text-gray-300 w-8 text-right truncate">{bet.game.team_a.name.slice(0,3).toUpperCase()}</span>
                          <span className="text-yellow-400 font-mono text-lg font-bold">{bet.guess_score_a}</span>
                          <span className="text-gray-600">x</span>
                          <span className="text-yellow-400 font-mono text-lg font-bold">{bet.guess_score_b}</span>
                          <span className="font-bold text-gray-300 w-8 truncate">{bet.game.team_b.name.slice(0,3).toUpperCase()}</span>
                        </div>
                        <div className="text-right">
                          {bet.points_awarded !== null ? (
                            <span className={`text-xs font-bold px-2 py-1 rounded 
                              ${bet.points_awarded === 10 ? 'bg-yellow-500 text-black' : 
                                bet.points_awarded >= 5 ? 'bg-green-600 text-white' : 
                                'bg-red-900/50 text-red-200'}
                            `}>
                              +{bet.points_awarded} pts
                            </span>
                          ) : <span className="text-xs text-gray-500">...</span>}
                          <div className="text-[9px] text-gray-600 mt-1">{bet.game.score_a}x{bet.game.score_b}</div>
                        </div>
                      </div>
                    )) : <div className="text-center py-8 text-gray-500 text-sm">Nenhum palpite visível (jogos futuros são ocultos).</div>
                  )}

                  {/* LISTA DE EXTRAS */}
                  {modalTab === 'extras' && (
                    userSpecialBets.length > 0 ? userSpecialBets.map((sBet, idx) => (
                      <div key={idx} className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center shadow-sm">
                        <div>
                            <div className="text-[10px] text-purple-400 uppercase font-bold tracking-wide">
                                {RULE_LABELS[sBet.rule.type] || sBet.rule.label || sBet.rule.type}
                            </div>
                            <div className="font-bold text-white text-sm mt-1 flex items-center gap-2">
                                {sBet.picked_team && (
                                    <img src={sBet.picked_team.badge_url} className="w-5 h-5 object-contain" />
                                )}
                                {sBet.picked_team?.name || sBet.picked_value}
                            </div>
                        </div>
                        
                        <div className="text-right">
                           {sBet.points_awarded && sBet.points_awarded > 0 ? (
                                <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-500 text-black shadow-lg">
                                    +{sBet.points_awarded} pts
                                </span>
                           ) : (
                               <span className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">
                                   Valendo {sBet.rule.points}
                               </span>
                           )}
                        </div>
                      </div>
                    )) : <div className="text-center py-8 text-gray-500 text-sm">
                        Nenhum palpite extra visível (ou prazo ainda não venceu).
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="p-3 bg-gray-700/50 text-center border-t border-gray-700">
              <button onClick={() => setSelectedUser(null)} className="text-sm text-blue-300 hover:text-white">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}