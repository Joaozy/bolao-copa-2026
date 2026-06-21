'use client'
import { useState } from 'react'

export default function TabPalpites({ allProfiles, games, allBets = [], enrollments = [] }) {
  // Estados da injeção manual
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [overrideTime, setOverrideTime] = useState(false)
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [injectionUserSearch, setInjectionUserSearch] = useState('')

  // Estados da auditoria (Consulta)
  const [auditGame, setAuditGame] = useState('')
  const [auditUser, setAuditUser] = useState('')
  const [auditUserSearch, setAuditUserSearch] = useState('')

  // Organiza os usuários por ordem alfabética
  const sortedProfiles = [...(allProfiles || [])].sort((a, b) => {
    const nameA = a.nickname || a.email || ''
    const nameB = b.nickname || b.email || ''
    return nameA.localeCompare(nameB)
  })

  // ----------------------------------------------------
  // FONTES DE DADOS FILTRADAS POR INSCRIÇÃO E BUSCA
  // ----------------------------------------------------

  // 1. Filtros para o formulário de INJEÇÃO MANUAL
  const chosenInjectionGame = games?.find(g => Number(g.id) === Number(selectedGame))
  const injectionCompetitionId = chosenInjectionGame?.competition_id

  const enrolledProfilesForInjection = sortedProfiles.filter(p => {
    if (!injectionCompetitionId || !enrollments.length) return true // Se não escolheu jogo, mostra todos
    return enrollments.some(e => e.user_id === p.id && Number(e.competition_id) === Number(injectionCompetitionId))
  })

  const filteredProfilesForInjection = enrolledProfilesForInjection.filter(p => {
    const termo = injectionUserSearch.toLowerCase()
    return (p.nickname || '').toLowerCase().includes(termo) || (p.email || '').toLowerCase().includes(termo)
  })

  // 2. Filtros para o formulário de AUDITORIA
  const chosenAuditGame = games?.find(g => Number(g.id) === Number(auditGame))
  const auditCompetitionId = chosenAuditGame?.competition_id

  // Perfis estritamente inscritos na competição do jogo selecionado para auditoria
  const enrolledProfilesForAudit = sortedProfiles.filter(p => {
    if (!auditCompetitionId || !enrollments.length) return true
    return enrollments.some(e => e.user_id === p.id && Number(e.competition_id) === Number(auditCompetitionId))
  })

  // Palpites do jogo auditado (Correção de tipo de dado aplicando Number)
  const betsForAuditGame = allBets.filter(b => Number(b.game_id) === Number(auditGame))
  const usersWhoBetIds = betsForAuditGame.map(b => b.user_id)
  
  // Quem está inscrito mas NÃO palpitou ainda neste jogo
  const missingUsers = enrolledProfilesForAudit.filter(p => !usersWhoBetIds.includes(p.id))

  // Lista de participantes da auditoria filtrados pela digitação
  const filteredProfilesForAudit = enrolledProfilesForAudit.filter(p => {
    const termo = auditUserSearch.toLowerCase()
    return (p.nickname || '').toLowerCase().includes(termo) || (p.email || '').toLowerCase().includes(termo)
  })

  // Palpite do participante específico consultado na auditoria
  const selectedUserBet = auditUser ? betsForAuditGame.find(b => b.user_id === auditUser) : null


  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setStatus('Salvando palpite...')

    try {
      const res = await fetch('/api/admin/force-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser,
          gameId: parseInt(selectedGame),
          scoreA: parseInt(scoreA),
          scoreB: parseInt(scoreB),
          overrideTime: overrideTime
        })
      })

      const data = await res.json()
      
      if (res.ok) {
        setStatus('✅ Palpite injetado com sucesso!')
        setScoreA('')
        setScoreB('')
      } else {
        setStatus(`❌ Erro: ${data.error}`)
      }
    } catch (error) {
      setStatus('❌ Erro de conexão com a API.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* =========================================
          CAIXA 1: INJETAR PALPITE MANUAL
      ========================================= */}
      <div className="max-w-2xl bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
          💉 Injetar Palpite Manual
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seleção de Jogo Primeiro */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">1º Selecione a Partida</label>
            <select 
              required 
              className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              value={selectedGame} 
              onChange={(e) => {
                setSelectedGame(e.target.value)
                setSelectedUser('') // Reseta usuário para evitar misturar competições
              }}
            >
              <option value="">Selecione o confronto...</option>
              {games?.map(g => (
                <option key={g.id} value={g.id}>
                  ID {g.id}: {g.team_a?.name || 'A definir'} x {g.team_b?.name || 'A definir'}
                </option>
              ))}
            </select>
          </div>

          {/* Seleção de Usuário com Busca */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">2º Participante</label>
            
            {/* Campo de digitação para buscar */}
            <input 
              type="text"
              placeholder="🔍 Digite o nome para filtrar..."
              className="w-full p-2 mb-2 bg-gray-950 border border-gray-700 rounded text-sm text-white focus:outline-none focus:border-blue-500"
              value={injectionUserSearch}
              onChange={(e) => setInjectionUserSearch(e.target.value)}
            />

            <select 
              required 
              className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">Selecione um participante...</option>
              {filteredProfilesForInjection.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nickname || u.email} {injectionCompetitionId ? '🏆' : ''}
                </option>
              ))}
            </select>
            {selectedGame && (
              <p className="text-xs text-gray-400 mt-1">Exibindo apenas inscritos nesta competição.</p>
            )}
          </div>

          {/* Placar */}
          <div className="flex gap-4 items-center bg-gray-900 p-4 rounded-md border border-gray-700">
            <div className="flex-1">
              <label className="block text-sm text-center font-medium text-gray-400 mb-2">Mandante</label>
              <input 
                type="number" required min="0"
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-md text-center text-xl font-bold text-white focus:ring-blue-500"
                value={scoreA} onChange={(e) => setScoreA(e.target.value)}
              />
            </div>
            <span className="text-xl font-bold text-gray-500 mt-6">X</span>
            <div className="flex-1">
              <label className="block text-sm text-center font-medium text-gray-400 mb-2">Visitante</label>
              <input 
                type="number" required min="0"
                className="w-full p-3 bg-gray-800 border border-gray-600 rounded-md text-center text-xl font-bold text-white focus:ring-blue-500"
                value={scoreB} onChange={(e) => setScoreB(e.target.value)}
              />
            </div>
          </div>

          {/* Checkbox da Burladinha */}
          <div className="flex items-center p-4 bg-yellow-900/30 rounded border border-yellow-700/50">
            <input 
              type="checkbox" 
              id="override" 
              className="w-5 h-5 text-yellow-500 bg-gray-900 border-gray-600 rounded focus:ring-yellow-500"
              checked={overrideTime} 
              onChange={(e) => setOverrideTime(e.target.checked)}
            />
            <label htmlFor="override" className="ml-3 block text-sm text-yellow-500 font-medium cursor-pointer">
              Ignorar trava de tempo (O jogo já começou / Prazo encerrado)
            </label>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Injetando...' : 'Salvar Palpite no Banco'}
          </button>

          {status && (
            <div className={`p-4 rounded-md text-center font-bold ${status.includes('✅') ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
              {status}
            </div>
          )}
        </form>
      </div>

      {/* =========================================
          CAIXA 2: AUDITORIA DE PALPITES
      ========================================= */}
      <div className="max-w-2xl bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
          🔍 Auditoria de Palpites
        </h2>

        <div className="space-y-6">
          {/* Seleção do Jogo para Auditoria */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Escolha a Partida para auditar</label>
            <select 
              className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              value={auditGame} 
              onChange={(e) => {
                setAuditGame(e.target.value)
                setAuditUser('')
                setAuditUserSearch('')
              }}
            >
              <option value="">Selecione o confronto...</option>
              {games?.map(g => (
                <option key={g.id} value={g.id}>
                  ID {g.id}: {g.team_a?.name || 'A definir'} x {g.team_b?.name || 'A definir'}
                </option>
              ))}
            </select>
          </div>

          {auditGame && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Coluna A: Pesquisa Individual */}
              <div className="bg-gray-900 p-4 rounded-md border border-gray-700">
                <label className="block text-sm font-medium text-gray-300 mb-2">Verificar Participante Inscrito</label>
                
                {/* Filtro de digitação para auditoria */}
                <input 
                  type="text"
                  placeholder="🔍 Digite para buscar..."
                  className="w-full p-2 mb-2 bg-gray-950 border border-gray-700 rounded text-xs text-white focus:outline-none focus:border-blue-500"
                  value={auditUserSearch}
                  onChange={(e) => setAuditUserSearch(e.target.value)}
                />

                <select 
                  className="w-full p-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm mb-4"
                  value={auditUser} 
                  onChange={(e) => setAuditUser(e.target.value)}
                >
                  <option value="">Selecione quem buscar...</option>
                  {filteredProfilesForAudit.map(u => (
                    <option key={u.id} value={u.id}>{u.nickname || u.email}</option>
                  ))}
                </select>

                {auditUser && (
                  <div className="p-4 bg-gray-800 rounded border border-gray-600 text-center">
                    {selectedUserBet ? (
                      <div>
                        <span className="block text-sm text-gray-400 mb-1">Palpite Registrado:</span>
                        <span className="text-2xl font-bold text-green-400">
                          {selectedUserBet.guess_score_a} x {selectedUserBet.guess_score_b}
                        </span>
                      </div>
                    ) : (
                      <span className="text-red-400 font-bold">Sem palpite registrado 🚨</span>
                    )}
                  </div>
                )}
              </div>

              {/* Coluna B: Lista de Inadimplentes */}
              <div className="bg-gray-900 p-4 rounded-md border border-gray-700 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-300">Faltam Palpitar (Inscritos)</label>
                  <span className="bg-red-900/80 text-red-300 text-xs px-2 py-1 rounded font-bold">
                    {missingUsers.length} pendentes
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-48 pr-2">
                  {missingUsers.length > 0 ? (
                    <ul className="space-y-2">
                      {missingUsers.map(u => (
                        <li key={u.id} className="text-sm text-gray-400 border-b border-gray-800 pb-1">
                          <span>{u.nickname || u.email}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="h-full flex items-center justify-center py-4">
                      <span className="text-green-400 text-sm font-bold text-center">Todos os inscritos já palpitaram! 🎉</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}