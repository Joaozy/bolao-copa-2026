'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabaseClient'

const formatDateForInput = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - (offset * 60 * 1000))
  return localDate.toISOString().slice(0, 16)
}

const formatDateForDb = (localString) => {
  if (!localString) return null
  return new Date(localString).toISOString()
}

const formatDateForDisplay = (isoString) => {
  if (!isoString) return 'Sem prazo definido'
  return new Date(isoString).toLocaleString('pt-BR', { 
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
  })
}

export default function TabRules({ competitions, teams, games, setLoading }) {
  const [rulesCompId, setRulesCompId] = useState('')
  const [roundSettings, setRoundSettings] = useState([]) 
  const [specialRules, setSpecialRules] = useState([])
  const [specialsDeadline, setSpecialsDeadline] = useState('')
  const [isEditingDeadline, setIsEditingDeadline] = useState(false)
  const [scorerTeamFilter, setScorerTeamFilter] = useState('')
  const [allPlayers, setAllPlayers] = useState([])

  const competitionTeams = teams.filter(t => !rulesCompId ? false : games.some(g => g.competition_id == rulesCompId && (g.team_a_id === t.id || g.team_b_id === t.id)))

  useEffect(() => {
    if (competitions.length > 0 && !rulesCompId) setRulesCompId(competitions[0].id)
  }, [competitions])

  useEffect(() => {
    if (rulesCompId) fetchRulesData(rulesCompId)
  }, [rulesCompId])

  useEffect(() => {
    if (scorerTeamFilter) {
        supabase.from('players').select('*').eq('team_id', scorerTeamFilter).order('name')
            .then(({ data }) => setAllPlayers(data || []))
    } else {
        supabase.from('players').select('*').limit(500).order('name')
            .then(({ data }) => setAllPlayers(data || []))
    }
  }, [scorerTeamFilter])

  async function fetchRulesData(compId) { 
    const { data: savedMultipliers } = await supabase.from('round_settings').select('*').eq('competition_id', compId); 
    const compGames = games.filter(g => g.competition_id == compId); 
    const uniqueRounds = [...new Set(compGames.map(g => g.round))].filter(Boolean).sort(); 
    const mergedSettings = uniqueRounds.map(r => { const saved = savedMultipliers?.find(sm => sm.round_name === r); return { round_name: r, multiplier: saved ? saved.multiplier : 1.0 } }); 
    setRoundSettings(mergedSettings); 
    
    const { data: savedSpecials } = await supabase.from('special_rules').select('*').eq('competition_id', compId); 
    const existingDeadline = savedSpecials?.find(s => s.deadline)?.deadline; 
    setSpecialsDeadline(existingDeadline ? formatDateForInput(existingDeadline) : ''); 
    setIsEditingDeadline(false); 
    
    const baseSpecials = [
        { type: 'champion', label: '🏆 Campeão', points: 50 }, 
        { type: 'vice', label: '🥈 Vice-Campeão', points: 30 }, 
        { type: 'third', label: '🥉 3º Lugar', points: 20 }, 
        { type: 'fourth', label: '🏅 Quarto Lugar', points: 10 }, 
        { type: 'top_scorer', label: '⚽ Artilheiro', points: 40 }
    ]; 
    const mergedSpecials = baseSpecials.map(base => { const saved = savedSpecials?.find(s => s.type === base.type); return { ...base, ...saved } }); 
    setSpecialRules(mergedSpecials) 
  }

  const handleSaveRules = async () => { 
    if (!rulesCompId) return alert('Selecione uma competição!'); 
    setLoading(true); 
    try { 
        const multi = roundSettings.map(rs => ({ competition_id: parseInt(rulesCompId), round_name: rs.round_name, multiplier: parseFloat(rs.multiplier) })); 
        if (multi.length) await supabase.from('round_settings').upsert(multi, { onConflict: 'competition_id, round_name' }); 
        
        const dIso = specialsDeadline ? formatDateForDb(specialsDeadline) : null; 
        
        const specs = specialRules.map(sr => ({ 
            competition_id: parseInt(rulesCompId), 
            type: sr.type, 
            points: parseInt(sr.points), 
            is_active: sr.is_active, 
            correct_team_id: (sr.correct_team_id && String(sr.correct_team_id).trim() !== '') ? parseInt(sr.correct_team_id) : null, 
            correct_value: (sr.correct_value && String(sr.correct_value).trim() !== '') ? sr.correct_value : null, 
            deadline: dIso 
        })); 
        
        if (specs.length) await supabase.from('special_rules').upsert(specs, { onConflict: 'competition_id, type' }); 
        
        await supabase.rpc('calculate_points'); 
        await supabase.rpc('calculate_special_points'); 
        
        setIsEditingDeadline(false); 
        alert('Regras Salvas e Ranking Atualizado!'); 
        fetchRulesData(rulesCompId);
    } catch(e) { alert('Erro: ' + e.message); } finally { setLoading(false); } 
  }

  const updateRoundMultiplier = (rn, v) => { setRoundSettings(prev => prev.map(r => r.round_name === rn ? { ...r, multiplier: v } : r)) }
  const updateSpecialRule = (t, f, v) => { setSpecialRules(prev => prev.map(s => s.type === t ? { ...s, [f]: v } : s)) }

  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl mb-12">
      <h2 className="text-2xl font-bold mb-6 text-blue-400 flex items-center gap-2">⚙️ Regras & Resultados Extras</h2>
      <div className="mb-6 p-4 bg-gray-900 rounded border border-gray-600">
        <label className="block text-sm text-gray-400 mb-2">Selecione o campeonato:</label>
        <select className="w-full p-3 bg-gray-800 rounded border border-gray-500 text-white font-bold" value={rulesCompId} onChange={(e) => setRulesCompId(e.target.value)}>
          <option value="" disabled>Selecione...</option>
          {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {rulesCompId && (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="md:col-span-2 bg-gray-900/50 p-4 rounded border border-gray-600">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-yellow-400">📅 Prazo e Gabarito</h3>
              {!isEditingDeadline ? (
                <button onClick={() => setIsEditingDeadline(true)} className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded border border-gray-500">✏️ Editar Prazo</button>
              ) : (
                <span className="text-xs text-green-400 font-bold">Editando...</span>
              )}
            </div>
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-xs text-gray-400 font-bold uppercase">Prazo Final:</label>
              {isEditingDeadline ? (
                <input type="datetime-local" className="w-full p-2 bg-gray-800 rounded border border-yellow-500 text-white text-sm" value={specialsDeadline} onChange={(e) => setSpecialsDeadline(e.target.value)} />
              ) : (
                <div className="p-2 bg-gray-800 rounded border border-gray-700 text-gray-300 text-sm font-mono">{specialsDeadline ? formatDateForDisplay(formatDateForDb(specialsDeadline)) : 'Nenhum prazo definido'}</div>
              )}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-yellow-400 mb-4 border-b border-gray-700 pb-2">✖️ Multiplicadores</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {roundSettings.length > 0 ? (
                roundSettings.map((rs, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-700/50 p-3 rounded">
                    <span className="font-bold text-sm">{rs.round_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">x</span>
                      <input type="number" step="0.1" min="1" className="w-16 p-1 bg-gray-900 rounded border border-gray-600 text-center font-bold text-yellow-400" value={rs.multiplier} onChange={(e) => updateRoundMultiplier(rs.round_name, e.target.value)}/>
                    </div>
                  </div>
                ))
              ) : <p className="text-gray-500 text-sm">Nenhuma rodada encontrada.</p>}
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-purple-400 mb-4 border-b border-gray-700 pb-2">🏆 Opções de Aposta</h3>
            <div className="space-y-4">
              {specialRules.map((sr, idx) => (
                <div key={idx} className={`p-4 rounded border transition ${sr.is_active ? 'bg-purple-900/20 border-purple-500' : 'bg-gray-700/30 border-gray-700 opacity-70'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">{sr.label}</span>
                    <button onClick={() => updateSpecialRule(sr.type, 'is_active', !sr.is_active)} className={`text-xs px-3 py-1 rounded-full font-bold ${sr.is_active ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                      {sr.is_active ? 'ATIVADO' : 'DESATIVADO'}
                    </button>
                  </div>
                  {sr.is_active && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-400 w-16">Pontos:</label>
                        <input type="number" className="w-20 p-1 bg-gray-900 rounded border border-gray-600 text-center font-bold text-white" value={sr.points} onChange={(e) => updateSpecialRule(sr.type, 'points', e.target.value)}/>
                        <span className="text-xs text-yellow-400 font-bold">pts</span>
                      </div>
                      <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-700">
                        <label className="text-xs text-green-400 font-bold">Vencedor Oficial:</label>
                        {sr.type === 'top_scorer' ? (
                          <div className="flex flex-col gap-2">
                            <select className="w-full p-2 bg-gray-800 rounded border border-gray-600 text-xs text-white" value={scorerTeamFilter} onChange={e => setScorerTeamFilter(e.target.value)}>
                              <option value="">Filtre pelo Time...</option>
                              {competitionTeams.length > 0 ? competitionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <select className="w-full p-2 bg-gray-900 rounded border border-gray-500 text-white text-sm font-bold" value={sr.correct_value || ''} onChange={(e) => updateSpecialRule(sr.type, 'correct_value', e.target.value)} disabled={!scorerTeamFilter && !sr.correct_value}>
                              <option value="">Selecione o Jogador...</option>
                              {sr.correct_value && !scorerTeamFilter && <option value={sr.correct_value}>{sr.correct_value}</option>}
                              {allPlayers.filter(p => !scorerTeamFilter || p.team_id == scorerTeamFilter).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                          </div>
                        ) : (
                          <select className="flex-1 p-2 bg-gray-900 rounded border border-gray-500 text-white text-sm" value={sr.correct_team_id || ''} onChange={(e) => updateSpecialRule(sr.type, 'correct_team_id', e.target.value)}>
                            <option value="">Selecione o Time...</option>
                            {competitionTeams.length > 0 ? competitionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {rulesCompId && (
        <div className="mt-8 pt-4 border-t border-gray-700 flex justify-end">
          <button onClick={handleSaveRules} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg">
            💾 Salvar Regras & Resultados
          </button>
        </div>
      )}
    </div>
  )
}