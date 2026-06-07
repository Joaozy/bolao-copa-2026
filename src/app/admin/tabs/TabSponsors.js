'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function TabSponsors({ sponsors, fetchAllData }) {
  const [sponsorForm, setSponsorForm] = useState({ name: '', logo_url: '', description: '', contact_info: '', is_active: true, order_index: 0 })
  const [editingSponsorId, setEditingSponsorId] = useState(null)

  const handleSaveSponsor = async (e) => {
    e.preventDefault()
    const payload = { ...sponsorForm, order_index: parseInt(sponsorForm.order_index) }
    const q = editingSponsorId 
        ? supabase.from('sponsors').update(payload).eq('id', editingSponsorId) 
        : supabase.from('sponsors').insert(payload)
    
    const { error } = await q
    if (error) {
        alert(error.message)
    } else { 
        alert('Parceiro guardado com sucesso!'); 
        setSponsorForm({ name: '', logo_url: '', description: '', contact_info: '', is_active: true, order_index: 0 }); 
        setEditingSponsorId(null); 
        fetchAllData() 
    }
  }

  const handleEditSponsor = (s) => { 
    setSponsorForm(s); 
    setEditingSponsorId(s.id); 
    window.scrollTo(0,0) 
  }

  const handleDeleteSponsor = async (id) => { 
    if(confirm('Apagar parceiro?')) { 
        await supabase.from('sponsors').delete().eq('id', id); 
        fetchAllData() 
    } 
  }

  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-purple-400">Gerir Parceiros / Patrocinadores</h3>
        <form onSubmit={handleSaveSponsor} className="flex flex-col gap-4 mb-8 bg-gray-900 p-4 rounded border border-gray-600">
            <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Nome do Parceiro</label>
                    <input className="w-full p-2 bg-gray-800 rounded text-white" value={sponsorForm.name} onChange={e => setSponsorForm({...sponsorForm, name: e.target.value})} required />
                </div>
                <div>
                    <label className="text-xs text-gray-400 block mb-1">URL da Logo (Quadrada/Redonda)</label>
                    <input className="w-full p-2 bg-gray-800 rounded text-white" value={sponsorForm.logo_url} onChange={e => setSponsorForm({...sponsorForm, logo_url: e.target.value})} />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs text-gray-400 block mb-1">Descrição / História / Prémio Oferecido</label>
                    <textarea className="w-full p-2 bg-gray-800 rounded text-white h-24" value={sponsorForm.description} onChange={e => setSponsorForm({...sponsorForm, description: e.target.value})} placeholder="Escreva sobre o parceiro ou insira a URL de uma imagem..." />
                </div>
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Contacto (Instagram / WhatsApp / Link)</label>
                    <input className="w-full p-2 bg-gray-800 rounded text-white" value={sponsorForm.contact_info} onChange={e => setSponsorForm({...sponsorForm, contact_info: e.target.value})} />
                </div>
                <div className="flex items-end justify-between">
                    <div>
                        <label className="text-xs text-gray-400 block mb-1">Ordem na Aba</label>
                        <input type="number" className="w-20 p-2 bg-gray-800 rounded text-white text-center" value={sponsorForm.order_index} onChange={e => setSponsorForm({...sponsorForm, order_index: e.target.value})} />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <input type="checkbox" checked={sponsorForm.is_active} onChange={e => setSponsorForm({...sponsorForm, is_active: e.target.checked})} />
                        <span className="text-sm">Ativo</span>
                    </div>
                </div>
            </div>
            <div className="flex justify-end mt-2 gap-2">
                {editingSponsorId && (
                    <button type="button" onClick={() => { setEditingSponsorId(null); setSponsorForm({ name: '', logo_url: '', description: '', contact_info: '', is_active: true, order_index: 0 }); }} className="bg-gray-600 px-8 py-2 rounded font-bold text-white hover:bg-gray-500">Cancelar</button>
                )}
                <button className="bg-purple-600 px-8 py-2 rounded font-bold text-white hover:bg-purple-500">Salvar Parceiro</button>
            </div>
        </form>
        
        <div className="grid md:grid-cols-2 gap-4">
            {sponsors.map(s => (
                <div key={s.id} className={`flex items-start gap-4 bg-gray-900 p-4 rounded border ${s.is_active ? 'border-gray-600' : 'border-red-900 opacity-50'}`}>
                    {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name} className="w-16 h-16 object-cover rounded-full border-2 border-gray-700 bg-white" />
                    ) : (
                        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-xl">🤝</div>
                    )}
                    <div className="flex-1">
                        <div className="font-bold text-lg">{s.name}</div>
                        <div className="text-xs text-purple-400 mb-2">{s.contact_info}</div>
                        <div className="text-sm text-gray-400 line-clamp-2">{s.description}</div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => handleEditSponsor(s)} className="bg-gray-700 p-2 rounded hover:bg-gray-600">✏️</button>
                        <button onClick={() => handleDeleteSponsor(s.id)} className="bg-red-900/30 text-red-500 p-2 rounded hover:bg-red-900/50">🗑️</button>
                    </div>
                </div>
            ))}
            {sponsors.length === 0 && <p className="text-gray-500 italic col-span-2">Nenhum parceiro cadastrado.</p>}
        </div>
    </div>
  )
}