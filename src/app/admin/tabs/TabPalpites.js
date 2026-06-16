'use client'
import { useState } from 'react'

export default function TabPalpites({ allProfiles, games }) {
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedGame, setSelectedGame] = useState('')
  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [overrideTime, setOverrideTime] = useState(false)
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Organiza os usuários por ordem alfabética para facilitar a busca
  const sortedProfiles = [...(allProfiles || [])].sort((a, b) => {
    const nameA = a.nickname || a.email || ''
    const nameB = b.nickname || b.email || ''
    return nameA.localeCompare(nameB)
  })

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
    <div className="max-w-2xl bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700">
      <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
        💉 Injetar Palpite Manual
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Seleção de Usuário */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Participante</label>
          <select 
            required 
            className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
            value={selectedUser} 
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">Selecione um participante...</option>
            {sortedProfiles.map(u => (
              <option key={u.id} value={u.id}>
                {u.nickname || u.email}
              </option>
            ))}
          </select>
        </div>

        {/* Seleção de Jogo */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Partida</label>
          <select 
            required 
            className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
            value={selectedGame} 
            onChange={(e) => setSelectedGame(e.target.value)}
          >
            <option value="">Selecione o confronto...</option>
            {games?.map(g => (
              <option key={g.id} value={g.id}>
                ID {g.id}: {g.team_a?.name || 'A definir'} x {g.team_b?.name || 'A definir'}
              </option>
            ))}
          </select>
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
  )
}