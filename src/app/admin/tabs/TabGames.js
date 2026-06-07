'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function TabGames({ competitions, teams, games, fetchAllData }) {
  const [editingGameId, setEditingGameId] = useState(null)
  const [gameForm, setGameForm] = useState({ competition_id: '', round: '', team_a: '', team_b: '', start_time: '', score_a: '', score_b: '', status_short: '', elapsed: '' })

  const handleSaveGame = async (e) => {
    e.preventDefault()
    const payload = {
        competition_id: gameForm.competition_id, 
        round: gameForm.round, 
        start_time: gameForm.start_time,
        score_a: gameForm.score_a === '' ? null : parseInt(gameForm.score_a),
        score_b: gameForm.score_b === '' ? null : parseInt(gameForm.score_b),
        status_short: gameForm.status_short, 
        elapsed: gameForm.elapsed === '' ? null : parseInt(gameForm.elapsed),
        team_a_id: parseInt(gameForm.team_a), 
        team_b_id: parseInt(gameForm.team_b)
    }
    const q = editingGameId ? supabase.from('games').update(payload).eq('id', editingGameId) : supabase.from('games').insert(payload)
    const { error } = await q
    if (error) alert(error.message)
    else { 
        await supabase.rpc('calculate_points'); 
        fetchAllData(); 
        setEditingGameId(null);
        setGameForm({ competition_id: '', round: '', team_a: '', team_b: '', start_time: '', score_a: '', score_b: '', status_short: '', elapsed: '' });
    }
  }

  const handleEditGame = (g) => { 
    const d = new Date(g.start_time); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); 
    setGameForm({ competition_id:g.competition_id, round:g.round, team_a:g.team_a_id, team_b:g.team_b_id, start_time: d.toISOString().slice(0,16), score_a:g.score_a??'', score_b:g.score_b??'', status_short:g.status_short||'', elapsed:g.elapsed||'' }); 
    setEditingGameId(g.id);
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 h-fit">
            <h3 className="text-lg font-bold mb-4 text-green-400">{editingGameId ? 'Editar' : 'Novo'} Jogo</h3>
            <form onSubmit={handleSaveGame} className="space-y-3">
                <select className="w-full p-2 bg-gray-900 rounded border border-gray-600 text-white" value={gameForm.competition_id} onChange={e => setGameForm({...gameForm, competition_id: e.target.value})} required>
                    <option value="">Competição...</option>{competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input className="w-full p-2 bg-gray-900 rounded border border-gray-600 text-white" placeholder="Rodada" value={gameForm.round} onChange={e => setGameForm({...gameForm, round: e.target.value})} required />
                <div className="flex gap-2">
                    <select className="w-1/2 p-2 bg-gray-900 rounded border border-gray-600 text-white" value={gameForm.team_a} onChange={e => setGameForm({...gameForm, team_a: e.target.value})}><option value="">Casa...</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
                    <select className="w-1/2 p-2 bg-gray-900 rounded border border-gray-600 text-white" value={gameForm.team_b} onChange={e => setGameForm({...gameForm, team_b: e.target.value})}><option value="">Visitante...</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
                </div>
                <input type="datetime-local" className="w-full p-2 bg-gray-900 rounded border border-gray-600 text-white" value={gameForm.start_time} onChange={e => setGameForm({...gameForm, start_time: e.target.value})} required />
                <button className="w-full bg-green-600 py-2 rounded text-white font-bold">Salvar</button>
            </form>
        </div>
        <div className="md:col-span-2 bg-gray-800 p-4 rounded-xl border border-gray-700 max-h-[80vh] overflow-y-auto">
            {games.map(g => (
                <div key={g.id} className="flex justify-between items-center bg-gray-700/30 p-3 mb-2 rounded hover:bg-gray-700/50">
                    <div>
                        <div className="text-[10px] text-yellow-500 font-bold uppercase">{g.competition?.name} • {g.round}</div>
                        <div className="flex items-center gap-2 font-bold text-sm">{g.team_a?.name} vs {g.team_b?.name}</div>
                    </div>
                    <button onClick={() => handleEditGame(g)} className="bg-gray-700 p-2 rounded">✏️</button>
                </div>
            ))}
        </div>
    </div>
  )
}