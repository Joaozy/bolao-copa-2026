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

export default function TabTeams({ teams, fetchAllData }) {
  const [teamForm, setTeamForm] = useState({ name: '', flag_code: '' })
  const [editingTeamId, setEditingTeamId] = useState(null)

  const handleSaveTeam = async (e) => { 
    e.preventDefault(); 
    const q = editingTeamId 
        ? supabase.from('teams').update(teamForm).eq('id', editingTeamId) 
        : supabase.from('teams').insert(teamForm); 
    
    await q; 
    fetchAllData(); 
    setEditingTeamId(null);
    setTeamForm({ name: '', flag_code: '' });
  }
  
  const handleEditTeam = (t) => { 
    setTeamForm(t); 
    setEditingTeamId(t.id); 
    window.scrollTo(0,0) 
  }

  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-white">Gerir Times / Seleções</h3>
        
        <form onSubmit={handleSaveTeam} className="flex gap-4 mb-6">
            <input className="p-3 bg-gray-900 rounded border border-gray-600 flex-1 text-white" placeholder="Nome" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} required />
            <input className="p-3 bg-gray-900 rounded border border-gray-600 w-24 uppercase text-white" placeholder="Sigla" maxLength={2} value={teamForm.flag_code} onChange={e => setTeamForm({...teamForm, flag_code: e.target.value.toUpperCase()})} />
            <button className="bg-blue-600 px-6 rounded font-bold text-white hover:bg-blue-500">
                {editingTeamId ? 'Atualizar' : 'Salvar'}
            </button>
            {editingTeamId && (
                <button type="button" onClick={() => { setEditingTeamId(null); setTeamForm({ name: '', flag_code: '' }); }} className="bg-gray-600 px-4 rounded font-bold text-white hover:bg-gray-500">Cancelar</button>
            )}
        </form>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {teams.map(t => (
                <button key={t.id} onClick={() => handleEditTeam(t)} className="bg-gray-900 p-2 rounded text-left text-sm hover:bg-gray-700 flex items-center gap-2 truncate text-white border border-transparent hover:border-gray-500 transition">
                    <TeamBadge team={t} /> {t.name}
                </button>
            ))}
        </div>
    </div>
  )
}