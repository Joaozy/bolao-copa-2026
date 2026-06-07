'use client'
import { useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function TabBanners({ banners, fetchAllData }) {
  const [bannerForm, setBannerForm] = useState({ image_url: '', link_url: '', is_active: true, order_index: 0 })
  const [editingBannerId, setEditingBannerId] = useState(null)

  const handleSaveBanner = async (e) => {
    e.preventDefault()
    const payload = { ...bannerForm, order_index: parseInt(bannerForm.order_index) }
    const q = editingBannerId 
        ? supabase.from('banners').update(payload).eq('id', editingBannerId) 
        : supabase.from('banners').insert(payload)
    
    const { error } = await q
    
    if (error) {
        alert(error.message)
    } else { 
        alert('Banner guardado com sucesso!'); 
        setBannerForm({ image_url: '', link_url: '', is_active: true, order_index: 0 }); 
        setEditingBannerId(null); 
        fetchAllData() 
    }
  }

  const handleEditBanner = (b) => { 
    setBannerForm(b); 
    setEditingBannerId(b.id); 
    window.scrollTo(0,0) 
  }

  const handleDeleteBanner = async (id) => { 
    if(confirm('Apagar banner?')) { 
        await supabase.from('banners').delete().eq('id', id); 
        fetchAllData() 
    } 
  }

  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-12">
        <h3 className="text-xl font-bold mb-4 text-blue-400">Gerir Banners Rotativos</h3>
        
        <form onSubmit={handleSaveBanner} className="flex flex-col gap-4 mb-8 bg-gray-900 p-4 rounded border border-gray-600">
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">URL da Imagem (Horizontal)</label>
                    <input className="w-full p-2 bg-gray-800 rounded text-white" value={bannerForm.image_url} onChange={e => setBannerForm({...bannerForm, image_url: e.target.value})} required />
                </div>
                <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">Link de Destino (Opcional)</label>
                    <input className="w-full p-2 bg-gray-800 rounded text-white" value={bannerForm.link_url} onChange={e => setBannerForm({...bannerForm, link_url: e.target.value})} placeholder="https://..." />
                </div>
            </div>
            <div className="flex gap-4 items-end">
                <div>
                    <label className="text-xs text-gray-400 block mb-1">Ordem</label>
                    <input type="number" className="w-20 p-2 bg-gray-800 rounded text-white text-center" value={bannerForm.order_index} onChange={e => setBannerForm({...bannerForm, order_index: e.target.value})} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={bannerForm.is_active} onChange={e => setBannerForm({...bannerForm, is_active: e.target.checked})} />
                    <span className="text-sm">Ativo</span>
                </div>
                <div className="ml-auto flex gap-2">
                    {editingBannerId && (
                        <button type="button" onClick={() => { setEditingBannerId(null); setBannerForm({ image_url: '', link_url: '', is_active: true, order_index: 0 }); }} className="bg-gray-600 px-4 py-2 rounded font-bold text-white hover:bg-gray-500">Cancelar</button>
                    )}
                    <button className="bg-blue-600 px-6 py-2 rounded font-bold text-white hover:bg-blue-500">Salvar Banner</button>
                </div>
            </div>
        </form>
        
        <div className="grid gap-4">
            {banners.map(b => (
                <div key={b.id} className={`flex items-center gap-4 bg-gray-900 p-3 rounded border ${b.is_active ? 'border-gray-600' : 'border-red-900 opacity-50'}`}>
                    <div className="w-10 h-10 bg-gray-800 rounded flex items-center justify-center font-bold">{b.order_index}</div>
                    <img src={b.image_url} alt="Banner" className="h-16 w-48 object-cover rounded" />
                    <div className="flex-1 text-sm text-gray-400 truncate">{b.link_url || 'Sem link'}</div>
                    <div className="flex gap-2">
                        <button onClick={() => handleEditBanner(b)} className="bg-gray-700 p-2 rounded hover:bg-gray-600">✏️</button>
                        <button onClick={() => handleDeleteBanner(b.id)} className="bg-red-900/30 text-red-500 p-2 rounded hover:bg-red-900/50">🗑️</button>
                    </div>
                </div>
            ))}
            {banners.length === 0 && <p className="text-gray-500 italic">Nenhum banner cadastrado.</p>}
        </div>
    </div>
  )
}