'use client'
import { useState } from 'react'

export default function TabImport({ competitions, fetchAllData }) {
  const [importing, setImporting] = useState(false)
  const [fetchingRounds, setFetchingRounds] = useState(false)
  const [availableRounds, setAvailableRounds] = useState([])
  const [importForm, setImportForm] = useState({ leagueId: '71', season: '2025', round: '', competitionId: '', resetData: false })
  const [importPlayerTeamId, setImportPlayerTeamId] = useState('')

  const handleFetchRounds = async () => {
    setFetchingRounds(true)
    try {
        const r = await fetch(`/api/admin/fetch-rounds?leagueId=${importForm.leagueId}&season=${importForm.season}`)
        const d = await r.json()
        if(d.rounds) {
            setAvailableRounds(d.rounds)
            if(d.rounds.length) setImportForm(p => ({...p, round: d.rounds[d.rounds.length-1]}))
        }
    } catch(e) { alert(e.message) } finally { setFetchingRounds(false) }
  }

  const handleImportGames = async (e) => {
    e.preventDefault()
    setImporting(true)
    try {
        const r = await fetch('/api/admin/import-games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(importForm) })
        const d = await r.json()
        alert(d.message)
        fetchAllData()
    } catch(e) { alert(e.message) } finally { setImporting(false) }
  }

  const handleImportPlayers = async () => {
    if(!importForm.competitionId) return alert('Selecione a competição!')
    if(!confirm('Importar jogadores?')) return
    setImporting(true)
    try {
        const r = await fetch('/api/admin/import-players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leagueId: importForm.leagueId, season: importForm.season, competitionId: importForm.competitionId, specificTeamId: importPlayerTeamId }) })
        const d = await r.json()
        alert(d.message)
    } catch(e) { alert(e.message) } finally { setImporting(false) }
  }

  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-blue-400">Importar da API-Football</h3>
        <form onSubmit={handleImportGames} className="space-y-4 max-w-lg">
            <select className="w-full p-3 bg-gray-900 rounded border border-gray-600 text-white" value={importForm.competitionId} onChange={e => setImportForm({...importForm, competitionId: e.target.value})} required>
                <option value="">Selecione Competição...</option>
                {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex gap-4 items-end">
                <input className="w-1/3 p-3 bg-gray-900 rounded border border-gray-600 text-white" value={importForm.leagueId} onChange={e => setImportForm({...importForm, leagueId: e.target.value})} placeholder="71" required />
                <input className="w-1/3 p-3 bg-gray-900 rounded border border-gray-600 text-white" value={importForm.season} onChange={e => setImportForm({...importForm, season: e.target.value})} placeholder="2025" required />
                <button type="button" onClick={handleFetchRounds} disabled={fetchingRounds} className="w-1/3 p-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded text-xs">{fetchingRounds ? '...' : '🔍 Rodadas'}</button>
            </div>
            {availableRounds.length > 0 ? (
                <select className="w-full p-3 bg-gray-900 rounded border border-gray-600 text-white font-bold" value={importForm.round} onChange={e => setImportForm({...importForm, round: e.target.value})}>
                    <option value="">Todas</option>
                    {availableRounds.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            ) : <input className="w-full p-3 bg-gray-900 rounded border border-gray-600 text-white opacity-50" placeholder="Busque rodadas..." disabled />}
            
            <div className="flex items-center gap-2 mt-2 bg-red-900/20 p-3 rounded border border-red-900/50">
                <input type="checkbox" checked={importForm.resetData} onChange={e => setImportForm({...importForm, resetData: e.target.checked})} />
                <label className="text-sm text-red-300 font-bold">Limpar jogos antes?</label>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <button disabled={importing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded shadow-lg">{importing ? '...' : '📥 Importar Jogos'}</button>
                <button type="button" onClick={handleImportPlayers} disabled={importing} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded shadow-lg">{importing ? '...' : '🏃‍♂️ Importar Jogadores'}</button>
            </div>
        </form>
    </div>
  )
}