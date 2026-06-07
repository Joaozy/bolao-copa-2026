'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function TabCompetitions({ competitions, fetchAllData, setLoading }) {
  const [compForm, setCompForm] = useState({ name: '', slug: '', type: 'pontos_corridos', entry_fee: 50, is_active: true })
  const [editingCompId, setEditingCompId] = useState(null)

  const handleSaveComp = async (e) => { 
    e.preventDefault(); 
    const q = editingCompId 
        ? supabase.from('competitions').update(compForm).eq('id', editingCompId) 
        : supabase.from('competitions').insert(compForm); 
    
    const { error } = await q; 
    
    if (error) {
        alert(error.message); 
    } else { 
        alert('Competição guardada com sucesso!'); 
        setCompForm({ name: '', slug: '', type: 'pontos_corridos', entry_fee: 50, is_active: true }); 
        setEditingCompId(null); 
        fetchAllData(); 
    } 
  }
  
  const handleEditComp = (c) => { 
    setCompForm(c); 
    setEditingCompId(c.id); 
    window.scrollTo(0,0);
  }
  
  const handleToggleCompStatus = async (c) => { 
    await supabase.from('competitions').update({ is_active: !c.is_active }).eq('id', c.id); 
    fetchAllData();
  }
  
  const handleDeleteComp = async (id) => {
    if(confirm('Tens a certeza de que desejas apagar TUDO desta competição? (Ação irreversível)')) {
      setLoading(true);
      try {
        const { data: gData } = await supabase.from('games').select('id').eq('competition_id', id);
        const gIds = gData?.map(i => i.id) || [];
        if (gIds.length) {
          await supabase.from('bets').delete().in('game_id', gIds);
          await supabase.from('games').delete().eq('competition_id', id);
        }
        
        const { data: srData } = await supabase.from('special_rules').select('id').eq('competition_id', id);
        const srIds = srData?.map(i => i.id) || [];
        if (srIds.length) {
           await supabase.from('special_bets').delete().in('special_rule_id', srIds);
           await supabase.from('special_rules').delete().eq('competition_id', id);
        }
        
        await supabase.from('enrollments').delete().eq('competition_id', id);
        await supabase.from('prize_rules').delete().eq('competition_id', id);
        await supabase.from('round_settings').delete().eq('competition_id', id);
        await supabase.from('standings').delete().eq('competition_id', id);
        
        const { error } = await supabase.from('competitions').delete().eq('id', id);
        if (error) throw error; 
        
        alert('Competição excluída com sucesso!');
        fetchAllData();
      } catch(e) { 
        alert('Erro ao excluir: ' + e.message); 
      } finally { 
        setLoading(false); 
      }
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSaveComp} className="bg-gray-800 p-4 rounded border border-gray-700 flex gap-4">
        <input 
            placeholder="Nome" 
            className="flex-1 p-2 bg-gray-900 rounded text-white" 
            value={compForm.name} 
            onChange={e => setCompForm({...compForm, name: e.target.value})} 
            required
        />
        <button className="bg-green-600 px-4 rounded font-bold text-white">
            {editingCompId ? 'Atualizar' : 'Guardar'}
        </button>
        {editingCompId && (
            <button 
                type="button" 
                onClick={() => { setEditingCompId(null); setCompForm({ name: '', slug: '', type: 'pontos_corridos', entry_fee: 50, is_active: true }); }} 
                className="bg-gray-600 px-4 rounded font-bold text-white"
            >
                Cancelar
            </button>
        )}
      </form>

      {competitions.map(c => (
        <div key={c.id} className="bg-gray-800 p-4 rounded flex justify-between items-center border border-gray-700">
            <div>
                <div className="font-bold text-lg flex items-center gap-2">
                    {c.name} 
                    {!c.is_active && <span className="text-[10px] bg-red-900 px-2 rounded">OCULTA</span>}
                </div>
                <div className="text-xs text-gray-500">{c.slug} • R$ {c.entry_fee}</div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => handleToggleCompStatus(c)} className={`text-xs border px-3 py-1 rounded font-bold ${c.is_active ? 'border-gray-600 text-gray-400' : 'border-green-600 text-green-400'}`}>
                    {c.is_active ? 'Ocultar' : 'Mostrar'}
                </button>
                <button onClick={() => handleEditComp(c)} className="bg-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-600">✏️</button>
                <button onClick={() => handleDeleteComp(c.id)} className="bg-red-900/30 text-red-400 border border-red-900 px-3 py-1 rounded text-sm hover:bg-red-900/50">🗑️</button>
            </div>
        </div>
      ))}
    </div>
  )
}