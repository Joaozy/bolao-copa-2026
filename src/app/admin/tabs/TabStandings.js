'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'

function getFlagEmoji(countryCode) {
  if (!countryCode) return '🏳️'
  return countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397))
}

const TeamBadge = ({ team }) => {
  const [imgSrc, setImgSrc] = useState(team?.badge_url)
  useEffect(() => { setImgSrc(team?.badge_url) }, [team?.badge_url])
  const handleError = () => {
    if (team?.name) {
      const slug = team.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w\-]+/g, '') 
      const localPath = `/badges/${slug}.png`
      if (imgSrc !== localPath) setImgSrc(localPath)
    }
  }
  if (!team) return null
  if (!imgSrc) return <span className="mr-1 text-xl">{getFlagEmoji(team.flag_code)}</span>
  return <img src={imgSrc} alt={team.name} className="w-5 h-5 inline mr-1 object-contain" onError={handleError} />
}

export default function TabStandings({ competitions, teams, games, fetchAllData, setLoading }) {
  const [standingsCompId, setStandingsCompId] = useState('')
  const [standings, setStandings] = useState([])
  const [tableImportForm, setTableImportForm] = useState({ leagueId: '71', season: '2025' })
  const [standingsForm, setStandingsForm] = useState({ team_id: '', group_name: 'Grupo A', position: 1, points: 0, played: 0, won: 0, drawn: 0, lost: 0, goals_diff: 0 })
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (competitions.length > 0 && !standingsCompId) setStandingsCompId(competitions[0].id)
  }, [competitions])

  useEffect(() => {
    if (standingsCompId) fetchStandingsData(standingsCompId)
  }, [standingsCompId])

  const fetchStandingsData = async (compId) => { 
    const { data } = await supabase.from('standings').select('*, teams(*)').eq('competition_id', compId).order('group_name', {ascending:true}).order('position', {ascending:true}); 
    setStandings(data || []) 
  }

  const handleSaveStanding = async (e) => { 
    e.preventDefault(); 
    if (!standingsCompId || !standingsForm.team_id) return alert('Preencha os dados!'); 
    const payload = { ...standingsForm, competition_id: standingsCompId }; 
    const { error } = await supabase.from('standings').upsert(payload, { onConflict: 'competition_id, team_id' }); 
    
    if (error) alert('Erro: ' + error.message); 
    else { 
        alert('Time salvo na tabela!'); 
        fetchStandingsData(standingsCompId); 
        setStandingsForm(prev => ({ ...prev, team_id: '', points: 0, played: 0, won: 0, drawn: 0, lost: 0, goals_diff: 0 })) 
    } 
  }
  
  const handleDeleteStanding = async (id) => { 
    if(!confirm('Remover time da tabela?')) return; 
    await supabase.from('standings').delete().eq('id', id); 
    fetchStandingsData(standingsCompId) 
  }
  
  const handleClearTable = async () => { 
    if (!standingsCompId) return alert('Selecione uma competição!'); 
    if (!confirm('ATENÇÃO: Apagar a tabela toda?')) return; 
    setLoading(true); 
    try { 
        const { error } = await supabase.from('standings').delete().eq('competition_id', standingsCompId); 
        if (error) throw error; 
        alert('Tabela limpa!'); 
        fetchStandingsData(standingsCompId) 
    } catch (error) { alert('Erro: ' + error.message) } finally { setLoading(false) } 
  }

  const handleImportTableData = async (type) => { 
    if (!tableImportForm.leagueId || !tableImportForm.season || !standingsCompId) return alert('Preencha os dados de importação!'); 
    setImporting(true); 
    try { 
        let endpoint = type === 'standings' ? '/api/admin/import-standings' : '/api/admin/import-games'; 
        let body = { leagueId: tableImportForm.leagueId, season: tableImportForm.season, competitionId: standingsCompId, round: '', resetData: false }; 
        
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); 
        const data = await res.json(); 
        
        if (res.ok) { 
            alert(`Sucesso! ${data.message}`); 
            fetchStandingsData(standingsCompId); 
            if (type === 'bracket') fetchAllData() 
        } else {
            alert('Erro: ' + JSON.stringify(data)) 
        }
    } catch(e) { 
        alert('Erro de rede: ' + e.message) 
    } finally { 
        setImporting(false) 
    } 
  }

  const getGamesForComp = (compId) => games.filter(g => g.competition_id == compId)

  return (
    <div className="space-y-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h3 className="text-xl font-bold mb-4 text-green-400">Gerir Dados Oficiais</h3>
            <div className="mb-4">
                <select className="w-full p-3 bg-gray-900 rounded border border-gray-600 text-white" value={standingsCompId} onChange={e => setStandingsCompId(e.target.value)}>
                    <option value="" disabled>Selecione...</option>
                    {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>
            {standingsCompId && (
                <div className="space-y-6">
                    <div className="bg-gray-900/50 p-4 rounded border border-blue-500/30">
                        <h4 className="font-bold text-blue-300 mb-2">Importar da API</h4>
                        <div className="flex flex-wrap gap-4 items-end">
                            <div className="flex-1 min-w-[100px]"><label className="text-xs text-gray-500">ID Liga</label><input className="w-full p-2 bg-gray-800 rounded border border-gray-600 text-xs text-white" value={tableImportForm.leagueId} onChange={e => setTableImportForm({...tableImportForm, leagueId: e.target.value})} placeholder="71" /></div>
                            <div className="flex-1 min-w-[100px]"><label className="text-xs text-gray-500">Ano</label><input className="w-full p-2 bg-gray-800 rounded border border-gray-600 text-xs text-white" value={tableImportForm.season} onChange={e => setTableImportForm({...tableImportForm, season: e.target.value})} placeholder="2025" /></div>
                            <button onClick={() => handleImportTableData('standings')} disabled={importing} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-xs font-bold text-white shadow">{importing ? '...' : '📥 Tabela (Pontos)'}</button>
                            <button onClick={() => handleImportTableData('bracket')} disabled={importing} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-xs font-bold text-white shadow">{importing ? '...' : '📥 Jogos (Mata-mata)'}</button>
                            <button onClick={handleClearTable} disabled={importing} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-xs font-bold text-white shadow">🗑️ Limpar</button>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSaveStanding} className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-700/30 rounded">
                        <div className="col-span-2">
                            <label className="text-xs text-gray-400">Time</label>
                            <select className="w-full p-2 bg-gray-900 rounded border border-gray-600 text-white" value={standingsForm.team_id} onChange={e => setStandingsForm({...standingsForm, team_id: e.target.value})} required>
                                <option value="">Selecione...</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-gray-400">Grupo</label>
                            <input className="w-full p-2 bg-gray-900 rounded border border-gray-600 text-white" value={standingsForm.group_name} onChange={e => setStandingsForm({...standingsForm, group_name: e.target.value})} />
                        </div>
                        <div><label className="text-xs text-gray-400">Pos</label><input type="number" className="w-full p-2 bg-gray-900 rounded text-white" value={standingsForm.position} onChange={e => setStandingsForm({...standingsForm, position: e.target.value})} /></div>
                        <div><label className="text-xs text-gray-400">Pts</label><input type="number" className="w-full p-2 bg-gray-900 rounded text-white" value={standingsForm.points} onChange={e => setStandingsForm({...standingsForm, points: e.target.value})} /></div>
                        <div><label className="text-xs text-gray-400">J</label><input type="number" className="w-full p-2 bg-gray-900 rounded text-white" value={standingsForm.played} onChange={e => setStandingsForm({...standingsForm, played: e.target.value})} /></div>
                        <div><label className="text-xs text-gray-400">SG</label><input type="number" className="w-full p-2 bg-gray-900 rounded text-white" value={standingsForm.goals_diff} onChange={e => setStandingsForm({...standingsForm, goals_diff: e.target.value})} /></div>
                        <button className="col-span-2 md:col-span-4 bg-green-600 hover:bg-green-500 py-2 rounded font-bold mt-2 text-white transition">Salvar na Tabela</button>
                    </form>
                    
                    <div>
                        <h4 className="font-bold text-white mb-2">Tabela Atual</h4>
                        <div className="overflow-x-auto bg-gray-900 rounded border border-gray-700">
                            <table className="w-full text-left text-xs text-white">
                                <thead className="bg-gray-800 text-gray-400 uppercase">
                                    <tr><th className="p-2">Grupo</th><th className="p-2">Pos</th><th className="p-2">Time</th><th className="p-2 text-center">Pts</th><th className="p-2">Ação</th></tr>
                                </thead>
                                <tbody>
                                    {standings.map(s => (
                                        <tr key={s.id} className="border-b border-gray-700 hover:bg-gray-800">
                                            <td className="p-2 text-yellow-500 font-bold">{s.group_name}</td>
                                            <td className="p-2">{s.position}º</td>
                                            <td className="p-2 flex items-center gap-2"><TeamBadge team={s.teams}/> {s.teams?.name}</td>
                                            <td className="p-2 text-center font-bold">{s.points}</td>
                                            <td className="p-2"><button onClick={() => handleDeleteStanding(s.id)} className="text-red-400 hover:text-red-300 bg-red-900/30 p-1 rounded">🗑️</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {standings.length === 0 && <p className="text-gray-500 text-center py-4">Tabela vazia.</p>}
                        </div>
                    </div>

                    <div className="mt-8">
                        <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                            Jogos Cadastrados <span className="text-xs bg-gray-700 px-2 rounded">{getGamesForComp(standingsCompId).length}</span>
                        </h4>
                        <div className="overflow-y-auto max-h-[300px] bg-gray-900 rounded border border-gray-700 p-2 space-y-1 text-white">
                            {getGamesForComp(standingsCompId).length > 0 ? getGamesForComp(standingsCompId).map(g => (
                                <div key={g.id} className="flex justify-between items-center bg-gray-800/50 p-2 rounded text-xs hover:bg-gray-800">
                                    <div className="flex gap-2 items-center"><span className="text-yellow-500 font-bold w-20 truncate">{g.round}</span><span>{g.team_a?.name} <span className="text-gray-400">vs</span> {g.team_b?.name}</span></div>
                                    <div className="text-gray-400">{new Date(g.start_time).toLocaleDateString('pt-BR')} {g.score_a!==null ? `(${g.score_a}x${g.score_b})` : ''}</div>
                                </div>
                            )) : <p className="text-gray-500 text-center py-4">Nenhum jogo cadastrado.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  )
}