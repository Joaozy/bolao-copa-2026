'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function Perfil() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [isEditing, setIsEditing] = useState(false) 
  const [isNewUser, setIsNewUser] = useState(false)
  
  const [user, setUser] = useState(null)
  const [userEmail, setUserEmail] = useState('') // Guardar o e-mail para exibir

  const [formData, setFormData] = useState({
    full_name: '',
    nickname: '',
    whatsapp: '',
    avatar_url: '',
    notify_results: false 
  })

  // Estados para troca de senha logado
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const [myEnrollments, setMyEnrollments] = useState([])
  const [availableComps, setAvailableComps] = useState([])
  const [enrollingId, setEnrollingId] = useState(null)

  const [avatarFile, setAvatarFile] = useState(null)
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session || !session.user) { 
        router.push('/login'); 
        return; 
    }
    
    const currentUser = session.user
    setUser(currentUser)
    setUserEmail(currentUser.email) // Puxa o e-mail de acesso

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()

    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        nickname: profile.nickname || '',
        whatsapp: profile.whatsapp || '',
        avatar_url: profile.avatar_url || '',
        notify_results: profile.notify_results || false 
      })
      if (!profile.nickname) { setIsNewUser(true); setIsEditing(true) }
    }

    const { data: enrolls } = await supabase.from('enrollments').select('*, competitions(*)').eq('user_id', currentUser.id).order('joined_at', { ascending: false })
    setMyEnrollments(enrolls || [])

    const { data: comps } = await supabase.from('competitions').select('*').eq('is_active', true).order('id')
    
    if (comps) {
      const myCompIds = (enrolls || []).map(e => e.competition_id)
      const available = comps.filter(c => !myCompIds.includes(c.id))
      setAvailableComps(available)
    }

    setLoading(false)
  }

  const handleEnroll = async (competitionId) => {
    setEnrollingId(competitionId)
    try {
        const { error } = await supabase.from('enrollments').insert({ user_id: user.id, competition_id: competitionId, is_paid: false })
        if (error) throw error
        toast.success('Inscrição realizada!')
        await loadData()
    } catch (e) { toast.error('Erro: ' + e.message) } finally { setEnrollingId(null) }
  }

  const handleUnsubscribe = async (enrollmentId, competitionName) => {
    if (!confirm(`Desistir de ${competitionName}?`)) return
    try {
        const { error } = await supabase.from('enrollments').delete().eq('id', enrollmentId).eq('is_paid', false)
        if (error) throw error
        toast.success('Inscrição cancelada.')
        await loadData()
    } catch (e) { toast.error('Erro: ' + e.message) }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) { setAvatarFile(file); setFormData({ ...formData, avatar_url: URL.createObjectURL(file) }) }
  }

  const handleSave = async () => {
    if (!formData.nickname || !formData.full_name || !formData.whatsapp) return toast.error('Preencha todos os campos.')
    setSaving(true)
    let publicUrl = formData.avatar_url
    try {
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const fileName = `${user.id}-${Math.random()}.${fileExt}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, avatarFile)
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
        publicUrl = data.publicUrl
      }
      
      const { error } = await supabase.from('profiles').update({ 
        full_name: formData.full_name, 
        nickname: formData.nickname, 
        whatsapp: formData.whatsapp, 
        avatar_url: publicUrl,
        notify_results: formData.notify_results 
      }).eq('id', user.id)
      
      if (error) throw error
      toast.success('Perfil salvo!')
      setIsEditing(false); setIsNewUser(false)
    } catch (error) { toast.error('Erro: ' + error.message) } finally { setSaving(false) }
  }

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) return toast.error('As senhas não coincidem.')
    if (newPassword.length < 6) return toast.error('A senha precisa de no mínimo 6 caracteres.')
    
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      
      toast.success('Senha alterada com sucesso!')
      setIsChangingPassword(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      toast.error('Erro: ' + error.message)
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Carregando...</div>
  const inputClass = `w-full p-3 rounded border outline-none transition ${isEditing ? 'bg-gray-700 border-gray-600 focus:border-yellow-400 text-white' : 'bg-gray-900 border-transparent text-gray-400 cursor-not-allowed'}`

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center pb-24">
      {isNewUser && <div className="w-full max-w-md bg-yellow-600 text-black p-4 rounded-lg mb-6 font-bold text-center animate-pulse">⚠️ Complete seu cadastro!</div>}

      <div className="w-full max-w-md bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg mb-8">
        <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold text-white">{isNewUser ? 'Finalizar Cadastro' : 'Meus Dados'}</h1>{!isNewUser && <button onClick={() => setIsEditing(!isEditing)} className="text-sm text-blue-400 hover:text-blue-300 font-bold">{isEditing ? 'Cancelar' : '✏️ Editar'}</button>}</div>
        <div className="flex flex-col items-center mb-6"><div className="w-28 h-28 rounded-full overflow-hidden border-4 border-gray-700 bg-gray-900 relative">{formData.avatar_url ? <img src={formData.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>}</div>{isEditing && <label className="mt-2 text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded cursor-pointer transition">📷 Alterar Foto<input type="file" accept="image/*" onChange={handleImageChange} className="hidden" /></label>}</div>
        
        <div className="space-y-4">
          {/* CAMPO DE E-MAIL TRAVADO */}
          <div>
            <label className="block text-xs text-gray-500 mb-1 ml-1 flex items-center gap-1">Email de Cadastro 🔒</label>
            <input disabled className="w-full p-3 rounded bg-gray-900 border border-transparent text-gray-500 cursor-not-allowed" value={userEmail} />
          </div>

          <div><label className="block text-xs text-gray-500 mb-1 ml-1">Apelido</label><input disabled={!isEditing} className={inputClass} value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} placeholder="Ex: João Gol" /></div>
          <div><label className="block text-xs text-gray-500 mb-1 ml-1">Nome Completo</label><input disabled={!isEditing} className={inputClass} value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="Ex: João da Silva" /></div>
          <div><label className="block text-xs text-gray-500 mb-1 ml-1">WhatsApp</label><input disabled={!isEditing} className={inputClass} value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} placeholder="(00) 00000-0000" type="tel" /></div>
          
          <div className="flex items-center mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
            <input 
              type="checkbox" 
              id="notify_results" 
              disabled={!isEditing}
              checked={formData.notify_results}
              onChange={e => setFormData({...formData, notify_results: e.target.checked})}
              className={`w-5 h-5 rounded border-gray-600 ${isEditing ? 'cursor-pointer accent-green-500' : 'cursor-not-allowed opacity-50'}`}
            />
            <label htmlFor="notify_results" className={`ml-3 text-sm ${isEditing ? 'text-gray-200 cursor-pointer' : 'text-gray-500 cursor-not-allowed'}`}>
              Receber meu resultado no WhatsApp ao fim de cada jogo
            </label>
          </div>

          {isEditing && <button onClick={handleSave} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg mt-4 shadow-lg">{saving ? 'Salvando...' : 'Salvar Alterações'}</button>}
        </div>

        {/* --- SEÇÃO DE TROCA DE SENHA --- */}
        {!isNewUser && (
            <div className="mt-8 pt-6 border-t border-gray-700">
                {!isChangingPassword ? (
                    <button 
                        onClick={() => setIsChangingPassword(true)} 
                        className="text-sm text-yellow-400 hover:text-yellow-300 font-bold transition flex items-center gap-2"
                    >
                        🔑 Alterar minha senha
                    </button>
                ) : (
                    <div className="space-y-4 animate-fade-in bg-gray-900/80 p-4 rounded-xl border border-gray-700 mt-2">
                        <h3 className="font-bold text-sm text-yellow-400">Criar Nova Senha</h3>
                        <div>
                            <input type="password" placeholder="Nova senha" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-3 rounded bg-gray-800 border border-gray-600 focus:border-yellow-400 text-white outline-none text-sm" />
                        </div>
                        <div>
                            <input type="password" placeholder="Confirme a nova senha" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-3 rounded bg-gray-800 border border-gray-600 focus:border-yellow-400 text-white outline-none text-sm" />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handlePasswordChange} disabled={savingPassword} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 rounded text-sm transition shadow">
                                {savingPassword ? '...' : 'Salvar Senha'}
                            </button>
                            <button onClick={() => { setIsChangingPassword(false); setNewPassword(''); setConfirmPassword(''); }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded text-sm transition">
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {!isNewUser && (
        <div className="w-full max-w-md mb-8">
            <h2 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2">🎟️ Minhas Inscrições</h2>
            <div className="space-y-3">
                {myEnrollments.length > 0 ? myEnrollments.map(enroll => (
                    <div key={enroll.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center shadow-md">
                        <div><h3 className="font-bold text-white text-lg">{enroll.competitions?.name}</h3><p className="text-xs text-gray-400">Valor: R$ {enroll.competitions?.entry_fee}</p></div>
                        <div className="text-right flex flex-col items-end gap-2">
                            {enroll.is_paid ? (
                                <span className="bg-green-900/40 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">PAGO ✅</span>
                            ) : (
                                <>
                                    <button onClick={() => router.push(`/pagamento?competitionId=${enroll.competition_id}`)} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full text-xs font-bold animate-pulse shadow-lg border border-red-400">PAGAR 💳</button>
                                    <button onClick={() => handleUnsubscribe(enroll.id, enroll.competitions?.name)} className="text-xs text-gray-500 hover:text-red-400 underline">Desistir</button>
                                </>
                            )}
                        </div>
                    </div>
                )) : <div className="text-center p-8 bg-gray-800/50 rounded-xl border border-dashed border-gray-700 text-gray-400">Você não está participando de nenhum bolão ainda.</div>}
            </div>
        </div>
      )}

      {!isNewUser && availableComps.length > 0 && (
        <div className="w-full max-w-md">
            <h2 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">🆕 Disponíveis para Entrar</h2>
            <div className="space-y-3">
                {availableComps.map(comp => (
                    <div key={comp.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex justify-between items-center opacity-90 hover:opacity-100 transition hover:border-blue-500/50">
                        <div><h3 className="font-bold text-white">{comp.name}</h3><p className="text-xs text-gray-400">Inscrição: <span className="text-yellow-400 font-bold">R$ {comp.entry_fee}</span></p></div>
                        <button onClick={() => handleEnroll(comp.id)} disabled={enrollingId === comp.id} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition transform hover:scale-105">{enrollingId === comp.id ? '...' : 'Participar +'}</button>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  )
}