'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function TabCompetitions({ competitions, fetchAllData, setLoading }) {
  const [compForm, setCompForm] = useState({ name: '', slug: '', type: 'pontos_corridos', entry_fee: 50, is_active: true, prazo_inscricao: '' })
  const [editingCompId, setEditingCompId] = useState(null)

  // Função para formatar data do banco para o input do form (YYYY-MM-DDTHH:mm)
  const formatForInput = (isoDate) => {
    if (!isoDate) return ''
    return new Date(isoDate).toISOString().slice(0, 16)
  }

  const handleSaveComp = async (e) => { 
    e.preventDefault(); 
    // Garante que a data está no formato correto para o banco
    const payload = {
        ...compForm,
        prazo_inscricao: compForm.prazo_inscricao ? new Date(compForm.prazo_inscricao).toISOString() : null
    };

    const q = editingCompId 
        ? supabase.from('competitions').update(payload).eq('id', editingCompId) 
        : supabase.from('competitions').insert(payload); 
    
    const { error } = await q; 
    
    if (error) {
        alert(error.message); 
    } else { 
        alert('Competição guardada com sucesso!'); 
        setCompForm({ name: '', slug: '', type: 'pontos_corridos', entry_fee: 50, is_active: true, prazo_inscricao: '' }); 
        setEditingCompId(null); 
        fetchAllData(); 
    } 
  }
  
  const handleEditComp = (c) => { 
    setCompForm({
        ...c,
        prazo_inscricao: formatForInput(c.prazo_inscricao)
    }); 
    setEditingCompId(c.id); 
    window.scrollTo(0,0);
  }
  
  // ... (funções handleToggleCompStatus e handleDeleteComp permanecem iguais)
  const handleToggleCompStatus = async (c) => { 
    await supabase.from('competitions').update({ is_active: !c.is_active }).eq('id', c.id); 
    fetchAllData();
  }

  const handleDeleteComp = async (id) => {
    if(confirm('Tem a certeza de que deseja apagar TUDO desta competição?')) {
      setLoading(true);
      try {
        // ... (seu código de deleção em cascata permanece igual)
        const { error } = await supabase.from('competitions').delete().eq('id', id);
        if (error) throw error; 
        fetchAllData();
      } catch(e) { alert('Erro: ' + e.message); } finally { setLoading(false); }
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSaveComp} className="bg-gray-800 p-4 rounded border border-gray-700 flex flex-col gap-4">
        <div className="flex gap-4">
            <input placeholder="Nome da Competição" className="flex-1 p-2 bg-gray-900 rounded text-white border border-gray-600" value={compForm.name} onChange={e => setCompForm({...compForm, name: e.target.value})} required />
            <input type="datetime-local" className="p-2 bg-gray-900 rounded text-white border border-gray-600" value={compForm.prazo_inscricao} onChange={e => setCompForm({...compForm, prazo_inscricao: e.target.value})} />
        </div>
        <div className="flex gap-2">
            <button className="bg-green-600 px-6 py-2 rounded font-bold text-white hover:bg-green-500">
                {editingCompId ? 'Atualizar Competição' : 'Criar Competição'}
            </button>
            {editingCompId && (
                <button type="button" onClick={() => { setEditingCompId(null); setCompForm({ name: '', slug: '', type: 'pontos_corridos', entry_fee: 50, is_active: true, prazo_inscricao: '' }); }} className="bg-gray-600 px-4 rounded font-bold text-white">Cancelar</button>
            )}
        </div>
      </form>

      {competitions.map(c => (
        <div key={c.id} className="bg-gray-800 p-4 rounded flex justify-between items-center border border-gray-700">
            <div>
                <div className="font-bold text-lg">{c.name}</div>
                <div className="text-xs text-gray-400">
                    Prazo: {c.prazo_inscricao ? new Date(c.prazo_inscricao).toLocaleString('pt-BR') : 'Não definido'}
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => handleEditComp(c)} className="bg-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-600">✏️ Editar</button>
                <button onClick={() => handleDeleteComp(c.id)} className="bg-red-900/30 text-red-400 px-3 py-1 rounded text-sm">🗑️</button>
            </div>
        </div>
      ))}
    </div>
  )
}